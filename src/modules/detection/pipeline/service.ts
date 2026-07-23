import {
  DetectionRunItemStatus,
  DetectionRunStatus,
  Prisma,
  SourceDocumentProcessingStatus,
} from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { detectionConfig } from "@/modules/detection/config";
import { extractBodaccCandidate } from "@/modules/detection/parsers/bodacc";
import {
  documentFingerprint,
  normalizeSourceUrl,
} from "@/modules/detection/pipeline/document";
import { detectionLog } from "@/modules/detection/pipeline/logger";
import { persistQualifiedCandidate } from "@/modules/detection/repositories/entities";
import { qualifySignal } from "@/modules/detection/signals/qualification";
import {
  detectionSource,
  detectionSources,
  type DetectionSourceRegistration,
} from "@/modules/detection/sources/registry";
import type {
  CollectedDocument,
  ProspectSource,
} from "@/modules/detection/types";

export class DetectionConfigurationError extends Error {}
export class DetectionRunConflictError extends Error {}

function safeJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function storeDocument(
  detectionRunId: string,
  collected: CollectedDocument,
) {
  const contentHash = documentFingerprint(collected.content);
  const sourceUrl = normalizeSourceUrl(collected.sourceUrl);
  const existing = await prisma.sourceDocument.findFirst({
    where: {
      OR: [
        ...(collected.externalId
          ? [
              {
                sourceKey: collected.sourceKey,
                externalId: collected.externalId,
              },
            ]
          : []),
        { sourceKey: collected.sourceKey, sourceUrl },
        { sourceKey: collected.sourceKey, contentHash },
      ],
    },
  });
  const contentChanged = existing && existing.contentHash !== contentHash;
  const document = existing
    ? await prisma.sourceDocument.update({
        where: { id: existing.id },
        data: {
          collectedAt: collected.collectedAt,
          contentHash,
          externalId: collected.externalId,
          metadata: safeJson(collected.metadata),
          processingError: contentChanged ? null : existing.processingError,
          processingStatus: contentChanged
            ? SourceDocumentProcessingStatus.COLLECTED
            : existing.processingStatus,
          publishedAt: collected.publishedAt,
          rawContent: collected.content,
          sourceUrl,
          title: collected.title,
        },
      })
    : await prisma.sourceDocument.create({
        data: {
          collectedAt: collected.collectedAt,
          contentHash,
          externalId: collected.externalId,
          metadata: safeJson(collected.metadata),
          processingStatus: SourceDocumentProcessingStatus.COLLECTED,
          publishedAt: collected.publishedAt,
          rawContent: collected.content,
          sourceKey: collected.sourceKey,
          sourceUrl,
          title: collected.title,
        },
      });
  const terminalStatuses = new Set<SourceDocumentProcessingStatus>([
    SourceDocumentProcessingStatus.PROCESSED,
    SourceDocumentProcessingStatus.IGNORED,
  ]);
  const alreadyProcessed =
    !contentChanged && terminalStatuses.has(document.processingStatus);
  const item = await prisma.detectionRunItem.upsert({
    where: {
      detectionRunId_sourceDocumentId: {
        detectionRunId,
        sourceDocumentId: document.id,
      },
    },
    update: {},
    create: {
      detectionRunId,
      sourceDocumentId: document.id,
      status: alreadyProcessed
        ? DetectionRunItemStatus.IGNORED
        : DetectionRunItemStatus.COLLECTED,
      rejectionReasons: alreadyProcessed ? ["DOCUMENT_ALREADY_PROCESSED"] : [],
    },
  });
  return { document, item };
}

async function matchesPotentialFirmTarget(department: string | null) {
  return (
    (await prisma.firmPreference.count({
      where: {
        OR: [
          { nationwide: true },
          ...(department
            ? [{ prospectingDepartments: { has: department } }]
            : []),
        ],
      },
    })) > 0
  );
}

