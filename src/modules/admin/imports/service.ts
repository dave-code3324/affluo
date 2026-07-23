import {
  ConfidenceLevel,
  ContactDetailType,
  ContactabilityStatus,
  DuplicateMatchLevel,
  DuplicateResolution,
  ImportRowStatus,
  ImportStatus,
  OpportunityReviewStatus,
  OpportunityStatus,
  Prisma,
  SignalVerificationStatus,
  VerificationStatus,
} from "@prisma/client";
import { createHash } from "node:crypto";

import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/modules/admin/audit";
import {
  CSV_IMPORT_BATCH_SIZE,
  CSV_IMPORT_MAX_BYTES,
  CSV_IMPORT_MAX_ROWS,
} from "@/modules/admin/imports/config";
import {
  findSecondaryDuplicate,
  findStrongDuplicate,
} from "@/modules/admin/imports/duplicates";
import {
  comparisonKey,
  neutralizeCsvFormula,
  normalizedDomain,
} from "@/modules/admin/imports/normalization";
import {
  parseCsvContent,
  parseStoredNormalizedRow,
} from "@/modules/admin/imports/parser";
import type {
  DuplicateCandidate,
  ImportFieldError,
  NormalizedImportRow,
} from "@/modules/admin/imports/types";

export class ImportValidationError extends Error {}

type UploadMetadata = {
  name: string;
  size: number;
  type: string;
};

const ACCEPTED_MIME_TYPES = new Set([
  "",
  "application/csv",
  "application/vnd.ms-excel",
  "text/csv",
  "text/plain",
]);

export function sanitizeCsvFilename(filename: string) {
  return (
    filename
      .split(/[\\/]/)
      .pop()
      ?.replace(/[\u0000-\u001F\u007F]/g, "")
      .trim()
      .slice(0, 180) ?? ""
  );
}

export function validateCsvUpload({ name, size, type }: UploadMetadata) {
  const filename = sanitizeCsvFilename(name);
  if (!filename.toLowerCase().endsWith(".csv")) {
    throw new ImportValidationError("Seuls les fichiers .csv sont acceptés.");
  }
  if (!ACCEPTED_MIME_TYPES.has(type.toLowerCase())) {
    throw new ImportValidationError("Le type du fichier n’est pas autorisé.");
  }
  if (size <= 0 || size > CSV_IMPORT_MAX_BYTES) {
    throw new ImportValidationError(
      `Le fichier doit peser moins de ${Math.floor(CSV_IMPORT_MAX_BYTES / 1024 / 1024)} Mo.`,
    );
  }
  return filename;
}

async function duplicateCandidates(
  rows: NormalizedImportRow[],
): Promise<DuplicateCandidate[]> {
  const emails = rows
    .map(({ professionalEmail }) => professionalEmail)
    .filter((value): value is string => Boolean(value));
  const phones = rows
    .map(({ professionalPhone }) => professionalPhone)
    .filter((value): value is string => Boolean(value));
  const linkedinUrls = rows
    .map(({ linkedinUrl }) => linkedinUrl)
    .filter((value): value is string => Boolean(value));
  const lastNames = rows.map(({ lastName }) => lastName);
  const contactValues = [...emails, ...phones, ...linkedinUrls];

  const prospects = await prisma.prospect.findMany({
    where: {
      OR: [
        ...(emails.length
          ? [
              {
                professionalEmail: {
                  in: emails,
                  mode: Prisma.QueryMode.insensitive,
                },
              } satisfies Prisma.ProspectWhereInput,
            ]
          : []),
        ...(linkedinUrls.length
          ? [
              {
                linkedinUrl: { in: linkedinUrls },
              } satisfies Prisma.ProspectWhereInput,
            ]
          : []),
        ...(contactValues.length
          ? [
              {
                contactDetails: {
                  some: { value: { in: contactValues } },
                },
              } satisfies Prisma.ProspectWhereInput,
            ]
          : []),
        ...(lastNames.length
          ? [
              {
                lastName: {
                  in: lastNames,
                  mode: Prisma.QueryMode.insensitive,
                },
              } satisfies Prisma.ProspectWhereInput,
            ]
          : []),
      ],
    },
    take: 5_000,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      jobTitle: true,
      companyName: true,
      city: true,
      department: true,
      professionalEmail: true,
      linkedinUrl: true,
      company: {
        select: { website: true },
      },
      contactDetails: {
        where: { verificationStatus: { not: VerificationStatus.INVALID } },
        select: { type: true, value: true },
      },
    },
  });

  return prospects.map((prospect) => ({
    city: prospect.city,
    companyName: prospect.companyName,
    companyWebsite: prospect.company?.website ?? null,
    department: prospect.department,
    emails: [
      prospect.professionalEmail,
      ...prospect.contactDetails
        .filter(({ type }) => type === ContactDetailType.PROFESSIONAL_EMAIL)
        .map(({ value }) => value),
    ].filter((value): value is string => Boolean(value)),
    firstName: prospect.firstName,
    id: prospect.id,
    jobTitle: prospect.jobTitle,
    lastName: prospect.lastName,
    linkedinUrls: [
      prospect.linkedinUrl,
      ...prospect.contactDetails
        .filter(({ type }) => type === ContactDetailType.LINKEDIN)
        .map(({ value }) => value),
    ].filter((value): value is string => Boolean(value)),
    phones: prospect.contactDetails
      .filter(({ type }) => type === ContactDetailType.PROFESSIONAL_PHONE)
      .map(({ value }) => value),
  }));
}

