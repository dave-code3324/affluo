export type ProspectMatchCandidate = {
  id: string;
  firstName: string;
  lastName: string;
  companyId: string | null;
  professionalEmail: string | null;
  linkedinUrl: string | null;
};

function key(value: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

export function findProspectMatch(
  prospect: {
    firstName: string;
    lastName: string;
    companyId: string;
    professionalEmail: string | null;
    linkedinUrl: string | null;
  },
  candidates: ProspectMatchCandidate[],
) {
  const email = prospect.professionalEmail?.toLowerCase();
  if (email) {
    const match = candidates.find(
      ({ professionalEmail }) => professionalEmail?.toLowerCase() === email,
    );
    if (match) {
      return { candidate: match, reason: "PROFESSIONAL_EMAIL" as const };
    }
  }
  if (prospect.linkedinUrl) {
    const match = candidates.find(
      ({ linkedinUrl }) => linkedinUrl === prospect.linkedinUrl,
    );
    if (match) {
      return { candidate: match, reason: "LINKEDIN" as const };
    }
  }
  const match = candidates.find(
    (candidate) =>
      candidate.companyId === prospect.companyId &&
      key(candidate.firstName) === key(prospect.firstName) &&
      key(candidate.lastName) === key(prospect.lastName),
  );
  return match
    ? { candidate: match, reason: "IDENTITY_AND_COMPANY" as const }
    : null;
}
