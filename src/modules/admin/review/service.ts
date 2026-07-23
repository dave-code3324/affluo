import {
  ContactDetailType,
  ContactabilityStatus,
  OpportunityRejectionReason,
  OpportunityReviewStatus,
  OpportunityStatus,
  Prisma,
  SignalVerificationStatus,
  VerificationStatus,
} from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/modules/admin/audit";
import {
  comparisonKey,
  normalizedDomain,
} from "@/modules/admin/imports/normalization";
import {
  approvalReadiness,
  reviewCorrectionSchema,
} from "@/modules/admin/review/domain";
import type { z } from "zod";

type ReviewFilter =
  | "TO_REVIEW"
  | "INCOMPLETE"
  | "APPROVED"
  | "REJECTED"
  | "INSUFFICIENT_CONTACT"
  | "SIGNAL_TO_VERIFY";

type ReviewSort =
  "IMPORTED_DESC" | "EVENT_DESC" | "CONTACTABILITY_DESC" | "CONFIDENCE_DESC";

function reviewWhere(filter: ReviewFilter): Prisma.OpportunityWhereInput {
  const base: Prisma.OpportunityWhereInput = {
    status: OpportunityStatus.DRAFT,
  };
  switch (filter) {
    case "INCOMPLETE":
      return { ...base, reviewStatus: OpportunityReviewStatus.NEEDS_CHANGES };
    case "APPROVED":
      return { ...base, reviewStatus: OpportunityReviewStatus.APPROVED };
    case "REJECTED":
      return { ...base, reviewStatus: OpportunityReviewStatus.REJECTED };
    case "INSUFFICIENT_CONTACT":
      return {
        ...base,
        contactabilityStatus: ContactabilityStatus.NOT_CONTACTABLE,
      };
    case "SIGNAL_TO_VERIFY":
      return {
        ...base,
        signals: {
          some: {
            signal: {
              verificationStatus: SignalVerificationStatus.UNVERIFIED,
            },
          },
        },
      };
    default:
      return {
        ...base,
        reviewStatus: {
          in: [
            OpportunityReviewStatus.TO_REVIEW,
            OpportunityReviewStatus.IN_REVIEW,
          ],
        },
      };
  }
}

export async function getReviewQueue({
  filter,
  sort,
}: {
  filter: ReviewFilter;
  sort: ReviewSort;
}) {
  const records = await prisma.opportunity.findMany({
    where: reviewWhere(filter),
    take: 250,
    orderBy:
      sort === "CONFIDENCE_DESC"
        ? { confidenceLevel: "desc" }
        : sort === "CONTACTABILITY_DESC"
          ? { contactabilityStatus: "desc" }
          : { createdAt: "desc" },
    select: {
      id: true,
      confidenceLevel: true,
      contactabilityStatus: true,
      origin: true,
      automaticScore: true,
      reviewStatus: true,
      createdAt: true,
      prospect: {
        select: {
          firstName: true,
          lastName: true,
          companyName: true,
          city: true,
          department: true,
        },
      },
      signals: {
        where: { isPrimary: true },
        take: 1,
        select: {
          signal: {
            select: {
              type: true,
              eventDate: true,
              verificationStatus: true,
            },
          },
        },
      },
      createdImportRow: {
        select: {
          createdAt: true,
          dataImport: { select: { filename: true } },
        },
      },
      detectionRun: {
        select: { id: true, sourceKey: true, createdAt: true },
      },
    },
  });

  if (sort === "EVENT_DESC") {
    records.sort(
      (left, right) =>
        (right.signals[0]?.signal.eventDate?.getTime() ?? 0) -
        (left.signals[0]?.signal.eventDate?.getTime() ?? 0),
    );
  }
  return records;
}

export async function getAdminReviewDetail(opportunityId: string) {
  return prisma.opportunity.findFirst({
    where: {
      id: opportunityId,
      status: OpportunityStatus.DRAFT,
    },
    select: {
      id: true,
      title: true,
      whyNow: true,
      qualificationSummary: true,
      potentialNeeds: true,
      internalNotes: true,
      confidenceLevel: true,
      contactabilityStatus: true,
      origin: true,
      automaticScore: true,
      automaticConfidence: true,
      reviewStatus: true,
      rejectionReason: true,
      reviewedAt: true,
      prospect: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          jobTitle: true,
          companyName: true,
          city: true,
          department: true,
          company: {
            select: { id: true, website: true },
          },
          contactDetails: {
            orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
            select: {
              id: true,
              type: true,
              value: true,
              verificationStatus: true,
              verificationMethod: true,
              verifiedAt: true,
              verifiedByUserId: true,
            },
          },
        },
      },
      signals: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        select: {
          isPrimary: true,
          signal: {
            select: {
              id: true,
              type: true,
              title: true,
              description: true,
              eventDate: true,
              sourceName: true,
              sourceUrl: true,
              sourcePublishedAt: true,
              verificationStatus: true,
              verifiedAt: true,
            },
          },
        },
      },
      createdImportRow: {
        select: {
          rowNumber: true,
          dataImport: {
            select: { id: true, filename: true, createdAt: true },
          },
        },
      },
      detectionRun: {
        select: { id: true, sourceKey: true, createdAt: true },
      },
    },
  });
}

