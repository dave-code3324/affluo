import {
  ContactDetailType,
  DetectionRunItemStatus,
  DetectionRunStatus,
  OpportunityOrigin,
  OpportunityReviewStatus,
  OpportunityStatus,
  SourceDocumentProcessingStatus,
  UserRole,
  VerificationStatus,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import {
  retryDetectionRun,
  startDetectionRun,
} from "@/modules/detection/pipeline/service";

const databaseDescribe =
  process.env.RUN_DATABASE_TESTS === "true" &&
  process.env.DETECTION_ENABLED === "true" &&
  process.env.DETECTION_SOURCE_BODACC_DEMO_ENABLED === "true"
    ? describe.sequential
    : describe.skip;

databaseDescribe("automated detection pipeline", () => {
  const adminId = randomUUID();
  const runIds: string[] = [];
  const opportunityIds: string[] = [];
  const prospectIds: string[] = [];
  const companyIds: string[] = [];
  let firstRunId = "";
  let firstItemId = "";

  beforeAll(async () => {
    const previousDocuments = await prisma.sourceDocument.findMany({
      where: { sourceKey: "BODACC_DEMO" },
      select: {
        id: true,
        signals: {
          select: {
            prospectId: true,
            opportunities: { select: { opportunityId: true } },
          },
        },
      },
    });
    const previousOpportunityIds = previousDocuments.flatMap(({ signals }) =>
      signals.flatMap(({ opportunities }) =>
        opportunities.map(({ opportunityId }) => opportunityId),
      ),
    );
    const previousProspectIds = previousDocuments.flatMap(({ signals }) =>
      signals.map(({ prospectId }) => prospectId),
    );
    await prisma.opportunity.deleteMany({
      where: { id: { in: previousOpportunityIds } },
    });
    await prisma.prospect.deleteMany({
      where: { id: { in: previousProspectIds } },
    });
    await prisma.detectionRun.deleteMany({
      where: { sourceKey: "BODACC_DEMO" },
    });
    await prisma.sourceDocument.deleteMany({
      where: { id: { in: previousDocuments.map(({ id }) => id) } },
    });
    await prisma.user.create({
      data: {
        id: adminId,
        email: `detection-admin-${adminId}@example.com`,
        role: UserRole.ADMIN,
      },
    });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { actorUserId: adminId } });
    await prisma.opportunity.deleteMany({
      where: { id: { in: opportunityIds } },
    });
    await prisma.prospect.deleteMany({
      where: { id: { in: prospectIds } },
    });
    await prisma.company.deleteMany({
      where: { id: { in: companyIds } },
    });
    await prisma.detectionRun.deleteMany({
      where: { id: { in: runIds } },
    });
    await prisma.sourceDocument.deleteMany({
      where: { sourceKey: "BODACC_DEMO" },
    });
    await prisma.user.delete({ where: { id: adminId } });
    await prisma.$disconnect();
  });

  it("collects a simulated source and creates an unassigned draft", async () => {
    const run = await startDetectionRun("BODACC_DEMO", adminId);
    firstRunId = run.id;
    runIds.push(run.id);
    expect(run).toMatchObject({
      status: DetectionRunStatus.COMPLETED,
      documentsCollected: 1,
      documentsProcessed: 1,
      signalsDetected: 1,
      opportunitiesCreated: 1,
    });

    const item = await prisma.detectionRunItem.findFirstOrThrow({
      where: { detectionRunId: run.id },
      include: {
        sourceDocument: {
          include: {
            signals: {
              include: {
                opportunities: true,
                prospect: { include: { contactDetails: true } },
              },
            },
          },
        },
      },
    });
    firstItemId = item.id;
    const signal = item.sourceDocument.signals[0]!;
    const opportunityId = signal.opportunities[0]!.opportunityId;
    opportunityIds.push(opportunityId);
    prospectIds.push(signal.prospectId);
    if (signal.prospect.companyId) {
      companyIds.push(signal.prospect.companyId);
    }

    const opportunity = await prisma.opportunity.findUniqueOrThrow({
      where: { id: opportunityId },
    });
    expect(opportunity).toMatchObject({
      origin: OpportunityOrigin.AUTOMATED_DETECTION,
      status: OpportunityStatus.DRAFT,
      reviewStatus: OpportunityReviewStatus.TO_REVIEW,
      firmId: null,
      weeklyBatchId: null,
      detectionRunId: run.id,
    });
    const linkedin = signal.prospect.contactDetails.find(
      ({ type }) => type === ContactDetailType.LINKEDIN,
    );
    expect(linkedin).toMatchObject({
      verificationStatus: VerificationStatus.UNVERIFIED,
      verifiedAt: null,
      verifiedByUserId: null,
    });
  });

  it("re-executes without duplicating the document or opportunity", async () => {
    const run = await startDetectionRun("BODACC_DEMO", adminId);
    runIds.push(run.id);
    expect(run).toMatchObject({
      status: DetectionRunStatus.COMPLETED,
      documentsCollected: 1,
      opportunitiesCreated: 0,
      opportunitiesIgnored: 1,
    });
    await expect(
      prisma.sourceDocument.count({
        where: { sourceKey: "BODACC_DEMO" },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.opportunity.count({
        where: { origin: OpportunityOrigin.AUTOMATED_DETECTION },
      }),
    ).resolves.toBe(1);
  });

  it("resumes a failed document without recreating its event", async () => {
    await prisma.$transaction([
      prisma.detectionRun.update({
        where: { id: firstRunId },
        data: { status: DetectionRunStatus.COMPLETED_WITH_ERRORS },
      }),
      prisma.detectionRunItem.update({
        where: { id: firstItemId },
        data: {
          attemptCount: 1,
          status: DetectionRunItemStatus.FAILED,
        },
      }),
      prisma.sourceDocument.updateMany({
        where: { runItems: { some: { id: firstItemId } } },
        data: {
          processingStatus: SourceDocumentProcessingStatus.FAILED,
        },
      }),
    ]);
    const retried = await retryDetectionRun(firstRunId, adminId);
    expect(retried.status).toBe(DetectionRunStatus.COMPLETED);
    await expect(
      prisma.opportunity.count({
        where: { origin: OpportunityOrigin.AUTOMATED_DETECTION },
      }),
    ).resolves.toBe(1);
  });

  it("keeps the automated opportunity visible to review but unpublished", async () => {
    const opportunity = await prisma.opportunity.findUniqueOrThrow({
      where: { id: opportunityIds[0] },
      include: { weeklyBatch: true },
    });
    expect(opportunity.reviewStatus).toBe(OpportunityReviewStatus.TO_REVIEW);
    expect(opportunity.status).toBe(OpportunityStatus.DRAFT);
    expect(opportunity.weeklyBatch).toBeNull();
  });
});
