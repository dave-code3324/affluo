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
  linkedinUrl: string | null;
  professionalEmail: string | null;
  publishedAt: string;
  signalType: string;
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
