import type { ConfidenceLevel, VerificationStatus } from "@prisma/client";

export type RawCsvRow = Record<string, string>;

export type NormalizedImportRow = {
  city: string;
  companyName: string;
  companyWebsite: string | null;
  confidenceLevel: ConfidenceLevel;
  department: string;
  emailVerificationStatus: VerificationStatus;
  eventDate: string;
  firstName: string;
  jobTitle: string;
  lastName: string;
  linkedinUrl: string | null;
  linkedinVerificationStatus: VerificationStatus;
  notes: string | null;
  phoneVerificationStatus: VerificationStatus;
  potentialNeeds: string[];
  professionalEmail: string | null;
  professionalPhone: string | null;
  signalDescription: string;
  signalTitle: string;
  signalType: string;
  sourceName: string;
  sourcePublishedAt: string | null;
  sourceUrl: string;
  whyNow: string;
};

export type ImportFieldError = {
  field: string;
  message: string;
  originalValue: string;
};

export type ParsedCsvRow = {
  errors: ImportFieldError[];
  normalizedData: NormalizedImportRow | null;
  rawData: RawCsvRow;
  rowNumber: number;
};

export type ParsedCsv = {
  delimiter: "," | ";";
  headers: string[];
  missingColumns: string[];
  rows: ParsedCsvRow[];
};

export type DuplicateCandidate = {
  city: string;
  companyName: string;
  companyWebsite: string | null;
  department: string;
  emails: string[];
  firstName: string;
  id: string;
  jobTitle: string;
  lastName: string;
  linkedinUrls: string[];
  phones: string[];
};
