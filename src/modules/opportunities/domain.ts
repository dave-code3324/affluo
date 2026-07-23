import {
  ConfidenceLevel,
  ContactDetailType,
  ContactabilityStatus,
  FeedbackDecision,
  FeedbackReason,
  OpportunityStatus,
  SignalVerificationStatus,
  VerificationStatus,
  WeeklyBatchStatus,
} from "@prisma/client";
import { z } from "zod";

export const weeklyBatchStatusSchema = z.enum([
  WeeklyBatchStatus.DRAFT,
  WeeklyBatchStatus.PUBLISHED,
  WeeklyBatchStatus.ARCHIVED,
]);

export const opportunityStatusSchema = z.enum([
  OpportunityStatus.DRAFT,
  OpportunityStatus.PUBLISHED,
  OpportunityStatus.DISMISSED,
]);

export const contactabilityStatusSchema = z.enum([
  ContactabilityStatus.NOT_CONTACTABLE,
  ContactabilityStatus.PARTIALLY_VERIFIED,
  ContactabilityStatus.CONTACTABLE,
]);

export const opportunityIdSchema = z.string().uuid();

export const paginationSchema = z.coerce.number().int().positive().max(10_000);

export const feedbackDecisionSchema = z.enum([
  FeedbackDecision.TO_CONTACT,
  FeedbackDecision.TO_MONITOR,
  FeedbackDecision.NOT_RELEVANT,
]);

export const feedbackReasonSchema = z.enum([
  FeedbackReason.WRONG_PROFILE,
  FeedbackReason.WEAK_SIGNAL,
  FeedbackReason.WRONG_LOCATION,
  FeedbackReason.ALREADY_KNOWN,
  FeedbackReason.INSUFFICIENT_CONTACT_DETAILS,
  FeedbackReason.OTHER,
]);

export const feedbackInputSchema = z
  .object({
    opportunityId: opportunityIdSchema,
    decision: feedbackDecisionSchema,
    reason: z
      .union([feedbackReasonSchema, z.literal("")])
      .optional()
      .transform((value) => value || null),
  })
  .refine(
    (input) =>
      input.decision === FeedbackDecision.NOT_RELEVANT || !input.reason,
    {
      message: "Une raison concerne uniquement une décision non pertinente.",
      path: ["reason"],
    },
  );

export const externalUrlSchema = z
  .url()
  .refine((value) => ["http:", "https:"].includes(new URL(value).protocol), {
    message: "Le protocole du lien n’est pas autorisé.",
  });

const phoneSchema = z
  .string()
  .trim()
  .min(6)
  .max(30)
  .regex(/^\+?[0-9 ().-]+$/);

export function isValidContactValue(type: ContactDetailType, value: string) {
  if (type === ContactDetailType.PROFESSIONAL_EMAIL) {
    return z.email().safeParse(value).success;
  }
  if (type === ContactDetailType.PROFESSIONAL_PHONE) {
    return phoneSchema.safeParse(value).success;
  }
  return externalUrlSchema.safeParse(value).success;
}

