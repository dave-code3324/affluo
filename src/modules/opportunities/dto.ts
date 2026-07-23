export type OpportunityCardDto = {
  companyName: string;
  contactability: {
    description: string;
    label: string;
    tone: "positive" | "warning" | "neutral";
  };
  department: string;
  firstName: string;
  id: string;
  jobTitle: string;
  lastName: string;
  location: string;
  signalSummary: string;
  title: string;
  whyNow: string;
};

export type OpportunityDetailDto = OpportunityCardDto & {
  addedAt: string;
  confidence: {
    description: string;
    label: string;
  };
  contactDetails: Array<{
    id: string;
    isPrimary: boolean;
    label: string;
    type:
      | "PROFESSIONAL_EMAIL"
      | "PROFESSIONAL_PHONE"
      | "LINKEDIN"
      | "COMPANY_WEBSITE";
    value: string;
    verificationMethod: string | null;
    verifiedAt: string | null;
  }>;
  decision: {
    decision: "TO_CONTACT" | "TO_MONITOR" | "NOT_RELEVANT";
    reason:
      | "WRONG_PROFILE"
      | "WEAK_SIGNAL"
      | "WRONG_LOCATION"
      | "ALREADY_KNOWN"
      | "INSUFFICIENT_CONTACT_DETAILS"
      | "OTHER"
      | null;
  } | null;
  facts: string[];
  hypotheses: {
    disclaimer: string;
    items: string[];
    label: string;
  };
  linkedinUrl: string | null;
  primaryEmail: string | null;
  professionalProfileSummary: string | null;
  publishedAt: string;
  qualificationSummary: string | null;
  selectionReasons: string[];
  signals: Array<{
    description: string;
    detectedAt: string;
    eventDate: string | null;
    id: string;
    isPrimary: boolean;
    source: {
      name: string;
      publishedAt: string | null;
      url: string;
      verifiedAt: string | null;
    } | null;
    title: string;
    type: string;
    verificationLabel: string;
  }>;
  signalType: string;
  websiteUrl: string | null;
  weeklyPeriod: string;
};

export type WeeklySelectionDto =
  | {
      kind: "none";
    }
  | {
      batch: {
        id: string;
        opportunityCount: number;
        period: string;
        publishedAt: string;
        summary: string | null;
      };
      kind: "published";
      opportunities: OpportunityCardDto[];
      pagination: {
        page: number;
        pageSize: number;
        totalPages: number;
      };
    };