function rowStrongKeys(row: NormalizedImportRow) {
  return [
    row.professionalEmail
      ? `email:${row.professionalEmail.toLowerCase()}`
      : null,
    row.professionalPhone ? `phone:${row.professionalPhone}` : null,
    row.linkedinUrl ? `linkedin:${row.linkedinUrl.toLowerCase()}` : null,
  ].filter((value): value is string => Boolean(value));
}

function rowIdentityKey(row: NormalizedImportRow) {
  return [
    comparisonKey(row.firstName),
    comparisonKey(row.lastName),
    comparisonKey(row.companyName),
  ].join(":");
}

function duplicateError(reason: string): ImportFieldError {
  return {
    field: "duplicate",
    message: reason,
    originalValue: "",
  };
}

type CreateImportPreviewInput = {
  actorUserId: string;
  content: string;
  filename: string;
};

export async function createImportPreview({
  actorUserId,
  content,
  filename,
}: CreateImportPreviewInput) {
  const parsed = parseCsvContent(content);
  const failureMessage = parsed.missingColumns.length
    ? `Colonnes obligatoires manquantes : ${parsed.missingColumns.join(", ")}`
    : parsed.rows.length > CSV_IMPORT_MAX_ROWS
      ? `Le fichier dépasse la limite de ${CSV_IMPORT_MAX_ROWS} lignes.`
      : parsed.rows.length === 0
        ? "Le fichier ne contient aucune ligne de données."
        : null;

  const dataImport = await prisma.dataImport.create({
    data: {
      contentHash: createHash("sha256").update(content).digest("hex"),
      createdByUserId: actorUserId,
      failureMessage,
      filename: sanitizeCsvFilename(filename),
      status: failureMessage ? ImportStatus.FAILED : ImportStatus.VALIDATING,
      totalRows: parsed.rows.length,
    },
  });

  if (failureMessage) {
    await writeAuditLog(prisma, {
      action: "IMPORT_REJECTED",
      actorUserId,
      entityId: dataImport.id,
      entityType: "import",
      metadata: {
        reason: failureMessage,
      },
    });
    return dataImport;
  }

  const validNormalizedRows = parsed.rows
    .map(({ normalizedData }) => normalizedData)
    .filter((row): row is NormalizedImportRow => Boolean(row));
  const candidates = await duplicateCandidates(validNormalizedRows);
  const strongRows = new Map<string, number>();
  const identityRows = new Map<string, number>();
  let validRows = 0;
  let invalidRows = 0;
  let duplicateRows = 0;

  const rows = parsed.rows.map((row) => {
    if (!row.normalizedData) {
      invalidRows += 1;
      return {
        importId: dataImport.id,
        rowNumber: row.rowNumber,
        rawData: row.rawData,
        normalizedData: Prisma.JsonNull,
        status: ImportRowStatus.INVALID,
        errorMessages: row.errors,
      };
    }

    const normalized = row.normalizedData;
    const strongMatch = findStrongDuplicate(normalized, candidates);
    const secondaryMatch =
      strongMatch ?? findSecondaryDuplicate(normalized, candidates);
    const existingStrongRow = rowStrongKeys(normalized)
      .map((key) => strongRows.get(key))
      .find((value) => value !== undefined);
    const identityKey = rowIdentityKey(normalized);
    const existingIdentityRow = identityRows.get(identityKey);
    const fileDuplicate = existingStrongRow ?? existingIdentityRow;
    const matchLevel =
      strongMatch?.level ??
      secondaryMatch?.level ??
      (existingStrongRow ? "STRONG" : fileDuplicate ? "SECONDARY" : null);

    rowStrongKeys(normalized).forEach((key) => {
      if (!strongRows.has(key)) {
        strongRows.set(key, row.rowNumber);
      }
    });
    if (!identityRows.has(identityKey)) {
      identityRows.set(identityKey, row.rowNumber);
    }

    if (secondaryMatch || fileDuplicate) {
      duplicateRows += 1;
      const reason =
        secondaryMatch?.reason ??
        `Correspondance avec la ligne ${fileDuplicate}`;
      return {
        importId: dataImport.id,
        rowNumber: row.rowNumber,
        rawData: row.rawData,
        normalizedData: normalized,
        status: ImportRowStatus.DUPLICATE,
        errorMessages: [duplicateError(reason)],
        duplicateOfProspectId: secondaryMatch?.candidateId,
        duplicateMatchLevel:
          matchLevel === "STRONG"
            ? DuplicateMatchLevel.STRONG
            : DuplicateMatchLevel.SECONDARY,
      };
    }

    validRows += 1;
    return {
      importId: dataImport.id,
      rowNumber: row.rowNumber,
      rawData: row.rawData,
      normalizedData: normalized,
      status: ImportRowStatus.VALID,
      errorMessages: [],
    };
  });

  for (let index = 0; index < rows.length; index += 100) {
    await prisma.importRow.createMany({
      data: rows.slice(index, index + 100),
    });
  }

  const readyImport = await prisma.dataImport.update({
    where: { id: dataImport.id },
    data: {
      duplicateRows,
      invalidRows,
      status: ImportStatus.READY,
      validRows,
    },
  });

  await writeAuditLog(prisma, {
    action: "IMPORT_PREVIEW_CREATED",
    actorUserId,
    entityId: dataImport.id,
    entityType: "import",
    metadata: {
      delimiter: parsed.delimiter,
      duplicateRows,
      invalidRows,
      totalRows: rows.length,
      validRows,
    },
  });

  return readyImport;
}