export async function takeOpportunityForReview(
  actorUserId: string,
  opportunityId: string,
) {
  const updated = await prisma.opportunity.updateMany({
    where: {
      id: opportunityId,
      status: OpportunityStatus.DRAFT,
      reviewStatus: {
        in: [
          OpportunityReviewStatus.TO_REVIEW,
          OpportunityReviewStatus.NEEDS_CHANGES,
        ],
      },
    },
    data: {
      reviewedByUserId: actorUserId,
      reviewStatus: OpportunityReviewStatus.IN_REVIEW,
    },
  });
  if (updated.count) {
    await writeAuditLog(prisma, {
      action: "OPPORTUNITY_REVIEW_STARTED",
      actorUserId,
      entityId: opportunityId,
      entityType: "opportunity",
      newData: { reviewStatus: OpportunityReviewStatus.IN_REVIEW },
    });
  }
  return Boolean(updated.count);
}

type Corrections = z.infer<typeof reviewCorrectionSchema>;

async function syncContact(
  transaction: Prisma.TransactionClient,
  {
    actorUserId,
    prospectId,
    type,
    value,
    status,
  }: {
    actorUserId: string;
    prospectId: string;
    status: VerificationStatus;
    type: ContactDetailType;
    value: string;
  },
) {
  const existing = await transaction.contactDetail.findFirst({
    where: { prospectId, type, isPrimary: true },
    orderBy: { createdAt: "asc" },
  });

  if (!value) {
    if (existing) {
      await transaction.contactDetail.update({
        where: { id: existing.id },
        data: { verificationStatus: VerificationStatus.INVALID },
      });
    }
    return;
  }

  const safeStatus =
    type === ContactDetailType.LINKEDIN &&
    (!existing || existing.value !== value)
      ? VerificationStatus.UNVERIFIED
      : status;
  const saved = existing
    ? await transaction.contactDetail.update({
        where: { id: existing.id },
        data: {
          value,
          verificationStatus: safeStatus,
          verifiedAt:
            safeStatus === VerificationStatus.VERIFIED
              ? existing.verifiedAt
              : null,
          verifiedByUserId:
            safeStatus === VerificationStatus.VERIFIED
              ? existing.verifiedByUserId
              : null,
        },
      })
    : await transaction.contactDetail.create({
        data: {
          isPrimary: true,
          prospectId,
          type,
          value,
          verificationStatus: safeStatus,
        },
      });

  await writeAuditLog(transaction, {
    action: "CONTACT_CORRECTED",
    actorUserId,
    entityId: saved.id,
    entityType: "contact_detail",
    newData: {
      type,
      verificationStatus: safeStatus,
    },
  });
}