export function safeExternalUrl(value: string | null) {
  if (!value) {
    return null;
  }
  const parsed = externalUrlSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export type ContactabilityPresentation = {
  description: string;
  label: string;
  tone: "positive" | "warning" | "neutral";
};

const CONTACTABILITY: Record<ContactabilityStatus, ContactabilityPresentation> =
  {
    [ContactabilityStatus.CONTACTABLE]: {
      description: "Au moins un canal professionnel est utilisable et vérifié.",
      label: "Contact professionnel vérifié",
      tone: "positive",
    },
    [ContactabilityStatus.PARTIALLY_VERIFIED]: {
      description:
        "Une coordonnée existe et nécessite une dernière vérification.",
      label: "Contact à vérifier",
      tone: "warning",
    },
    [ContactabilityStatus.NOT_CONTACTABLE]: {
      description: "Aucun canal professionnel crédible n’est disponible.",
      label: "Non contactable",
      tone: "neutral",
    },
  };

export function getContactabilityPresentation(status: ContactabilityStatus) {
  return CONTACTABILITY[status];
}

function dateFormatter(options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("fr-FR", {
    ...options,
    timeZone: "UTC",
  });
}

export function formatWeeklyPeriod(weekStart: Date, weekEnd: Date) {
  const sameMonth =
    weekStart.getUTCFullYear() === weekEnd.getUTCFullYear() &&
    weekStart.getUTCMonth() === weekEnd.getUTCMonth();

  if (sameMonth) {
    const startDay = dateFormatter({ day: "numeric" }).format(weekStart);
    const end = dateFormatter({
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(weekEnd);
    return `Du ${startDay} au ${end}`;
  }

  const start = dateFormatter({
    day: "numeric",
    month: "long",
  }).format(weekStart);
  const end = dateFormatter({
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(weekEnd);
  return `Du ${start} au ${end}`;
}

export function formatPublishedDate(date: Date) {
  return dateFormatter({
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export const formatDecisionDate = formatPublishedDate;

type VerificationPresentation = {
  label: string;
  tone: "positive" | "warning" | "neutral" | "negative";
  usable: boolean;
};

const VERIFICATION_LABELS: Record<
  VerificationStatus,
  Omit<VerificationPresentation, "label">
> = {
  [VerificationStatus.VERIFIED]: { tone: "positive", usable: true },
  [VerificationStatus.LIKELY]: { tone: "warning", usable: true },
  [VerificationStatus.UNVERIFIED]: { tone: "neutral", usable: true },
  [VerificationStatus.INVALID]: { tone: "negative", usable: false },
};

const CONTACT_TYPE_LABELS: Record<ContactDetailType, string> = {
  [ContactDetailType.PROFESSIONAL_EMAIL]: "Email professionnel",
  [ContactDetailType.PROFESSIONAL_PHONE]: "Téléphone professionnel",
  [ContactDetailType.LINKEDIN]: "Profil LinkedIn",
  [ContactDetailType.COMPANY_WEBSITE]: "Site de l’entreprise",
};

export function getVerificationPresentation(
  type: ContactDetailType,
  status: VerificationStatus,
): VerificationPresentation {
  const typeLabel = CONTACT_TYPE_LABELS[type];
  const statusLabel = {
    [VerificationStatus.VERIFIED]: "vérifié",
    [VerificationStatus.LIKELY]: "probable — à confirmer",
    [VerificationStatus.UNVERIFIED]: "non vérifié",
    [VerificationStatus.INVALID]: "invalide",
  }[status];

  return {
    ...VERIFICATION_LABELS[status],
    label: `${typeLabel} ${statusLabel}`,
  };
}

export function getConfidencePresentation(level: ConfidenceLevel) {
  return {
    [ConfidenceLevel.LOW]: {
      label: "Confiance limitée",
      description: "Le signal nécessite des vérifications complémentaires.",
    },
    [ConfidenceLevel.MEDIUM]: {
      label: "Confiance modérée",
      description: "Les éléments disponibles sont cohérents mais incomplets.",
    },
    [ConfidenceLevel.HIGH]: {
      label: "Confiance élevée",
      description: "Plusieurs éléments vérifiés soutiennent cette sélection.",
    },
  }[level];
}

export function getSignalVerificationLabel(status: SignalVerificationStatus) {
  return {
    [SignalVerificationStatus.VERIFIED]: "Signal vérifié",
    [SignalVerificationStatus.UNVERIFIED]: "Signal à confirmer",
    [SignalVerificationStatus.REJECTED]: "Signal rejeté",
  }[status];
}

export const FEEDBACK_DECISIONS = [
  {
    value: FeedbackDecision.TO_CONTACT,
    label: "À contacter",
    description: "Prioriser une prise de contact.",
  },
  {
    value: FeedbackDecision.TO_MONITOR,
    label: "À surveiller",
    description: "Conserver le prospect pour plus tard.",
  },
  {
    value: FeedbackDecision.NOT_RELEVANT,
    label: "Pas pertinent",
    description: "Écarter cette opportunité.",
  },
] as const;

export const FEEDBACK_REASONS = [
  { value: FeedbackReason.WRONG_PROFILE, label: "Mauvais profil" },
  { value: FeedbackReason.WEAK_SIGNAL, label: "Signal peu pertinent" },
  {
    value: FeedbackReason.WRONG_LOCATION,
    label: "Zone géographique incorrecte",
  },
  { value: FeedbackReason.ALREADY_KNOWN, label: "Déjà connu" },
  {
    value: FeedbackReason.INSUFFICIENT_CONTACT_DETAILS,
    label: "Coordonnées insuffisantes",
  },
  { value: FeedbackReason.OTHER, label: "Autre" },
] as const;

type SelectableContact = {
  isPrimary: boolean;
  type: ContactDetailType;
  value: string;
  verificationStatus: VerificationStatus;
};

export function selectPrimaryContact<T extends SelectableContact>(
  contacts: T[],
  type: ContactDetailType,
) {
  const rank: Record<VerificationStatus, number> = {
    [VerificationStatus.VERIFIED]: 3,
    [VerificationStatus.LIKELY]: 2,
    [VerificationStatus.UNVERIFIED]: 1,
    [VerificationStatus.INVALID]: 0,
  };

  return (
    contacts
      .filter(
        (contact) =>
          contact.type === type &&
          contact.verificationStatus !== VerificationStatus.INVALID &&
          isValidContactValue(contact.type, contact.value),
      )
      .sort(
        (left, right) =>
          Number(right.isPrimary) - Number(left.isPrimary) ||
          rank[right.verificationStatus] - rank[left.verificationStatus],
      )[0] ?? null
  );
}

export function createDecisionSections(
  verifiedFacts: string[],
  potentialNeeds: string[],
) {
  return {
    facts: {
      label: "Faits vérifiés",
      items: verifiedFacts,
    },
    hypotheses: {
      label: "Hypothèses à explorer lors d’un échange",
      disclaimer:
        "Ces éléments sont des pistes de conversation et non des informations confirmées sur la situation personnelle du prospect.",
      items: potentialNeeds,
    },
  };
}

type PublishableOpportunity = {
  contactDetails?: Array<{
    type: ContactDetailType;
    value: string;
    verificationStatus: VerificationStatus;
  }>;
  contactabilityStatus: ContactabilityStatus;
  emailVerificationStatus: VerificationStatus;
  linkedinUrl: string | null;
  professionalEmail: string | null;
};

export function canPublishOpportunity(opportunity: PublishableOpportunity) {
  if (
    opportunity.contactabilityStatus === ContactabilityStatus.NOT_CONTACTABLE
  ) {
    return false;
  }

  const usableContacts = (opportunity.contactDetails ?? []).filter(
    (contact) =>
      contact.verificationStatus !== VerificationStatus.INVALID &&
      isValidContactValue(contact.type, contact.value),
  );
  const hasAnyChannel = Boolean(
    opportunity.linkedinUrl ||
    opportunity.professionalEmail ||
    usableContacts.length,
  );

  if (!hasAnyChannel) {
    return false;
  }

  if (opportunity.contactabilityStatus === ContactabilityStatus.CONTACTABLE) {
    return Boolean(
      opportunity.linkedinUrl ||
      usableContacts.some(
        (contact) =>
          contact.verificationStatus === VerificationStatus.VERIFIED &&
          contact.type !== ContactDetailType.COMPANY_WEBSITE,
      ) ||
      (opportunity.professionalEmail &&
        (opportunity.emailVerificationStatus === VerificationStatus.LIKELY ||
          opportunity.emailVerificationStatus === VerificationStatus.VERIFIED)),
    );
  }

  return true;
}