type ResolveDuplicateInput = {
  actorUserId: string;
  importId: string;
  resolution: DuplicateResolution;
  rowId: string;
};

export async function resolveImportDuplicate({
  actorUserId,
  importId,
  resolution,
  rowId,
}: ResolveDuplicateInput) {
  const row = await prisma.importRow.findFirst({
    where: {
      id: rowId,
      importId,
      status: ImportRowStatus.DUPLICATE,
      dataImport: { status: ImportStatus.READY },
    },
    select: {
      id: true,
      duplicateOfProspectId: true,
      duplicateResolution: true,
    },
  });

  if (
    !row ||
    (resolution === DuplicateResolution.UPDATE_EXISTING &&
      !row.duplicateOfProspectId)
  ) {
    return null;
  }

  const updated = await prisma.importRow.update({
    where: { id: row.id },
    data: {
      duplicateResolution: resolution,
      status:
        resolution === DuplicateResolution.SKIP
          ? ImportRowStatus.SKIPPED
          : ImportRowStatus.DUPLICATE,
    },
  });

  await writeAuditLog(prisma, {
    action: "IMPORT_DUPLICATE_RESOLVED",
    actorUserId,
    entityId: row.id,
    entityType: "import_row",
    previousData: {
      resolution: row.duplicateResolution ?? "UNRESOLVED",
    },
    newData: { resolution },
    metadata: { importId },
  });

  return updated;
}

