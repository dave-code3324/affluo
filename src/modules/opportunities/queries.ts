import {
  ContactabilityStatus,
  EmailVerificationStatus,
  OpportunityStatus,
  Prisma,
  WeeklyBatchStatus,
} from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import {
  type OpportunityCardDto,
  type OpportunityDetailDto,
  type WeeklySelectionDto,
} from "@/modules/opportunities/dto";
import {
  formatPublishedDate,
  formatWeeklyPeriod,
  getContactabilityPresentation,
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
          not: EmailVerificationStatus.INVALID,
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
      weeklyBatch: {
        select: {
          weekStart: true,
          weekEnd: true,
          publishedAt: true,
        },
      },
    },
  });

  if (!record?.weeklyBatch.publishedAt) {
    return null;
  }

  return {
    ...toOpportunityCard(record),
    linkedinUrl: record.prospect.linkedinUrl,
    professionalEmail: record.prospect.professionalEmail,
    publishedAt: formatPublishedDate(record.weeklyBatch.publishedAt),
    signalType: record.signalType,
    weeklyPeriod: formatWeeklyPeriod(
      record.weeklyBatch.weekStart,
      record.weeklyBatch.weekEnd,
    ),
  };
}
