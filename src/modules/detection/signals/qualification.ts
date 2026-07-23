import { ConfidenceLevel, DetectionSignalType } from "@prisma/client";

import { detectionConfig } from "@/modules/detection/config";
import type {
  AutomaticQualification,
  SignalCandidate,
} from "@/modules/detection/types";

const CONCRETE_SIGNAL_TYPES = new Set<DetectionSignalType>([
  DetectionSignalType.COMPANY_SALE,
  DetectionSignalType.BUSINESS_TRANSFER,
  DetectionSignalType.FUNDRAISING,
  DetectionSignalType.MANAGEMENT_CHANGE,
  DetectionSignalType.COMPANY_CREATION,
  DetectionSignalType.COMPANY_CLOSURE,
  DetectionSignalType.DIVIDEND_EVENT,
  DetectionSignalType.PROFESSIONAL_SUCCESSION,
  DetectionSignalType.LIQUIDITY_EVENT,
]);

export function signalAgeDays(eventDate: Date, referenceDate = new Date()) {
  return Math.floor(
    (Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate(),
    ) -
      Date.UTC(
        eventDate.getUTCFullYear(),
        eventDate.getUTCMonth(),
        eventDate.getUTCDate(),
      )) /
      86_400_000,
  );
}

export function qualifySignal(
  candidate: SignalCandidate,
  {
    referenceDate = new Date(),
    matchesFirmTarget = false,
  }: {
    referenceDate?: Date;
    matchesFirmTarget?: boolean;
  } = {},
): AutomaticQualification {
  let score = 0;
  const rejectionReasons: string[] = [];
  const matchingReasons: string[] = [];

  try {
    const protocol = new URL(candidate.sourceUrl).protocol;
    if (!["http:", "https:"].includes(protocol)) {
      rejectionReasons.push("SOURCE_PROTOCOL_FORBIDDEN");
    } else {
      score += 20;
      matchingReasons.push("SOURCE_PUBLIC_URL");
    }
  } catch {
    rejectionReasons.push("SOURCE_MISSING");
  }

  if (
    candidate.company.siren ||
    candidate.company.siret ||
    (candidate.company.legalName && candidate.company.city)
  ) {
    score += 20;
    matchingReasons.push("COMPANY_IDENTIFIED");
  } else {
    rejectionReasons.push("COMPANY_NOT_IDENTIFIED");
  }

  if (
    candidate.prospect.firstName &&
    candidate.prospect.lastName &&
    candidate.prospect.identificationConfidence >= 70
  ) {
    score += 25;
    matchingReasons.push("PROSPECT_EXPLICITLY_IDENTIFIED");
  } else {
    rejectionReasons.push("PROSPECT_NOT_IDENTIFIED");
  }

  const age = signalAgeDays(candidate.eventDate, referenceDate);
  if (age < 0) {
    rejectionReasons.push("EVENT_DATE_IN_FUTURE");
  } else if (age > detectionConfig.maximumSignalAgeDays) {
    rejectionReasons.push("SIGNAL_TOO_OLD");
  } else {
    score += age <= 30 ? 20 : 15;
    matchingReasons.push(age <= 30 ? "SIGNAL_UNDER_30_DAYS" : "SIGNAL_RECENT");
  }

  if (
    CONCRETE_SIGNAL_TYPES.has(candidate.type) &&
    candidate.factualSummary.trim().length >= 40
  ) {
    score += 15;
    matchingReasons.push("CONCRETE_ECONOMIC_EVENT");
  } else {
    rejectionReasons.push("EVENT_NOT_CONCRETE");
  }

  if (matchesFirmTarget) {
    score += 5;
    matchingReasons.push("POTENTIAL_FIRM_TARGET_MATCH");
  }

  const boundedScore = Math.min(100, Math.max(0, score));
  const confidenceLevel =
    boundedScore >= 85
      ? ConfidenceLevel.HIGH
      : boundedScore >= 65
        ? ConfidenceLevel.MEDIUM
        : ConfidenceLevel.LOW;

  return {
    isRelevant:
      rejectionReasons.length === 0 &&
      boundedScore >= detectionConfig.minimumScore,
    relevanceScore: boundedScore,
    confidenceLevel,
    rejectionReasons,
    matchingReasons,
  };
}
