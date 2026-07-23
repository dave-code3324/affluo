import {
  ContactabilityStatus,
  OpportunityStatus,
  VerificationStatus,
  WeeklyBatchStatus,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import {
  getLatestPublishedSelection,
  getPublishedOpportunityDetail,
} from "@/modules/opportunities/queries";

const databaseDescribe =
  process.env.RUN_DATABASE_TESTS === "true"
    ? describe.sequential
    : describe.skip;

const createdFirmIds: string[] = [];
const createdProspectIds: string[] = [];

async function createFirm(name: string) {
  const firm = await prisma.firm.create({
    data: {
      name,
      city: "Lyon",
      department: "69",
      onboardingCompletedAt: new Date(),
    },
  });
  createdFirmIds.push(firm.id);
  return firm;
}

async function createProspect(suffix: string, contactable = true) {
  const prospect = await prisma.prospect.create({
    data: {
      firstName: "Camille",
      lastName: suffix,
      jobTitle: "Dirigeante",
      companyName: `Entreprise ${suffix}`,
      city: "Lyon",
      department: "69",
      linkedinUrl: contactable
        ? `https://www.linkedin.com/in/${suffix.toLowerCase()}`
        : null,
      professionalEmail: null,
      emailVerificationStatus: VerificationStatus.UNVERIFIED,
    },
  });
  createdProspectIds.push(prospect.id);
  return prospect;
}

async function createBatch({
  firmId,
  status,
  weekStart,
}: {
  firmId: string;
  status: WeeklyBatchStatus;
  weekStart: string;
}) {
  return prisma.weeklyBatch.create({
    data: {
      firmId,
      weekStart: new Date(`${weekStart}T00:00:00.000Z`),
      weekEnd: new Date(
        new Date(`${weekStart}T00:00:00.000Z`).getTime() +
          6 * 24 * 60 * 60 * 1_000,
      ),
      status,
      publishedAt: status === WeeklyBatchStatus.PUBLISHED ? new Date() : null,
    },
  });
}

async function createOpportunity({
  batchId,
  firmId,
  prospectId,
  status = OpportunityStatus.PUBLISHED,
  contactabilityStatus = ContactabilityStatus.CONTACTABLE,
}: {
  batchId: string;
  firmId: string;
  prospectId: string;
  status?: OpportunityStatus;
  contactabilityStatus?: ContactabilityStatus;
}) {
  return prisma.opportunity.create({
    data: {
      firmId,
      weeklyBatchId: batchId,
      prospectId,
      title: "Signal test",
      signalType: "Gouvernance",
      signalSummary: "Un changement significatif est détecté",
      whyNow: "Le moment est pertinent pour initier une conversation.",
      relevanceScore: 90,
      status,
      contactabilityStatus,
    },
  });
}

databaseDescribe("weekly opportunity queries", () => {
  afterAll(async () => {
    if (createdFirmIds.length) {
      await prisma.firm.deleteMany({ where: { id: { in: createdFirmIds } } });
    }
    if (createdProspectIds.length) {
      await prisma.prospect.deleteMany({
        where: { id: { in: createdProspectIds } },
      });
    }
    await prisma.$disconnect();
  });

  it("returns the latest published batch and ignores a newer draft", async () => {
    const firm = await createFirm(`Latest ${randomUUID()}`);
    const published = await createBatch({
      firmId: firm.id,
      status: WeeklyBatchStatus.PUBLISHED,
      weekStart: "2026-07-06",
    });
    await createBatch({
      firmId: firm.id,
      status: WeeklyBatchStatus.DRAFT,
      weekStart: "2026-07-13",
    });
    const prospect = await createProspect(`Latest-${randomUUID()}`);
    await createOpportunity({
      batchId: published.id,
      firmId: firm.id,
      prospectId: prospect.id,
    });

    const selection = await getLatestPublishedSelection({ firmId: firm.id });

    expect(selection.kind).toBe("published");
    if (selection.kind === "published") {
      expect(selection.batch.id).toBe(published.id);
      expect(selection.opportunities).toHaveLength(1);
    }
  });

  it("excludes draft and non-contactable opportunities", async () => {
    const firm = await createFirm(`Visibility ${randomUUID()}`);
    const batch = await createBatch({
      firmId: firm.id,
      status: WeeklyBatchStatus.PUBLISHED,
      weekStart: "2026-06-30",
    });
    const visible = await createProspect(`Visible-${randomUUID()}`);
    const draft = await createProspect(`Draft-${randomUUID()}`);
    const unreachable = await createProspect(
      `Unreachable-${randomUUID()}`,
      false,
    );
    await createOpportunity({
      batchId: batch.id,
      firmId: firm.id,
      prospectId: visible.id,
    });
    await createOpportunity({
      batchId: batch.id,
      firmId: firm.id,
      prospectId: draft.id,
      status: OpportunityStatus.DRAFT,
    });
    await createOpportunity({
      batchId: batch.id,
      firmId: firm.id,
      prospectId: unreachable.id,
      status: OpportunityStatus.DRAFT,
      contactabilityStatus: ContactabilityStatus.NOT_CONTACTABLE,
    });

    const selection = await getLatestPublishedSelection({ firmId: firm.id });

    expect(selection.kind).toBe("published");
    if (selection.kind === "published") {
      expect(selection.batch.opportunityCount).toBe(1);
      expect(selection.opportunities[0]?.lastName).toContain("Visible");
    }
  });

  it("never exposes another firm's opportunity", async () => {
    const firmA = await createFirm(`Firm A ${randomUUID()}`);
    const firmB = await createFirm(`Firm B ${randomUUID()}`);
    const batchB = await createBatch({
      firmId: firmB.id,
      status: WeeklyBatchStatus.PUBLISHED,
      weekStart: "2026-06-23",
    });
    const prospectB = await createProspect(`Tenant-${randomUUID()}`);
    const opportunityB = await createOpportunity({
      batchId: batchB.id,
      firmId: firmB.id,
      prospectId: prospectB.id,
    });

    await expect(
      getPublishedOpportunityDetail({
        firmId: firmA.id,
        opportunityId: opportunityB.id,
      }),
    ).resolves.toBeNull();
  });

  it("returns a preparation state when the firm has no published batch", async () => {
    const firm = await createFirm(`None ${randomUUID()}`);
    await createBatch({
      firmId: firm.id,
      status: WeeklyBatchStatus.DRAFT,
      weekStart: "2026-06-16",
    });

    await expect(
      getLatestPublishedSelection({ firmId: firm.id }),
    ).resolves.toEqual({ kind: "none" });
  });
});