async function upsertCompany(
  transaction: Prisma.TransactionClient,
  row: NormalizedImportRow,
) {
  const domain = normalizedDomain(row.companyWebsite);
  const normalizedName = comparisonKey(row.companyName);

  if (!domain && !normalizedName) {
    return null;
  }

  const existing = await transaction.company.findFirst({
    where: {
      OR: [
        ...(domain ? [{ normalizedDomain: domain }] : []),
        { normalizedName },
      ],
    },
    select: { id: true },
  });

  if (existing) {
    return transaction.company.update({
      where: { id: existing.id },
      data: {
        city: row.city,
        department: row.department,
        name: row.companyName || "Entreprise non renseignée",
        website: row.companyWebsite,
      },
    });
  }

  return transaction.company.create({
    data: {
      city: row.city,
      department: row.department,
      name: row.companyName || "Entreprise non renseignée",
      normalizedDomain: domain,
      normalizedName: normalizedName || "entreprise-non-renseignee",
      website: row.companyWebsite,
    },
  });
}

function importedLinkedinStatus(status: VerificationStatus) {
  return status === VerificationStatus.VERIFIED
    ? VerificationStatus.LIKELY
    : status;
}

function contactability(row: NormalizedImportRow) {
  const contacts = [
    row.professionalEmail &&
      row.emailVerificationStatus !== VerificationStatus.INVALID,
    row.professionalPhone &&
      row.phoneVerificationStatus !== VerificationStatus.INVALID,
    row.linkedinUrl &&
      row.linkedinVerificationStatus !== VerificationStatus.INVALID,
  ].some(Boolean);
  const verified = [
    row.professionalEmail &&
      row.emailVerificationStatus === VerificationStatus.VERIFIED,
    row.professionalPhone &&
      row.phoneVerificationStatus === VerificationStatus.VERIFIED,
  ].some(Boolean);

  return verified
    ? ContactabilityStatus.CONTACTABLE
    : contacts
      ? ContactabilityStatus.PARTIALLY_VERIFIED
      : ContactabilityStatus.NOT_CONTACTABLE;
}

