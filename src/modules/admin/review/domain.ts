import {
  ConfidenceLevel,
  ContactDetailType,
  ContactabilityStatus,
  OpportunityRejectionReason,
  OpportunityReviewStatus,
  SignalVerificationStatus,
  VerificationStatus,
} from "@prisma/client";
import { z } from "zod";

import { isValidContactValue } from "@/modules/opportunities/domain";

export const adminOpportunityIdSchema = z.uuid();

export const reviewFilterSchema = z.enum([
  "TO_REVIEW",
  "INCOMPLETE",
  "APPROVED",
  "REJECTED",
  "INSUFFICIENT_CONTACT",
  "SIGNAL_TO_VERIFY",
]);

export const reviewSortSchema = z.enum([
  "IMPORTED_DESC",
  "EVENT_DESC",
  "CONTACTABILITY_DESC",
  "CONFIDENCE_DESC",
]);

export const rejectionReasonSchema = z.enum([
  OpportunityRejectionReason.OUT_OF_TARGET,
  OpportunityRejectionReason.INSUFFICIENT_SIGNAL,
  OpportunityRejectionReason.STALE_SIGNAL,
  OpportunityRejectionReason.UNRELIABLE_SOURCE,
  OpportunityRejectionReason.INSUFFICIENT_CONTACT_DETAILS,
  OpportunityRejectionReason.DUPLICATE,
  OpportunityRejectionReason.COMPLIANCE_RISK,
  OpportunityRejectionReason.OTHER,
]);

export const reviewCorrectionSchema = z.object({
  opportunityId: adminOpportunityIdSchema,
  prospect: z.object({
    firstName: z.string().trim().min(1).max(120),
    lastName: z.string().trim().min(1).max(120),
    jobTitle: z.string().trim().max(160),
    companyName: z.string().trim().max(180),
    companyWebsite: z.union([
      z.url().refine((value) => {
        try {
          return ["http:", "https:"].includes(new URL(value).protocol);
        } catch {
          return false;
        }
      }),
      z.literal(""),
    ]),
    city: z.string().trim().min(1).max(120),
    department: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^(0[1-9]|[1-8][0-9]|9[0-5]|2A|2B|97[1-6])$/),
  }),
  signal: z.object({
    id: z.uuid(),
    type: z.string().trim().min(1).max(120),
    title: z.string().trim().min(1).max(220),
    description: z.string().trim().min(1).max(3_000),
    eventDate: z.iso.date(),
    sourceName: z.string().trim().min(1).max(180),
    sourceUrl: z.url().refine((value) => {
      try {
        return ["http:", "https:"].includes(new URL(value).protocol);
      } catch {
        return false;
      }
    }),
    sourcePublishedAt: z.union([z.iso.date(), z.literal("")]),
    verificationStatus: z.enum([
      SignalVerificationStatus.UNVERIFIED,
      SignalVerificationStatus.VERIFIED,
      SignalVerificationStatus.REJECTED,
    ]),
  }),
  contacts: z.object({
    email: z.union([z.email(), z.literal("")]),
    emailStatus: z.enum([
      VerificationStatus.UNVERIFIED,
      VerificationStatus.LIKELY,
      VerificationStatus.VERIFIED,
      VerificationStatus.INVALID,
    ]),
    phone: z.union([z.string().regex(/^\+?[0-9]{6,20}$/), z.literal("")]),
    phoneStatus: z.enum([
      VerificationStatus.UNVERIFIED,
      VerificationStatus.LIKELY,
      VerificationStatus.VERIFIED,
      VerificationStatus.INVALID,
    ]),
    linkedinUrl: z.union([
      z.url().refine((value) => {
        try {
          const hostname = new URL(value).hostname.replace(/^www\./, "");
          return (
            hostname === "linkedin.com" || hostname.endsWith(".linkedin.com")
          );
        } catch {
          return false;
        }
      }),
      z.literal(""),
    ]),
  }),
  opportunity: z.object({
    confidenceLevel: z.enum([
      ConfidenceLevel.LOW,
      ConfidenceLevel.MEDIUM,
      ConfidenceLevel.HIGH,
    ]),
    contactabilityStatus: z.enum([
      ContactabilityStatus.NOT_CONTACTABLE,
      ContactabilityStatus.PARTIALLY_VERIFIED,
      ContactabilityStatus.CONTACTABLE,
    ]),
    internalNotes: z.string().trim().max(5_000),
    potentialNeeds: z
      .string()
      .transform((value) =>
        value
          .split("|")
          .map((need) => need.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.string().min(1).max(180)).max(12)),
    qualificationSummary: z.string().trim().max(2_000),
    whyNow: z.string().trim().min(1).max(3_000),
  }),
});

