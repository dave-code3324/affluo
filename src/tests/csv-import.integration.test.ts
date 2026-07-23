import {
  ContactDetailType,
  ContactabilityStatus,
  DuplicateResolution,
  ImportRowStatus,
  ImportStatus,
  OpportunityReviewStatus,
  OpportunityStatus,
  SignalVerificationStatus,
  UserRole,
  VerificationStatus,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import { isAdminUser } from "@/lib/permissions/admin";
import {
  createImportPreview,
  resolveImportDuplicate,
  runImport,
} from "@/modules/admin/imports/service";
import {
  approveOpportunity,
  manuallyVerifyLinkedin,
} from "@/modules/admin/review/service";

const databaseDescribe =
  process.env.RUN_DATABASE_TESTS === "true"
    ? describe.sequential
    : describe.skip;

const header = [
  "first_name",
  "last_name",
  "job_title",
  "company_name",
  "company_website",
  "city",
  "department",
  "professional_email",
  "professional_phone",
  "linkedin_url",
  "signal_type",
  "signal_title",
  "signal_description",
  "event_date",
  "source_name",
  "source_url",
  "source_published_at",
  "why_now",
  "potential_needs",
  "email_verification_status",
  "phone_verification_status",
  "linkedin_verification_status",
  "confidence_level",
  "notes",
].join(",");

databaseDescribe("CSV import and internal review", () => {
  const suffix = randomUUID();
  const adminId = randomUUID();
  const memberId = randomUUID();
  const createdImportIds: string[] = [];
  let importedProspectId = "";
  let importedOpportunityId = "";
  const importedEmail = `admin-import-${suffix}@example.com`;
  let manualProspectId = "";

  function validCsv(jobTitle = "Présidente") {
    const row = [
      "Alice",
      "Import",
      jobTitle,
      `Entreprise ${suffix}`,
      `https://${suffix}.example.test`,
      "Lyon",
      "69",
      importedEmail,
      "",
      `https://www.linkedin.com/in/demo-${suffix}`,
      "Gouvernance",
      "Cession annoncée",
      "Une cession partielle a été annoncée",
      "2026-09-08",
      "Source fictive",
      `https://${suffix}.example.test/source`,
      "2026-09-08",
      "Cet événement peut justifier une réflexion patrimoniale",
      "diversification|transmission",
      "VERIFIED",
      "UNVERIFIED",
      "LIKELY",
      "HIGH",
      "Note interne",
    ].join(",");
    return `${header}\n${row}`;
  }

  beforeAll(async () => {
    await prisma.user.createMany({
      data: [
        {
          id: adminId,
          email: `admin-${suffix}@example.com`,
          role: UserRole.ADMIN,
        },
        {
          id: memberId,
          email: `member-${suffix}@example.com`,
          role: UserRole.MEMBER,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: { actorUserId: { in: [adminId, memberId] } },
    });
    await prisma.dataImport.deleteMany({
      where: { id: { in: createdImportIds } },
    });
    const prospectIds = [importedProspectId, manualProspectId].filter(Boolean);
    if (prospectIds.length) {
      await prisma.opportunity.deleteMany({
        where: { prospectId: { in: prospectIds } },
      });
      await prisma.prospect.deleteMany({
        where: { id: { in: prospectIds } },
      });
    }
    await prisma.company.deleteMany({
      where: { name: `Entreprise ${suffix}` },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [adminId, memberId] } },
    });
    await prisma.$disconnect();
  });

  it("distinguishes an administrator from a member", async () => {
    await expect(isAdminUser(adminId)).resolves.toBe(true);
    await expect(isAdminUser(memberId)).resolves.toBe(false);
  });

  it("creates a preview and rejects an invalid file structure", async () => {
    const ready = await createImportPreview({
      actorUserId: adminId,
      content: validCsv(),
      filename: "valid.csv",
    });
    createdImportIds.push(ready.id);
    expect(ready).toMatchObject({
      status: ImportStatus.READY,
      totalRows: 1,
      validRows: 1,
      invalidRows: 0,
    });

    const invalid = await createImportPreview({
      actorUserId: adminId,
      content: "first_name,last_name\nAlice,Import",
      filename: "invalid.csv",
    });
    createdImportIds.push(invalid.id);
    expect(invalid.status).toBe(ImportStatus.FAILED);
    expect(invalid.failureMessage).toContain("Colonnes obligatoires");
  });

  it("imports valid rows as draft and remains idempotent when relaunched", async () => {
    const readyImportId = createdImportIds[0]!;
    await runImport(adminId, readyImportId);
    const row = await prisma.importRow.findFirstOrThrow({
      where: { importId: readyImportId },
      select: {
        status: true,
        createdProspectId: true,
        createdOpportunityId: true,
      },
    });
    importedProspectId = row.createdProspectId!;
    importedOpportunityId = row.createdOpportunityId!;
    expect(row.status).toBe(ImportRowStatus.IMPORTED);

    const opportunity = await prisma.opportunity.findUniqueOrThrow({
      where: { id: importedOpportunityId },
      select: {
        status: true,
        reviewStatus: true,
        firmId: true,
        weeklyBatchId: true,
      },
    });
    expect(opportunity).toEqual({
      status: OpportunityStatus.DRAFT,
      reviewStatus: OpportunityReviewStatus.TO_REVIEW,
      firmId: null,
      weeklyBatchId: null,
    });

    await runImport(adminId, readyImportId);
    await expect(
      prisma.importRow.count({
        where: {
          importId: readyImportId,
          status: ImportRowStatus.IMPORTED,
        },
      }),
    ).resolves.toBe(1);
  });

  it("updates an existing prospect only after duplicate resolution", async () => {
    const preview = await createImportPreview({
      actorUserId: adminId,
      content: validCsv("Directrice générale"),
      filename: "duplicate.csv",
    });
    createdImportIds.push(preview.id);
    const duplicate = await prisma.importRow.findFirstOrThrow({
      where: { importId: preview.id },
      select: {
        id: true,
        status: true,
        duplicateOfProspectId: true,
      },
    });
    expect(duplicate).toMatchObject({
      status: ImportRowStatus.DUPLICATE,
      duplicateOfProspectId: importedProspectId,
    });

    await resolveImportDuplicate({
      actorUserId: adminId,
      importId: preview.id,
      resolution: DuplicateResolution.UPDATE_EXISTING,
      rowId: duplicate.id,
    });
    await runImport(adminId, preview.id);
    await expect(
      prisma.prospect.findUnique({
        where: { id: importedProspectId },
        select: { jobTitle: true },
      }),
    ).resolves.toEqual({ jobTitle: "Directrice générale" });
  });

  it("records sensitive import actions in the audit log", async () => {
    const actions = await prisma.auditLog.findMany({
      where: { actorUserId: adminId },
      select: { action: true },
    });
    expect(actions.map(({ action }) => action)).toEqual(
      expect.arrayContaining([
        "IMPORT_PREVIEW_CREATED",
        "IMPORT_STARTED",
        "OPPORTUNITY_CREATED_FOR_REVIEW",
        "IMPORT_DUPLICATE_RESOLVED",
      ]),
    );
  });

  it("refuses approval of a non-contactable opportunity", async () => {
    const prospect = await prisma.prospect.create({
      data: {
        firstName: "Noémie",
        lastName: "SansContact",
        jobTitle: "Gérante",
        companyName: `Entreprise ${suffix}`,
        city: "Lyon",
        department: "69",
      },
    });
    manualProspectId = prospect.id;
    const signal = await prisma.signal.create({
      data: {
        prospectId: prospect.id,
        type: "Gouvernance",
        title: "Signal sourcé",
        description: "Un changement de direction a été annoncé.",
        detectedAt: new Date(),
        sourceName: "Source fictive",
        sourceUrl: "https://example.com/source",
        verificationStatus: SignalVerificationStatus.UNVERIFIED,
      },
    });
    const opportunity = await prisma.opportunity.create({
      data: {
        prospectId: prospect.id,
        title: "Signal sourcé",
        signalType: "Gouvernance",
        signalSummary: signal.description,
        whyNow: "Ce changement peut justifier une prise de contact.",
        relevanceScore: 0,
        contactabilityStatus: ContactabilityStatus.NOT_CONTACTABLE,
        status: OpportunityStatus.DRAFT,
        reviewStatus: OpportunityReviewStatus.IN_REVIEW,
        signals: {
          create: { signalId: signal.id, isPrimary: true },
        },
      },
    });
    const result = await approveOpportunity(adminId, opportunity.id);
    expect(result).toMatchObject({ allowed: false });
    await expect(
      prisma.opportunity.findUnique({
        where: { id: opportunity.id },
        select: { reviewStatus: true },
      }),
    ).resolves.toEqual({ reviewStatus: OpportunityReviewStatus.IN_REVIEW });
  });

  it("traces an explicit manual LinkedIn verification", async () => {
    const contact = await prisma.contactDetail.findFirstOrThrow({
      where: {
        prospectId: importedProspectId,
        type: ContactDetailType.LINKEDIN,
      },
    });
    await manuallyVerifyLinkedin(adminId, importedOpportunityId, contact.id);
    await expect(
      prisma.contactDetail.findUnique({
        where: { id: contact.id },
        select: {
          verificationStatus: true,
          verifiedByUserId: true,
          verificationMethod: true,
        },
      }),
    ).resolves.toMatchObject({
      verificationStatus: VerificationStatus.VERIFIED,
      verifiedByUserId: adminId,
      verificationMethod: "Vérification manuelle par l’équipe Affluo",
    });
  });
});
