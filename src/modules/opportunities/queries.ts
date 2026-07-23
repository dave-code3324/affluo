import {
  ContactDetailType,
  ContactabilityStatus,
  OpportunityReviewStatus,
  OpportunityStatus,
  Prisma,
  SignalVerificationStatus,
  VerificationStatus,
  WeeklyBatchStatus,
} from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import {
  type OpportunityCardDto,
  type OpportunityDetailDto,
  type WeeklySelectionDto,
} from "@/modules/opportunities/dto";
import {
  createDecisionSections,
  formatDecisionDate,
  formatPublishedDate,
  formatWeeklyPeriod,
  getConfidencePresentation,
  getContactabilityPresentation,
  getSignalVerificationLabel,
  getVerificationPresentation,
  isValidContactValue,
  safeExternalUrl,
  selectPrimaryContact,
} from "@/modules/opportunities/domain";

const opportunitySelect = {
  id: true,
  title: true,
  signalType: true,
  signalSummary: true,
  whyNow: true,
  contactabilityStatus: true,
  prospect: {
    select: {
      firstName: true,
      lastName: true,
      jobTitle: true,
      companyName: true,
      city: true,
      department: true,
      linkedinUrl: true,
      professionalEmail: true,
      emailVerificationStatus: true,
    },
  },
} satisfies Prisma.OpportunitySelect;

type OpportunityRecord = Prisma.OpportunityGetPayload<{
  select: typeof opportunitySelect;
}>;

const readableContactFilter: Prisma.OpportunityWhereInput = {
  status: OpportunityStatus.PUBLISHED,
  reviewStatus: OpportunityReviewStatus.APPROVED,
  contactabilityStatus: {
    not: ContactabilityStatus.NOT_CONTACTABLE,
  },
  OR: [
    {
      prospect: {
        linkedinUrl: { not: null },
      },
    },
    {
      prospect: {
        professionalEmail: { not: null },
        emailVerificationStatus: {
          not: VerificationStatus.INVALID,
        },
      },
    },
    {
      prospect: {
        contactDetails: {
          some: {
            verificationStatus: { not: VerificationStatus.INVALID },
          },
        },
      },
    },
  ],
};

function toOpportunityCard(record: OpportunityRecord): OpportunityCardDto {
  const { prospect } = record;

  return {
    companyName: prospect.companyName,
    contactability: getContactabilityPresentation(record.contactabilityStatus),
    department: prospect.department,
    firstName: prospect.firstName,
    id: record.id,
    jobTitle: prospect.jobTitle,
    lastName: prospect.lastName,
    location: `${prospect.city} · ${prospect.department}`,
    signalSummary: record.signalSummary,
    title: record.title,
    whyNow: record.whyNow,
  };
}

type GetLatestSelectionInput = {
  firmId: string;
  page?: number;
  pageSize?: number;
};