async function importOneRow(
  actorUserId: string,
  importRowId: string,
): Promise<boolean> {
  const importRow = await prisma.importRow.findUnique({
    where: { id: importRowId },
    select: {
      id: true,
      importId: true,
      status: true,
      normalizedData: true,
      duplicateOfProspectId: true,
      duplicateResolution: true,
      createdOpportunityId: true,
    },
  });

  if (!importRow || importRow.status === ImportRowStatus.IMPORTED) {
    return true;
  }

  const normalized = parseStoredNormalizedRow(importRow.normalizedData);
  if (!normalized) {
    return false;
  }

  try {
    await prisma.$transaction(async (transaction) => {
      const company = await upsertCompany(transaction, normalized);
      const shouldUpdate =
        importRow.duplicateResolution === DuplicateResolution.UPDATE_EXISTING &&
        importRow.duplicateOfProspectId;
      const prospect = shouldUpdate
        ? await transaction.prospect.update({
            where: { id: importRow.duplicateOfProspectId! },
            data: {
              city: normalized.city,
              companyId: company?.id ?? null,
              companyName: normalized.companyName,
              department: normalized.department,
              firstName: normalized.firstName,
              jobTitle: normalized.jobTitle,
              lastName: normalized.lastName,
              linkedinUrl: normalized.linkedinUrl,
              professionalEmail: normalized.professionalEmail,
            },
          })
        : await transaction.prospect.create({
            data: {
              city: normalized.city,
              companyId: company?.id ?? null,
              companyName: normalized.companyName,
              department: normalized.department,
              emailVerificationStatus: normalized.emailVerificationStatus,
              firstName: normalized.firstName,
              jobTitle: normalized.jobTitle,
              lastName: normalized.lastName,
              linkedinUrl: normalized.linkedinUrl,
              professionalEmail: normalized.professionalEmail,
            },
          });

      const contactInputs = [
        normalized.professionalEmail
          ? {
              type: ContactDetailType.PROFESSIONAL_EMAIL,
              value: normalized.professionalEmail,
              status: normalized.emailVerificationStatus,
            }
          : null,
        normalized.professionalPhone
          ? {
              type: ContactDetailType.PROFESSIONAL_PHONE,
              value: normalized.professionalPhone,
              status: normalized.phoneVerificationStatus,
            }
          : null,
        normalized.linkedinUrl
          ? {
              type: ContactDetailType.LINKEDIN,
              value: normalized.linkedinUrl,
              status: importedLinkedinStatus(
                normalized.linkedinVerificationStatus,
              ),
            }
          : null,
        normalized.companyWebsite
          ? {
              type: ContactDetailType.COMPANY_WEBSITE,
              value: normalized.companyWebsite,
              status: VerificationStatus.UNVERIFIED,
            }
          : null,
      ].filter((contact): contact is NonNullable<typeof contact> =>
        Boolean(contact),
      );

      for (const [index, contact] of contactInputs.entries()) {
        const savedContact = await transaction.contactDetail.upsert({
          where: {
            prospectId_type_value: {
              prospectId: prospect.id,
              type: contact.type,
              value: contact.value,
            },
          },
          update: {
            verificationStatus: contact.status,
          },
          create: {
            isPrimary: index < 3,
            prospectId: prospect.id,
            type: contact.type,
            value: contact.value,
            verificationStatus: contact.status,
          },
        });
        await writeAuditLog(transaction, {
          action: "CONTACT_IMPORTED",
          actorUserId,
          entityId: savedContact.id,
          entityType: "contact_detail",
          newData: {
            type: contact.type,
            verificationStatus: contact.status,
          },
          metadata: { importId: importRow.importId },
        });
      }

      const signal = await transaction.signal.create({
        data: {
          description: normalized.signalDescription,
          detectedAt: new Date(),
          eventDate: new Date(`${normalized.eventDate}T00:00:00.000Z`),
          prospectId: prospect.id,
          sourceName: normalized.sourceName,
          sourcePublishedAt: normalized.sourcePublishedAt
            ? new Date(`${normalized.sourcePublishedAt}T00:00:00.000Z`)
            : null,
          sourceUrl: normalized.sourceUrl,
          title: normalized.signalTitle,
          type: normalized.signalType,
          verificationStatus: SignalVerificationStatus.UNVERIFIED,
        },
      });
      const opportunity = await transaction.opportunity.create({
        data: {
          confidenceLevel: normalized.confidenceLevel ?? ConfidenceLevel.MEDIUM,
          contactabilityStatus: contactability(normalized),
          internalNotes: normalized.notes,
          potentialNeeds: normalized.potentialNeeds,
          prospectId: prospect.id,
          qualificationSummary: null,
          relevanceScore: 0,
          reviewStatus: OpportunityReviewStatus.TO_REVIEW,
          signalSummary: normalized.signalDescription,
          signalType: normalized.signalType,
          status: OpportunityStatus.DRAFT,
          title: normalized.signalTitle,
          whyNow: normalized.whyNow,
        },
      });
      await transaction.opportunitySignal.create({
        data: {
          isPrimary: true,
          opportunityId: opportunity.id,
          signalId: signal.id,
        },
      });
      await transaction.importRow.update({
        where: { id: importRow.id },
        data: {
          createdOpportunityId: opportunity.id,
          createdProspectId: prospect.id,
          status: ImportRowStatus.IMPORTED,
        },
      });
      await writeAuditLog(transaction, {
        action: shouldUpdate
          ? "PROSPECT_UPDATED_FROM_IMPORT"
          : "PROSPECT_IMPORTED",
        actorUserId,
        entityId: prospect.id,
        entityType: "prospect",
        newData: {
          fields: ["identity", "company", "location", "professional_contacts"],
        },
        metadata: { importId: importRow.importId, importRowId: importRow.id },
      });
      await writeAuditLog(transaction, {
        action: "SIGNAL_IMPORTED",
        actorUserId,
        entityId: signal.id,
        entityType: "signal",
        newData: {
          verificationStatus: SignalVerificationStatus.UNVERIFIED,
        },
        metadata: { importId: importRow.importId },
      });
      await writeAuditLog(transaction, {
        action: "OPPORTUNITY_CREATED_FOR_REVIEW",
        actorUserId,
        entityId: opportunity.id,
        entityType: "opportunity",
        newData: {
          reviewStatus: OpportunityReviewStatus.TO_REVIEW,
          status: OpportunityStatus.DRAFT,
        },
        metadata: { importId: importRow.importId },
      });
    });
    return true;
  } catch {
    await prisma.importRow.update({
      where: { id: importRow.id },
      data: {
        errorMessages: [
          {
            field: "row",
            message: "La ligne n’a pas pu être importée.",
            originalValue: "",
          },
        ],
      },
    });
    return false;
  }
}