export type ApprovalCandidate = {
  contactabilityStatus: ContactabilityStatus;
  prospect: {
    companyName: string;
    contactDetails: Array<{
      type: ContactDetailType;
      value: string;
      verificationStatus: VerificationStatus;
    }>;
    firstName: string;
    jobTitle: string;
    lastName: string;
  };
  signals: Array<{
    signal: {
      description: string;
      sourceName: string | null;
      sourceUrl: string | null;
      verificationStatus: SignalVerificationStatus;
    };
  }>;
  whyNow: string;
};

export function approvalReadiness(candidate: ApprovalCandidate) {
  const reasons: string[] = [];
  const { prospect } = candidate;

  if (
    !prospect.firstName.trim() ||
    !prospect.lastName.trim() ||
    (!prospect.companyName.trim() && !prospect.jobTitle.trim())
  ) {
    reasons.push("Identité professionnelle incomplète.");
  }

  const usableSignal = candidate.signals.some(({ signal }) => {
    if (
      signal.verificationStatus === SignalVerificationStatus.REJECTED ||
      !signal.description.trim() ||
      !signal.sourceName?.trim() ||
      !signal.sourceUrl
    ) {
      return false;
    }
    try {
      return ["http:", "https:"].includes(new URL(signal.sourceUrl).protocol);
    } catch {
      return false;
    }
  });
  if (!usableSignal) {
    reasons.push("Le signal doit disposer d’une source exploitable.");
  }

  if (!candidate.whyNow.trim()) {
    reasons.push("L’interprétation « Pourquoi maintenant ? » est absente.");
  } else if (
    candidate.signals.some(
      ({ signal }) =>
        signal.description.trim().toLocaleLowerCase("fr-FR") ===
        candidate.whyNow.trim().toLocaleLowerCase("fr-FR"),
    )
  ) {
    reasons.push("Le fait et l’interprétation doivent être distincts.");
  }

  const usableContact = prospect.contactDetails.some(
    (contact) =>
      contact.verificationStatus !== VerificationStatus.INVALID &&
      isValidContactValue(contact.type, contact.value),
  );
  if (
    !usableContact ||
    candidate.contactabilityStatus === ContactabilityStatus.NOT_CONTACTABLE
  ) {
    reasons.push("Aucun canal professionnel utilisable n’est disponible.");
  }

  return {
    allowed: reasons.length === 0,
    reasons,
  };
}

export const REVIEW_STATUS_LABELS: Record<OpportunityReviewStatus, string> = {
  [OpportunityReviewStatus.TO_REVIEW]: "À examiner",
  [OpportunityReviewStatus.IN_REVIEW]: "En cours de revue",
  [OpportunityReviewStatus.NEEDS_CHANGES]: "Incomplète",
  [OpportunityReviewStatus.APPROVED]: "Validée",
  [OpportunityReviewStatus.REJECTED]: "Rejetée",
};

export const REJECTION_REASONS = [
  {
    value: OpportunityRejectionReason.OUT_OF_TARGET,
    label: "Prospect hors cible",
  },
  {
    value: OpportunityRejectionReason.INSUFFICIENT_SIGNAL,
    label: "Signal insuffisant",
  },
  {
    value: OpportunityRejectionReason.STALE_SIGNAL,
    label: "Signal trop ancien",
  },
  {
    value: OpportunityRejectionReason.UNRELIABLE_SOURCE,
    label: "Source non fiable",
  },
  {
    value: OpportunityRejectionReason.INSUFFICIENT_CONTACT_DETAILS,
    label: "Coordonnées insuffisantes",
  },
  { value: OpportunityRejectionReason.DUPLICATE, label: "Doublon" },
  {
    value: OpportunityRejectionReason.COMPLIANCE_RISK,
    label: "Risque de conformité",
  },
  { value: OpportunityRejectionReason.OTHER, label: "Autre" },
] as const;