export async function saveReviewCorrections(
  actorUserId: string,
  corrections: Corrections,
) {
  const current = await prisma.opportunity.findFirst({
    where: {
      id: corrections.opportunityId,
      status: OpportunityStatus.DRAFT,
    },
    select: {
      id: true,
      prospectId: true,
      prospect: { select: { companyId: true } },
      reviewStatus: true,
      createdImportRow: { select: { id: true, importId: true } },
      signals: {
        where: { signalId: corrections.signal.id },
        select: { signalId: true },
      },
    },
  });
  if (!current || !current.signals.length) {
    return null;
  }

  await prisma.$transaction(async (transaction) => {
    const companyId = current.prospect.companyId;
    if (companyId) {
      await transaction.company.update({
        where: { id: companyId },
        data: {
          legalName: corrections.prospect.companyName,
          name: corrections.prospect.companyName,
          normalizedDomain: normalizedDomain(
            corrections.prospect.companyWebsite || null,
          ),
          normalizedName: comparisonKey(corrections.prospect.companyName),
          website: corrections.prospect.companyWebsite || null,
        },
      });
    }
    await transaction.prospect.update({
      where: { id: current.prospectId },
      data: {
        city: corrections.prospect.city,
        companyName: corrections.prospect.companyName,
        department: corrections.prospect.department,
        firstName: corrections.prospect.firstName,
        jobTitle: corrections.prospect.jobTitle,
        lastName: corrections.prospect.lastName,
        linkedinUrl: corrections.contacts.linkedinUrl || null,
        professionalEmail: corrections.contacts.email || null,
      },
    });
    await transaction.signal.update({
      where: { id: corrections.signal.id },
      data: {
        description: corrections.signal.description,
        eventDate: new Date(`${corrections.signal.eventDate}T00:00:00.000Z`),
        sourceName: corrections.signal.sourceName,
        sourcePublishedAt: corrections.signal.sourcePublishedAt
          ? new Date(`${corrections.signal.sourcePublishedAt}T00:00:00.000Z`)
          : null,
        sourceUrl: corrections.signal.sourceUrl,
        title: corrections.signal.title,
        type: corrections.signal.type,
        verificationStatus: corrections.signal.verificationStatus,
        verifiedAt:
          corrections.signal.verificationStatus ===
          SignalVerificationStatus.VERIFIED
            ? new Date()
            : null,
      },
    });
    await transaction.opportunity.update({
      where: { id: current.id },
      data: {
        confidenceLevel: corrections.opportunity.confidenceLevel,
        contactabilityStatus: corrections.opportunity.contactabilityStatus,
        internalNotes: corrections.opportunity.internalNotes || null,
        potentialNeeds: corrections.opportunity.potentialNeeds,
        qualificationSummary:
          corrections.opportunity.qualificationSummary || null,
        reviewStatus:
          current.reviewStatus === OpportunityReviewStatus.TO_REVIEW
            ? OpportunityReviewStatus.IN_REVIEW
            : current.reviewStatus,
        reviewedByUserId: actorUserId,
        signalSummary: corrections.signal.description,
        signalType: corrections.signal.type,
        title: corrections.signal.title,
        whyNow: corrections.opportunity.whyNow,
      },
    });
    await syncContact(transaction, {
      actorUserId,
      prospectId: current.prospectId,
      status: corrections.contacts.emailStatus,
      type: ContactDetailType.PROFESSIONAL_EMAIL,
      value: corrections.contacts.email,
    });
    await syncContact(transaction, {
      actorUserId,
      prospectId: current.prospectId,
      status: corrections.contacts.phoneStatus,
      type: ContactDetailType.PROFESSIONAL_PHONE,
      value: corrections.contacts.phone,
    });
    const currentLinkedin = await transaction.contactDetail.findFirst({
      where: {
        prospectId: current.prospectId,
        type: ContactDetailType.LINKEDIN,
        isPrimary: true,
      },
      select: { verificationStatus: true },
    });
    await syncContact(transaction, {
      actorUserId,
      prospectId: current.prospectId,
      status:
        currentLinkedin?.verificationStatus ?? VerificationStatus.UNVERIFIED,
      type: ContactDetailType.LINKEDIN,
      value: corrections.contacts.linkedinUrl,
    });
    await writeAuditLog(transaction, {
      action: "PROSPECT_CORRECTED",
      actorUserId,
      entityId: current.prospectId,
      entityType: "prospect",
      newData: {
        fields: ["identity", "company", "location"],
      },
      metadata: { opportunityId: current.id },
    });
    await writeAuditLog(transaction, {
      action: "SIGNAL_CORRECTED",
      actorUserId,
      entityId: corrections.signal.id,
      entityType: "signal",
      newData: {
        verificationStatus: corrections.signal.verificationStatus,
      },
      metadata: { opportunityId: current.id },
    });
    await writeAuditLog(transaction, {
      action: "OPPORTUNITY_CORRECTED",
      actorUserId,
      entityId: current.id,
      entityType: "opportunity",
      previousData: { reviewStatus: current.reviewStatus },
      newData: {
        reviewStatus:
          current.reviewStatus === OpportunityReviewStatus.TO_REVIEW
            ? OpportunityReviewStatus.IN_REVIEW
            : current.reviewStatus,
      },
    });
    if (current.createdImportRow) {
      await writeAuditLog(transaction, {
        action: "IMPORT_ROW_CORRECTED_DURING_REVIEW",
        actorUserId,
        entityId: current.createdImportRow.id,
        entityType: "import_row",
        newData: {
          fields: ["prospect", "signal", "contacts", "opportunity"],
        },
        metadata: {
          importId: current.createdImportRow.importId,
          opportunityId: current.id,
        },
      });
    }
  });

  return { id: current.id };
}