export async function runImport(actorUserId: string, importId: string) {
  const unresolved = await prisma.importRow.count({
    where: {
      importId,
      status: ImportRowStatus.DUPLICATE,
      duplicateResolution: null,
    },
  });
  if (unresolved > 0) {
    throw new ImportValidationError(
      "Tous les doublons doivent être résolus avant l’import.",
    );
  }

  const claimed = await prisma.dataImport.updateMany({
    where: { id: importId, status: ImportStatus.READY },
    data: {
      startedAt: new Date(),
      status: ImportStatus.IMPORTING,
    },
  });

  if (!claimed.count) {
    const existing = await prisma.dataImport.findUnique({
      where: { id: importId },
      select: { status: true },
    });
    if (existing?.status === ImportStatus.COMPLETED) {
      return existing;
    }
    throw new ImportValidationError("Cet import ne peut pas être lancé.");
  }

  await writeAuditLog(prisma, {
    action: "IMPORT_STARTED",
    actorUserId,
    entityId: importId,
    entityType: "import",
  });

  const importableRows = await prisma.importRow.findMany({
    where: {
      importId,
      OR: [
        { status: ImportRowStatus.VALID },
        {
          status: ImportRowStatus.DUPLICATE,
          duplicateResolution: {
            in: [
              DuplicateResolution.UPDATE_EXISTING,
              DuplicateResolution.CREATE_DISTINCT,
            ],
          },
        },
      ],
    },
    orderBy: { rowNumber: "asc" },
    select: { id: true },
  });

  for (
    let index = 0;
    index < importableRows.length;
    index += CSV_IMPORT_BATCH_SIZE
  ) {
    const batch = importableRows.slice(index, index + CSV_IMPORT_BATCH_SIZE);
    for (const row of batch) {
      await importOneRow(actorUserId, row.id);
    }
  }

  const [processedRows, invalidRows, remainingRows] = await Promise.all([
    prisma.importRow.count({
      where: {
        importId,
        status: { in: [ImportRowStatus.IMPORTED, ImportRowStatus.SKIPPED] },
      },
    }),
    prisma.importRow.count({
      where: { importId, status: ImportRowStatus.INVALID },
    }),
    prisma.importRow.count({
      where: {
        importId,
        OR: [
          { status: ImportRowStatus.VALID },
          {
            status: ImportRowStatus.DUPLICATE,
            duplicateResolution: {
              in: [
                DuplicateResolution.UPDATE_EXISTING,
                DuplicateResolution.CREATE_DISTINCT,
              ],
            },
          },
        ],
      },
    }),
  ]);
  const completed = await prisma.dataImport.update({
    where: { id: importId },
    data: {
      completedAt: remainingRows ? null : new Date(),
      failureMessage: remainingRows
        ? `${remainingRows} ligne(s) n’ont pas pu être traitées. Vous pouvez relancer l’import.`
        : null,
      invalidRows,
      processedRows,
      status: remainingRows ? ImportStatus.READY : ImportStatus.COMPLETED,
    },
    select: { id: true, status: true },
  });
  await writeAuditLog(prisma, {
    action: remainingRows ? "IMPORT_PARTIALLY_FAILED" : "IMPORT_COMPLETED",
    actorUserId,
    entityId: importId,
    entityType: "import",
    metadata: { invalidRows, processedRows, remainingRows },
  });
  return completed;
}

export async function cancelImport(actorUserId: string, importId: string) {
  const cancelled = await prisma.dataImport.updateMany({
    where: {
      id: importId,
      status: { in: [ImportStatus.UPLOADED, ImportStatus.READY] },
    },
    data: {
      completedAt: new Date(),
      failureMessage: "Import annulé avant écriture définitive.",
      status: ImportStatus.FAILED,
    },
  });
  if (cancelled.count) {
    await writeAuditLog(prisma, {
      action: "IMPORT_CANCELLED",
      actorUserId,
      entityId: importId,
      entityType: "import",
    });
  }
  return Boolean(cancelled.count);
}

export function csvCell(value: string) {
  const safe = neutralizeCsvFormula(value);
  return `"${safe.replace(/"/g, '""')}"`;
}