export async function getLatestPublishedSelection({
  firmId,
  page = 1,
  pageSize = 6,
}: GetLatestSelectionInput): Promise<WeeklySelectionDto> {
  const latestBatch = await prisma.weeklyBatch.findFirst({
    where: {
      firmId,
      status: WeeklyBatchStatus.PUBLISHED,
      publishedAt: { not: null },
    },
    orderBy: [{ publishedAt: "desc" }, { weekStart: "desc" }],
    select: {
      id: true,
      weekStart: true,
      weekEnd: true,
      publishedAt: true,
      summary: true,
    },
  });

  if (!latestBatch?.publishedAt) {
    return { kind: "none" };
  }

  const where: Prisma.OpportunityWhereInput = {
    ...readableContactFilter,
    firmId,
    weeklyBatchId: latestBatch.id,
  };

  const [opportunityCount, records] = await Promise.all([
    prisma.opportunity.count({ where }),
    prisma.opportunity.findMany({
      where,
      orderBy: [{ relevanceScore: "desc" }, { createdAt: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: opportunitySelect,
    }),
  ]);

  return {
    kind: "published",
    batch: {
      id: latestBatch.id,
      opportunityCount,
      period: formatWeeklyPeriod(latestBatch.weekStart, latestBatch.weekEnd),
      publishedAt: formatPublishedDate(latestBatch.publishedAt),
      summary: latestBatch.summary,
    },
    opportunities: records.map(toOpportunityCard),
    pagination: {
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(opportunityCount / pageSize)),
    },
  };
}

type GetOpportunityDetailInput = {
  firmId: string;
  opportunityId: string;
};

export async function getPublishedOpportunityDetail({
  firmId,
  opportunityId,
}: GetOpportunityDetailInput): Promise<OpportunityDetailDto | null> {
  const record = await prisma.opportunity.findFirst({
    where: {
      ...readableContactFilter,
      id: opportunityId,
      firmId,
      weeklyBatch: {
        firmId,
        status: WeeklyBatchStatus.PUBLISHED,
        publishedAt: { not: null },
      },
    },
    select: {
      ...opportunitySelect,
      confidenceLevel: true,
      qualificationSummary: true,
      potentialNeeds: true,
      createdAt: true,
      weeklyBatch: {
        select: {
          weekStart: true,
          weekEnd: true,
          publishedAt: true,
        },
      },
      prospect: {
        select: {
          firstName: true,
          lastName: true,
          jobTitle: true,
          companyName: true,
          city: true,
          department: true,
          linkedinUrl: true,
          professionalEmail: true,
          emailVerificationStatus: true,
          professionalProfileSummary: true,
          contactDetails: {
            where: {
              verificationStatus: { not: VerificationStatus.INVALID },
            },
            orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
            select: {
              id: true,
              type: true,
              value: true,
              verificationStatus: true,
              verificationMethod: true,
              verifiedAt: true,
              isPrimary: true,
            },
          },
        },
      },
      signals: {
        where: {
          signal: {
            verificationStatus: {
              not: SignalVerificationStatus.REJECTED,
            },
          },
        },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        select: {
          isPrimary: true,
          signal: {
            select: {
              id: true,
              type: true,
              title: true,
              description: true,
              eventDate: true,
              detectedAt: true,
              sourceUrl: true,
              sourceName: true,
              sourcePublishedAt: true,
              verificationStatus: true,
              verifiedAt: true,
            },
          },
        },
      },
      feedbacks: {
        where: { firmId },
        take: 1,
        select: {
          decision: true,
          reason: true,
        },
      },
    },
  });

  if (!record?.weeklyBatch?.publishedAt) {
    return null;
  }

  const validContacts = record.prospect.contactDetails.filter((contact) =>
    isValidContactValue(contact.type, contact.value),
  );
  const primaryEmail = selectPrimaryContact(
    validContacts,
    ContactDetailType.PROFESSIONAL_EMAIL,
  );
  const primaryLinkedin = selectPrimaryContact(
    validContacts,
    ContactDetailType.LINKEDIN,
  );
  const primaryWebsite = selectPrimaryContact(
    validContacts,
    ContactDetailType.COMPANY_WEBSITE,
  );
  const signals = record.signals.map(({ isPrimary, signal }) => {
    const sourceUrl = safeExternalUrl(signal.sourceUrl);
    return {
      description: signal.description,
      detectedAt: formatDecisionDate(signal.detectedAt),
      eventDate: signal.eventDate ? formatDecisionDate(signal.eventDate) : null,
      id: signal.id,
      isPrimary,
      source:
        sourceUrl && signal.sourceName
          ? {
              name: signal.sourceName,
              publishedAt: signal.sourcePublishedAt
                ? formatDecisionDate(signal.sourcePublishedAt)
                : null,
              url: sourceUrl,
              verifiedAt: signal.verifiedAt
                ? formatDecisionDate(signal.verifiedAt)
                : null,
            }
          : null,
      title: signal.title,
      type: signal.type,
      verificationLabel: getSignalVerificationLabel(signal.verificationStatus),
    };
  });
  const verifiedFacts = [
    `${record.prospect.firstName} ${record.prospect.lastName}, ${record.prospect.jobTitle} chez ${record.prospect.companyName}.`,
    `Activité professionnelle située à ${record.prospect.city} (${record.prospect.department}).`,
    ...signals
      .filter(
        ({ source, verificationLabel }) =>
          verificationLabel === "Signal vérifié" && source,
      )
      .slice(0, 2)
      .map(({ title, eventDate }) =>
        eventDate ? `${title}, événement daté du ${eventDate}.` : title,
      ),
  ];
  const sections = createDecisionSections(verifiedFacts, record.potentialNeeds);
  const selectionReasons = [
    record.qualificationSummary ??
      "Le profil professionnel correspond au ciblage du cabinet.",
    `La localisation (${record.prospect.department}) est couverte par le cabinet.`,
    `La fonction de ${record.prospect.jobTitle.toLowerCase()} est cohérente avec la sélection.`,
    signals[0]
      ? `Un signal ${signals[0].verificationLabel.toLowerCase()} a été détecté.`
      : "Un signal professionnel récent a été identifié.",
    validContacts.length > 0
      ? "Au moins une coordonnée professionnelle exploitable est disponible."
      : "Les coordonnées nécessitent une vérification complémentaire.",
  ].slice(0, 5);

  return {
    ...toOpportunityCard(record),
    addedAt: formatDecisionDate(record.createdAt),
    confidence: getConfidencePresentation(record.confidenceLevel),
    contactDetails: validContacts.map((contact) => ({
      id: contact.id,
      isPrimary: contact.isPrimary,
      label: getVerificationPresentation(
        contact.type,
        contact.verificationStatus,
      ).label,
      type: contact.type,
      value: contact.value,
      verificationMethod: contact.verificationMethod,
      verifiedAt: contact.verifiedAt
        ? formatDecisionDate(contact.verifiedAt)
        : null,
    })),
    decision: record.feedbacks[0] ?? null,
    facts: sections.facts.items,
    hypotheses: sections.hypotheses,
    linkedinUrl: primaryLinkedin?.value ?? null,
    primaryEmail: primaryEmail?.value ?? null,
    professionalProfileSummary: record.prospect.professionalProfileSummary,
    publishedAt: formatPublishedDate(record.weeklyBatch.publishedAt),
    qualificationSummary: record.qualificationSummary,
    selectionReasons,
    signals,
    signalType: record.signalType,
    websiteUrl: primaryWebsite?.value ?? null,
    weeklyPeriod: formatWeeklyPeriod(
      record.weeklyBatch.weekStart,
      record.weeklyBatch.weekEnd,
    ),
  };
}
