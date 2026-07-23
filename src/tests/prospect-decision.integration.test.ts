import {
  ConfidenceLevel,
  ContactDetailType,
  ContactabilityStatus,
  FeedbackDecision,
  FeedbackReason,
  OpportunityStatus,
  OpportunityReviewStatus,
  SignalVerificationStatus,
  VerificationStatus,
  WeeklyBatchStatus,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { saveOpportunityDecision } from "@/modules/opportunities/mutations";
import { getPublishedOpportunityDetail } from "@/modules/opportunities/queries";

const databaseDescribe =
  process.env.RUN_DATABASE_TESTS === "true"
    ? describe.sequential
    : describe.skip;

databaseDescribe("prospect decision persistence", () => {
  const ids = {
    userA: randomUUID(),
    userB: randomUUID(),
    firmA: randomUUID(),
    firmB: randomUUID(),
    prospectA: randomUUID(),
    prospectB: randomUUID(),
    opportunityA: randomUUID(),
    opportunityB: randomUUID(),
    signalA: randomUUID(),
  };

  beforeAll(async () => {
    await prisma.user.createMany({
      data: [
        { id: ids.userA, email: `${ids.userA}@example.com` },
        { id: ids.userB, email: `${ids.userB}@example.com` },
      ],
    });
    await prisma.firm.createMany({
      data: [
        {
          id: ids.firmA,
          name: "Cabinet test A",
          city: "Lyon",
          department: "69",
        },
        {
          id: ids.firmB,
          name: "Cabinet test B",
          city: "Paris",
          department: "75",
        },
      ],
    });
    await prisma.firmMember.createMany({
      data: [
        { firmId: ids.firmA, userId: ids.userA, role: "owner" },
        { firmId: ids.firmB, userId: ids.userB, role: "owner" },
      ],
    });
    const batchA = await prisma.weeklyBatch.create({
      data: {
        firmId: ids.firmA,
        weekStart: new Date("2026-09-07T00:00:00.000Z"),
        weekEnd: new Date("2026-09-13T00:00:00.000Z"),
        status: WeeklyBatchStatus.PUBLISHED,
        publishedAt: new Date("2026-09-07T07:00:00.000Z"),
      },
    });
    const batchB = await prisma.weeklyBatch.create({
      data: {
        firmId: ids.firmB,
        weekStart: new Date("2026-09-07T00:00:00.000Z"),
        weekEnd: new Date("2026-09-13T00:00:00.000Z"),
        status: WeeklyBatchStatus.PUBLISHED,
        publishedAt: new Date("2026-09-07T07:00:00.000Z"),
      },
    });
    await prisma.prospect.createMany({
      data: [
        {
          id: ids.prospectA,
          firstName: "Alice",
          lastName: "Décision",
          jobTitle: "Présidente",
          companyName: "Entreprise Test",
          city: "Lyon",
          department: "69",
          professionalProfileSummary: "Profil professionnel documenté.",
        },
        {
          id: ids.prospectB,
          firstName: "Benoît",
          lastName: "Isolation",
          jobTitle: "Gérant",
          companyName: "Autre Entreprise",
          city: "Paris",
          department: "75",
        },
      ],
    });
    await prisma.contactDetail.createMany({
      data: [
        {
          prospectId: ids.prospectA,
          type: ContactDetailType.PROFESSIONAL_EMAIL,
          value: "alice@example.com",
          verificationStatus: VerificationStatus.VERIFIED,
          verificationMethod: "Contrôle manuel",
          verifiedAt: new Date("2026-09-06T10:00:00.000Z"),
          isPrimary: true,
        },
        {
          prospectId: ids.prospectA,
          type: ContactDetailType.PROFESSIONAL_PHONE,
          value: "donnée-invalide",
          verificationStatus: VerificationStatus.INVALID,
          isPrimary: false,
        },
        {
          prospectId: ids.prospectB,
          type: ContactDetailType.PROFESSIONAL_EMAIL,
          value: "benoit@example.com",
          verificationStatus: VerificationStatus.VERIFIED,
          verifiedAt: new Date("2026-09-06T10:00:00.000Z"),
          isPrimary: true,
        },
      ],
    });
    await prisma.opportunity.createMany({
      data: [
        {
          id: ids.opportunityA,
          firmId: ids.firmA,
          weeklyBatchId: batchA.id,
          prospectId: ids.prospectA,
          title: "Décision à prendre",
          signalType: "Capital",
          signalSummary: "Cession partielle annoncée",
          whyNow: "L’événement peut créer un besoin de diversification.",
          relevanceScore: 95,
          contactabilityStatus: ContactabilityStatus.CONTACTABLE,
          status: OpportunityStatus.PUBLISHED,
          reviewStatus: OpportunityReviewStatus.APPROVED,
          confidenceLevel: ConfidenceLevel.HIGH,
          qualificationSummary: "Profil prioritaire du cabinet.",
          potentialNeeds: ["Diversification du patrimoine"],
        },
        {
          id: ids.opportunityB,
          firmId: ids.firmB,
          weeklyBatchId: batchB.id,
          prospectId: ids.prospectB,
          title: "Opportunité privée",
          signalType: "Capital",
          signalSummary: "Signal privé",
          whyNow: "Interprétation privée.",
          relevanceScore: 90,
          contactabilityStatus: ContactabilityStatus.CONTACTABLE,
          status: OpportunityStatus.PUBLISHED,
          reviewStatus: OpportunityReviewStatus.APPROVED,
        },
      ],
    });
    await prisma.signal.create({
      data: {
        id: ids.signalA,
        prospectId: ids.prospectA,
        type: "Capital",
        title: "Cession publiée",
        description: "Une cession a été annoncée publiquement.",
        eventDate: new Date("2026-09-08T00:00:00.000Z"),
        detectedAt: new Date("2026-09-08T08:00:00.000Z"),
        sourceUrl: "https://example.com/source",
        sourceName: "Source de test",
        sourcePublishedAt: new Date("2026-09-08T07:00:00.000Z"),
        verificationStatus: SignalVerificationStatus.VERIFIED,
        verifiedAt: new Date("2026-09-08T09:00:00.000Z"),
      },
    });
    await prisma.opportunitySignal.create({
      data: {
        opportunityId: ids.opportunityA,
        signalId: ids.signalA,
        isPrimary: true,
      },
    });
  });

  afterAll(async () => {
    await prisma.firm.deleteMany({
      where: { id: { in: [ids.firmA, ids.firmB] } },
    });
    await prisma.prospect.deleteMany({
      where: { id: { in: [ids.prospectA, ids.prospectB] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [ids.userA, ids.userB] } },
    });
    await prisma.$disconnect();
  });

  it("returns a complete sheet and excludes invalid contact details", async () => {
    const detail = await getPublishedOpportunityDetail({
      firmId: ids.firmA,
      opportunityId: ids.opportunityA,
    });

    expect(detail?.signals[0]?.source?.name).toBe("Source de test");
    expect(detail?.hypotheses.items).toEqual(["Diversification du patrimoine"]);
    expect(detail?.contactDetails).toHaveLength(1);
    expect(detail?.contactDetails[0]?.value).toBe("alice@example.com");
  });

  it("returns no detail for another firm's opportunity", async () => {
    await expect(
      getPublishedOpportunityDetail({
        firmId: ids.firmA,
        opportunityId: ids.opportunityB,
      }),
    ).resolves.toBeNull();
  });

  it("creates and then modifies one persisted decision", async () => {
    const created = await saveOpportunityDecision({
      decision: FeedbackDecision.TO_CONTACT,
      firmId: ids.firmA,
      opportunityId: ids.opportunityA,
      reason: null,
      userId: ids.userA,
    });
    expect(created?.decision).toBe(FeedbackDecision.TO_CONTACT);

    const updated = await saveOpportunityDecision({
      decision: FeedbackDecision.NOT_RELEVANT,
      firmId: ids.firmA,
      opportunityId: ids.opportunityA,
      reason: FeedbackReason.ALREADY_KNOWN,
      userId: ids.userA,
    });
    expect(updated).toMatchObject({
      decision: FeedbackDecision.NOT_RELEVANT,
      reason: FeedbackReason.ALREADY_KNOWN,
    });
    await expect(
      prisma.opportunityFeedback.count({
        where: { opportunityId: ids.opportunityA },
      }),
    ).resolves.toBe(1);
  });

  it("refuses a decision for another firm's opportunity", async () => {
    await expect(
      saveOpportunityDecision({
        decision: FeedbackDecision.TO_CONTACT,
        firmId: ids.firmA,
        opportunityId: ids.opportunityB,
        reason: null,
        userId: ids.userA,
      }),
    ).resolves.toBeNull();
  });
});
