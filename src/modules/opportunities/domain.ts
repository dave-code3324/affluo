import {
  ContactabilityStatus,
  EmailVerificationStatus,
  OpportunityStatus,
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

type PublishableOpportunity = {
  contactabilityStatus: ContactabilityStatus;
  emailVerificationStatus: EmailVerificationStatus;
  linkedinUrl: string | null;
  professionalEmail: string | null;
};

export function canPublishOpportunity(opportunity: PublishableOpportunity) {
  if (
    opportunity.contactabilityStatus === ContactabilityStatus.NOT_CONTACTABLE
  ) {
    return false;
  }

  const hasAnyChannel = Boolean(
    opportunity.linkedinUrl || opportunity.professionalEmail,
  );

  if (!hasAnyChannel) {
    return false;
  }

  if (opportunity.contactabilityStatus === ContactabilityStatus.CONTACTABLE) {
    return Boolean(
      opportunity.linkedinUrl ||
      (opportunity.professionalEmail &&
        (opportunity.emailVerificationStatus ===
          EmailVerificationStatus.LIKELY ||
          opportunity.emailVerificationStatus ===
            EmailVerificationStatus.VERIFIED)),
    );
  }

  return true;
}