async function ignoreItem(
  itemId: string,
  documentId: string,
  reasons: string[],
  durationMs: number,
) {
  await prisma.$transaction([
    prisma.detectionRunItem.update({
      where: { id: itemId },
      data: {
        durationMs,
        rejectionReasons: reasons,
        status: DetectionRunItemStatus.IGNORED,
      },
    }),
    prisma.sourceDocument.update({
      where: { id: documentId },
      data: {
        processingError: null,
        processingStatus: SourceDocumentProcessingStatus.IGNORED,
      },
    }),
  ]);
}

async function processItem(
  detectionRunId: string,
  sourceKey: string,
  itemId: string,
) {
  const startedAt = Date.now();
  const item = await prisma.detectionRunItem.findUnique({
    where: { id: itemId },
    include: { sourceDocument: true },
  });
  if (!item) {
    return;
  }
  if (
    item.status === DetectionRunItemStatus.PROCESSED ||
    item.status === DetectionRunItemStatus.IGNORED
  ) {
    return;
  }
  const attempt = item.attemptCount + 1;
  await prisma.$transaction([
    prisma.detectionRunItem.update({
      where: { id: item.id },
      data: {
        attemptCount: { increment: 1 },
        errorMessage: null,
        nextRetryAt: null,
        status: DetectionRunItemStatus.PROCESSING,
      },
    }),
    prisma.sourceDocument.update({
      where: { id: item.sourceDocumentId },
      data: {
        processingError: null,
        processingStatus: SourceDocumentProcessingStatus.PROCESSING,
      },
    }),
  ]);

  detectionLog({
    stage: "parsing",
    detectionRunId,
    sourceKey,
    documentId: item.sourceDocumentId,
    status: "started",
  });

  try {
    const document: CollectedDocument = {
      sourceKey: item.sourceDocument.sourceKey,
      externalId: item.sourceDocument.externalId,
      title: item.sourceDocument.title,
      content: item.sourceDocument.rawContent,
      sourceUrl: item.sourceDocument.sourceUrl,
      publishedAt: item.sourceDocument.publishedAt,
      collectedAt: item.sourceDocument.collectedAt,
      metadata: (item.sourceDocument.metadata ?? {}) as Prisma.JsonObject,
    };
    const extraction = extractBodaccCandidate(document);
    if (extraction.outcome === "ignored") {
      await ignoreItem(
        item.id,
        item.sourceDocumentId,
        extraction.reasons,
        Date.now() - startedAt,
      );
      detectionLog({
        stage: "signal_extraction",
        detectionRunId,
        sourceKey,
        documentId: item.sourceDocumentId,
        status: "ignored",
        reasonCode: extraction.reasons[0],
        durationMs: Date.now() - startedAt,
      });
      return;
    }

    const qualification = qualifySignal(extraction.candidate, {
      matchesFirmTarget: await matchesPotentialFirmTarget(
        extraction.candidate.company.department,
      ),
    });
    if (!qualification.isRelevant) {
      await ignoreItem(
        item.id,
        item.sourceDocumentId,
        qualification.rejectionReasons.length
          ? qualification.rejectionReasons
          : ["AUTOMATIC_SCORE_BELOW_THRESHOLD"],
        Date.now() - startedAt,
      );
      detectionLog({
        stage: "qualification",
        detectionRunId,
        sourceKey,
        documentId: item.sourceDocumentId,
        status: "ignored",
        reasonCode:
          qualification.rejectionReasons[0] ??
          "AUTOMATIC_SCORE_BELOW_THRESHOLD",
        durationMs: Date.now() - startedAt,
      });
      return;
    }

    const result = await prisma.$transaction(async (transaction) => {
      const persisted = await persistQualifiedCandidate(transaction, {
        candidate: extraction.candidate,
        detectionRunId,
        qualification,
        sourceDocumentId: item.sourceDocumentId,
        sourceKey,
        sourcePublishedAt: item.sourceDocument.publishedAt,
      });
      await transaction.detectionRunItem.update({
        where: { id: item.id },
        data: {
          durationMs: Date.now() - startedAt,
          matchingReasons: qualification.matchingReasons,
          rejectionReasons: persisted.duplicate
            ? ["EVENT_ALREADY_PROCESSED"]
            : [],
          status: persisted.duplicate
            ? DetectionRunItemStatus.IGNORED
            : DetectionRunItemStatus.PROCESSED,
        },
      });
      await transaction.sourceDocument.update({
        where: { id: item.sourceDocumentId },
        data: {
          processingError: null,
          processingStatus: SourceDocumentProcessingStatus.PROCESSED,
        },
      });
      if (!persisted.duplicate) {
        await transaction.detectionRun.update({
          where: { id: detectionRunId },
          data: {
            opportunitiesCreated: persisted.opportunityCreated
              ? { increment: 1 }
              : undefined,
            prospectsCreated: persisted.prospectCreated
              ? { increment: 1 }
              : undefined,
            signalsDetected: { increment: 1 },
          },
        });
      }
      return persisted;
    });
    detectionLog({
      stage: "company_matching",
      detectionRunId,
      sourceKey,
      documentId: item.sourceDocumentId,
      status: result.companyId ? "completed" : "ignored",
      durationMs: Date.now() - startedAt,
    });
    detectionLog({
      stage: "prospect_identification",
      detectionRunId,
      sourceKey,
      documentId: item.sourceDocumentId,
      prospectId: result.prospectId,
      status: "completed",
      durationMs: Date.now() - startedAt,
    });
    detectionLog({
      stage: "deduplication",
      detectionRunId,
      sourceKey,
      documentId: item.sourceDocumentId,
      signalId: result.signalId,
      prospectId: result.prospectId,
      opportunityId: result.opportunityId ?? undefined,
      status: result.duplicate ? "ignored" : "completed",
      reasonCode: result.duplicate ? "EVENT_ALREADY_PROCESSED" : undefined,
      durationMs: Date.now() - startedAt,
    });
    detectionLog({
      stage: "opportunity_creation",
      detectionRunId,
      sourceKey,
      documentId: item.sourceDocumentId,
      signalId: result.signalId,
      prospectId: result.prospectId,
      opportunityId: result.opportunityId ?? undefined,
      status: result.duplicate ? "ignored" : "completed",
      reasonCode: result.duplicate ? "EVENT_ALREADY_PROCESSED" : undefined,
      durationMs: Date.now() - startedAt,
    });
  } catch {
    const terminal = attempt >= detectionConfig.maxDocumentAttempts;
    const nextRetryAt = terminal
      ? null
      : new Date(Date.now() + 2 ** attempt * 60_000);
    await prisma.$transaction([
      prisma.detectionRunItem.update({
        where: { id: item.id },
        data: {
          durationMs: Date.now() - startedAt,
          errorMessage: "PIPELINE_DOCUMENT_FAILED",
          nextRetryAt,
          status: DetectionRunItemStatus.FAILED,
        },
      }),
      prisma.sourceDocument.update({
        where: { id: item.sourceDocumentId },
        data: {
          processingError: "PIPELINE_DOCUMENT_FAILED",
          processingStatus: SourceDocumentProcessingStatus.FAILED,
        },
      }),
    ]);
    detectionLog({
      stage: "opportunity_creation",
      detectionRunId,
      sourceKey,
      documentId: item.sourceDocumentId,
      status: "failed",
      reasonCode: terminal ? "MAX_ATTEMPTS_REACHED" : "RETRY_SCHEDULED",
      durationMs: Date.now() - startedAt,
    });
  }
}

