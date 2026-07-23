import type {
  ConfidenceLevel,
  DetectionSignalType,
  ExtractionMethod,
} from "@prisma/client";
import type { JsonValue } from "@prisma/client/runtime/library";

export type CollectionContext = {
  detectionRunId: string;
  limit: number;
  since: Date;
};

export type CollectedDocument = {
  sourceKey: string;
  externalId: string | null;
  title: string;
  content: string;
  sourceUrl: string;
  publishedAt: Date | null;
  collectedAt: Date;
  metadata: JsonValue;
};

export interface ProspectSource {
  key: string;
  label: string;
  collect(context: CollectionContext): Promise<CollectedDocument[]>;
}

export type ExtractedCompany = {
  legalName: string;
  tradeName: string | null;
  siren: string | null;
  siret: string | null;
  website: string | null;
  city: string | null;
  department: string | null;
  industry: string | null;
  legalForm: string | null;
};

export type ExtractedProspect = {
  firstName: string;
  lastName: string;
  jobTitle: string;
  identificationSource: string;
  identificationConfidence: number;
  professionalEmail: string | null;
  professionalPhone: string | null;
  linkedinUrl: string | null;
};

export type SignalCandidate = {
  type: DetectionSignalType;
  title: string;
  factualSummary: string;
  eventDate: Date;
  sourceUrl: string;
  company: ExtractedCompany;
  prospect: ExtractedProspect;
  extractionMethod: ExtractionMethod;
  extractionVersion: string;
};

export type AutomaticQualification = {
  isRelevant: boolean;
  relevanceScore: number;
  confidenceLevel: ConfidenceLevel;
  rejectionReasons: string[];
  matchingReasons: string[];
};

export type PatrimonialHypotheses = {
  potentialNeeds: string[];
  whyNow: string;
  qualificationSummary: string;
};

export type CandidateExtraction =
  | {
      outcome: "candidate";
      candidate: SignalCandidate;
    }
  | {
      outcome: "ignored";
      reasons: string[];
    };
