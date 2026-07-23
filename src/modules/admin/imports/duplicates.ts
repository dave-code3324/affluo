import {
  comparisonKey,
  normalizeEmail,
  normalizeLinkedinUrl,
  normalizePhone,
  normalizedDomain,
} from "@/modules/admin/imports/normalization";
import type {
  DuplicateCandidate,
  NormalizedImportRow,
} from "@/modules/admin/imports/types";

export type DuplicateMatch = {
  candidateId: string;
  level: "STRONG" | "SECONDARY";
  reason: string;
};

export function findStrongDuplicate(
  row: NormalizedImportRow,
  candidates: DuplicateCandidate[],
): DuplicateMatch | null {
  const email = normalizeEmail(row.professionalEmail ?? "");
  const linkedin = normalizeLinkedinUrl(row.linkedinUrl ?? "");
  const phone = normalizePhone(row.professionalPhone ?? "");

  for (const candidate of candidates) {
    if (
      email &&
      candidate.emails.some(
        (candidateEmail) => normalizeEmail(candidateEmail) === email,
      )
    ) {
      return {
        candidateId: candidate.id,
        level: "STRONG",
        reason: "Même email professionnel normalisé",
      };
    }
    if (
      linkedin &&
      candidate.linkedinUrls.some(
        (candidateLinkedin) =>
          normalizeLinkedinUrl(candidateLinkedin) === linkedin,
      )
    ) {
      return {
        candidateId: candidate.id,
        level: "STRONG",
        reason: "Même URL LinkedIn normalisée",
      };
    }
    if (
      phone &&
      candidate.phones.some(
        (candidatePhone) => normalizePhone(candidatePhone) === phone,
      )
    ) {
      return {
        candidateId: candidate.id,
        level: "STRONG",
        reason: "Même téléphone professionnel normalisé",
      };
    }
  }
  return null;
}

export function findSecondaryDuplicate(
  row: NormalizedImportRow,
  candidates: DuplicateCandidate[],
): DuplicateMatch | null {
  const identity =
    comparisonKey(row.firstName) === "" || comparisonKey(row.lastName) === "";
  if (identity) {
    return null;
  }

  const rowDomain = normalizedDomain(row.companyWebsite);
  for (const candidate of candidates) {
    const sameIdentity =
      comparisonKey(candidate.firstName) === comparisonKey(row.firstName) &&
      comparisonKey(candidate.lastName) === comparisonKey(row.lastName);
    if (!sameIdentity) {
      continue;
    }

    const sameCompany =
      comparisonKey(candidate.companyName) === comparisonKey(row.companyName);
    const sameLocation =
      comparisonKey(candidate.city) === comparisonKey(row.city) ||
      candidate.department === row.department;
    const candidateRole = comparisonKey(candidate.jobTitle);
    const rowRole = comparisonKey(row.jobTitle);
    const sameRole =
      Boolean(candidateRole && rowRole) &&
      (candidateRole.includes(rowRole) || rowRole.includes(candidateRole));
    const candidateDomain = normalizedDomain(candidate.companyWebsite);

    if (
      sameCompany ||
      sameLocation ||
      sameRole ||
      (rowDomain && candidateDomain === rowDomain)
    ) {
      return {
        candidateId: candidate.id,
        level: "SECONDARY",
        reason:
          "Même identité avec entreprise, fonction ou localisation proche",
      };
    }
  }
  return null;
}