async function finalizeRun(detectionRunId: string) {
  const [total, processed, ignored, failed] = await Promise.all([
    prisma.detectionRunItem.count({ where: { detectionRunId } }),
    prisma.detectionRunItem.count({
      where: { detectionRunId, status: DetectionRunItemStatus.PROCESSED },
    }),
    prisma.detectionRunItem.count({
      where: { detectionRunId, status: DetectionRunItemStatus.IGNORED },
    }),
    prisma.detectionRunItem.count({
      where: { detectionRunId, status: DetectionRunItemStatus.FAILED },
    }),
  ]);
  return prisma.detectionRun.update({
    where: { id: detectionRunId },
    data: {
      completedAt: new Date(),
      documentsCollected: total,
      documentsProcessed: processed,
      errorsCount: failed,
      opportunitiesIgnored: ignored,
      status:
        failed > 0
          ? DetectionRunStatus.COMPLETED_WITH_ERRORS
          : DetectionRunStatus.COMPLETED,
    },
  });
}

async function collectDocuments(
  runId: string,
  source: ProspectSource,
  since: Date,
) {
  const startedAt = Date.now();
  detectionLog({
    stage: "collection",
    detectionRunId: runId,
    sourceKey: source.key,
    status: "started",
  });
  const documents = await source.collect({
    detectionRunId: runId,
    limit: detectionConfig.maxDocumentsPerRun,
    since,
  });
  for (const document of documents) {
    if (document.sourceKey !== source.key) {
      throw new Error("SOURCE_KEY_MISMATCH");
    }
    await storeDocument(runId, document);
  }
  detectionLog({
    stage: "collection",
    detectionRunId: runId,
    sourceKey: source.key,
    status: "completed",
    durationMs: Date.now() - startedAt,
  });
}