export async function requestOpportunityChanges(
  actorUserId: string,
  opportunityId: string,
) {
  const updated = await prisma.opportunity.updateMany({
    where: { id: opportunityId, status: OpportunityStatus.DRAFT },
    data: {
      reviewedByUserId: actorUserId,
      reviewStatus: OpportunityReviewStatus.NEEDS_CHANGES,
    },
  });
  if (updated.count) {
    await writeAuditLog(prisma, {
      action: "OPPORTUNITY_CHANGES_REQUESTED",
      actorUserId,
      entityId: opportunityId,
      entityType: "opportunity",
      newData: { reviewStatus: OpportunityReviewStatus.NEEDS_CHANGES },
    });
  }
  return Boolean(updated.count);
}

export async function approveOpportunity(
  actorUserId: string,
  opportunityId: string,
) {
  const candidate = await prisma.opportunity.findFirst({
    where: { id: opportunityId, status: OpportunityStatus.DRAFT },
    select: {
      id: true,
      whyNow: true,
      contactabilityStatus: true,
      prospect: {
        select: {
          firstName: true,
          lastName: true,
          jobTitle: true,
          companyName: true,
          contactDetails: {
            select: {
              type: true,
              value: true,
              verificationStatus: true,
            },
          },
        },
      },
      signals: {
        select: {
          signal: {
            select: {
              description: true,
              sourceName: true,
              sourceUrl: true,
              verificationStatus: true,
            },
          },
        },
      },
    },
  });
  if (!candidate) {
    return null;
  }

  const readiness = approvalReadiness(candidate);
  if (!readiness.allowed) {
    return readiness;
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.opportunity.update({
      where: { id: candidate.id },
      data: {
        rejectionReason: null,
        reviewedAt: new Date(),
        reviewedByUserId: actorUserId,
        reviewStatus: OpportunityReviewStatus.APPROVED,
      },
    });
    await writeAuditLog(transaction, {
      action: "OPPORTUNITY_APPROVED",
      actorUserId,
      entityId: candidate.id,
      entityType: "opportunity",
      newData: {
        reviewStatus: OpportunityReviewStatus.APPROVED,
        status: OpportunityStatus.DRAFT,
      },
    });
  });
  return { allowed: true, reasons: [] };
}

export async function rejectOpportunity(
  actorUserId: string,
  opportunityId: string,
  reason: OpportunityRejectionReason,
) {
  const updated = await prisma.opportunity.updateMany({
    where: { id: opportunityId, status: OpportunityStatus.DRAFT },
    data: {
      rejectionReason: reason,
      reviewedAt: new Date(),
      reviewedByUserId: actorUserId,
      reviewStatus: OpportunityReviewStatus.REJECTED,
    },
  });
  if (updated.count) {
    await writeAuditLog(prisma, {
      action: "OPPORTUNITY_REJECTED",
      actorUserId,
      entityId: opportunityId,
      entityType: "opportunity",
      newData: {
        reason,
        reviewStatus: OpportunityReviewStatus.REJECTED,
      },
    });
  }
  return Boolean(updated.count);
}

export async function manuallyVerifyLinkedin(
  actorUserId: string,
  opportunityId: string,
  contactDetailId: string,
) {
  const opportunity = await prisma.opportunity.findFirst({
    where: {
      id: opportunityId,
      status: OpportunityStatus.DRAFT,
      prospect: {
        contactDetails: {
          some: {
            id: contactDetailId,
            type: ContactDetailType.LINKEDIN,
          },
        },
      },
    },
    select: { id: true },
  });
  if (!opportunity) {
    return null;
  }

  const verifiedAt = new Date();
  const contact = await prisma.contactDetail.update({
    where: { id: contactDetailId },
    data: {
      verificationMethod: "Vérification manuelle par l’équipe Affluo",
      verificationStatus: VerificationStatus.VERIFIED,
      verifiedAt,
      verifiedByUserId: actorUserId,
    },
    select: { id: true, prospectId: true },
  });
  await writeAuditLog(prisma, {
    action: "LINKEDIN_MANUALLY_VERIFIED",
    actorUserId,
    entityId: contact.id,
    entityType: "contact_detail",
    newData: {
      verificationMethod: "MANUAL",
      verificationStatus: VerificationStatus.VERIFIED,
    },
    metadata: { opportunityId },
  });
  return contact;
}
