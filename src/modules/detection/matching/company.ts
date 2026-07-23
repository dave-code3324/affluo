import type { ExtractedCompany } from "@/modules/detection/types";

export type CompanyMatchCandidate = {
  id: string;
  legalName: string;
  siren: string | null;
  siret: string | null;
  normalizedDomain: string | null;
  city: string | null;
  department: string | null;
};

function key(value: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function domain(value: string | null) {
  if (!value) {
    return null;
  }
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function findCompanyMatch(
  company: ExtractedCompany,
  candidates: CompanyMatchCandidate[],
) {
  if (company.siren) {
    const match = candidates.find(({ siren }) => siren === company.siren);
    if (match) {
      return { candidate: match, reason: "SIREN" as const };
    }
  }
  if (company.siret) {
    const match = candidates.find(({ siret }) => siret === company.siret);
    if (match) {
      return { candidate: match, reason: "SIRET" as const };
    }
  }
  const incomingDomain = domain(company.website);
  if (incomingDomain) {
    const match = candidates.find(
      ({ normalizedDomain }) => normalizedDomain === incomingDomain,
    );
    if (match) {
      return { candidate: match, reason: "DOMAIN" as const };
    }
  }
  const incomingName = key(company.legalName);
  const match = candidates.find(
    (candidate) =>
      key(candidate.legalName) === incomingName &&
      Boolean(
        (company.department && candidate.department === company.department) ||
        (company.city && key(candidate.city) === key(company.city)),
      ),
  );
  return match
    ? { candidate: match, reason: "NAME_AND_LOCATION" as const }
    : null;
}