async function executeRun(
  runId: string,
  registration: DetectionSourceRegistration,
  retry: boolean,
) {
  const run = await prisma.detectionRun.update({
    where: { id: runId },
    data: {
      completedAt: null,
      startedAt: new Date(),
      status: DetectionRunStatus.RUNNING,
    },
  });
  try {
    const itemCount = await prisma.detectionRunItem.count({
      where: { detectionRunId: run.id },
    });
    if (!retry || itemCount === 0) {
      const previous = await prisma.detectionRun.findFirst({
        where: {
          sourceKey: run.sourceKey,
          id: { not: run.id },
          status: {
            in: [
              DetectionRunStatus.COMPLETED,
              DetectionRunStatus.COMPLETED_WITH_ERRORS,
            ],
          },
        },
        orderBy: { startedAt: "desc" },
        select: { startedAt: true },
      });
      const since = previous?.startedAt
        ? new Date(
            previous.startedAt.getTime() -
              detectionConfig.maximumSignalAgeDays * 86_400_000,
          )
        : new Date(
            Date.now() - detectionConfig.maximumSignalAgeDays * 86_400_000,
          );
      await collectDocuments(run.id, registration.source, since);
    }
    const items = await prisma.detectionRunItem.findMany({
      where: {
        detectionRunId: run.id,
        status: {
          in: [DetectionRunItemStatus.COLLECTED, DetectionRunItemStatus.FAILED],
        },
        attemptCount: { lt: detectionConfig.maxDocumentAttempts },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    for (const item of items) {
      await processItem(run.id, run.sourceKey, item.id);
    }
    return finalizeRun(run.id);
  } catch {
    detectionLog({
      stage: "collection",
      detectionRunId: run.id,
      sourceKey: run.sourceKey,
      status: "failed",
      reasonCode: "SOURCE_COLLECTION_FAILED",
    });
    return prisma.detectionRun.update({
      where: { id: run.id },
      data: {
        completedAt: new Date(),
        errorsCount: { increment: 1 },
        metadata: { failureCode: "SOURCE_COLLECTION_FAILED" },
        status: DetectionRunStatus.FAILED,
      },
    });
  }
}

async function expireStaleRuns(sourceKey: string) {
  const staleBefore = new Date(
    Date.now() - detectionConfig.staleRunMinutes * 60_000,
  );
  await prisma.detectionRun.updateMany({
    where: {
      sourceKey,
      status: {
        in: [DetectionRunStatus.PENDING, DetectionRunStatus.RUNNING],
      },
      OR: [
        { startedAt: { lt: staleBefore } },
        { startedAt: null, createdAt: { lt: staleBefore } },
      ],
    },
    data: {
      completedAt: new Date(),
      metadata: { failureCode: "STALE_RUN_EXPIRED" },
      status: DetectionRunStatus.FAILED,
    },
  });
}

function enabledRegistration(sourceKey: string) {
  if (!detectionConfig.enabled) {
    throw new DetectionConfigurationError(
      "Le moteur de détection est désactivé.",
    );
  }
  const registration = detectionSource(sourceKey);
  if (!registration?.enabled) {
    throw new DetectionConfigurationError(
      "Cette source de détection est désactivée.",
    );
  }
  return registration;
}

export async function startDetectionRun(
  sourceKey: string,
  launchedByUserId: string | null,
) {
  const registration = enabledRegistration(sourceKey);
  await expireStaleRuns(sourceKey);
  const active = await prisma.detectionRun.findFirst({
    where: {
      sourceKey,
      status: {
        in: [DetectionRunStatus.PENDING, DetectionRunStatus.RUNNING],
      },
    },
    select: { id: true },
  });
  if (active) {
    throw new DetectionRunConflictError(
      "Une exécution de cette source est déjà en cours.",
    );
  }
  let run;
  try {
    run = await prisma.detectionRun.create({
      data: {
        launchedByUserId,
        metadata: {
          llmEnabled: detectionConfig.llmEnabled,
          mode: registration.isDemo ? "SIMULATED" : "LIVE",
        },
        sourceKey,
        status: DetectionRunStatus.PENDING,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new DetectionRunConflictError(
        "Une exécution de cette source est déjà en cours.",
      );
    }
    throw error;
  }
  return executeRun(run.id, registration, false);
}

export async function retryDetectionRun(
  runId: string,
  launchedByUserId: string | null,
) {
  const run = await prisma.detectionRun.findFirst({
    where: {
      id: runId,
      status: {
        in: [
          DetectionRunStatus.FAILED,
          DetectionRunStatus.COMPLETED_WITH_ERRORS,
        ],
      },
    },
  });
  if (!run) {
    throw new DetectionRunConflictError(
      "Cette exécution ne peut pas être relancée.",
    );
  }
  const registration = enabledRegistration(run.sourceKey);
  await expireStaleRuns(run.sourceKey);
  const active = await prisma.detectionRun.findFirst({
    where: {
      sourceKey: run.sourceKey,
      id: { not: run.id },
      status: {
        in: [DetectionRunStatus.PENDING, DetectionRunStatus.RUNNING],
      },
    },
    select: { id: true },
  });
  if (active) {
    throw new DetectionRunConflictError(
      "Une exécution de cette source est déjà en cours.",
    );
  }
  await prisma.detectionRun.update({
    where: { id: run.id },
    data: { launchedByUserId },
  });
  return executeRun(run.id, registration, true);
}

export async function runScheduledDetection() {
  if (!detectionConfig.enabled || !detectionConfig.schedulerEnabled) {
    return [];
  }
  const results = [];
  for (const registration of detectionSources().filter(
    ({ enabled, isDemo }) => enabled && !isDemo,
  )) {
    const retryable = await prisma.detectionRun.findFirst({
      where: {
        sourceKey: registration.source.key,
        status: DetectionRunStatus.COMPLETED_WITH_ERRORS,
        items: {
          some: {
            status: DetectionRunItemStatus.FAILED,
            nextRetryAt: { lte: new Date() },
            attemptCount: { lt: detectionConfig.maxDocumentAttempts },
          },
        },
      },
      orderBy: { completedAt: "asc" },
      select: { id: true },
    });
    if (retryable) {
      results.push(await retryDetectionRun(retryable.id, null));
      continue;
    }
    const latest = await prisma.detectionRun.findFirst({
      where: { sourceKey: registration.source.key },
      orderBy: { startedAt: "desc" },
      select: { startedAt: true },
    });
    const dueAt = latest?.startedAt
      ? new Date(
          latest.startedAt.getTime() + registration.intervalMinutes * 60_000,
        )
      : new Date(0);
    if (dueAt <= new Date()) {
      try {
        results.push(await startDetectionRun(registration.source.key, null));
      } catch (error) {
        if (!(error instanceof DetectionRunConflictError)) {
          throw error;
        }
      }
    }
  }
  return results;
}
