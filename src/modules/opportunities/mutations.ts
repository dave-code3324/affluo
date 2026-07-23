import {
  type FeedbackDecision,
  type FeedbackReason,
  OpportunityStatus,
  WeeklyBatchStatus,
} from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

type SaveOpportunityDecisionInput = {
  decision: FeedbackDecision;
  firmId: string;
  opportunityId: string;
  reason: FeedbackReason | null;
  userId: string;
};

export async function saveOpportunityDecision({
  decision,
  firmId,
  opportunityId,
  reason,
  userId,
}: SaveOpportunityDecisionInput) {
  const opportunity = await prisma.opportunity.findFirst({
    where: {
      id: opportunityId,
      firmId,
      status: OpportunityStatus.PUBLISHED,
      weeklyBatch: {
        firmId,
        status: WeeklyBatchStatus.PUBLISHED,
        publishedAt: { not: null },
      },
    },
    select: { id: true },
  });

  if (!opportunity) {
    return null;
  }

  return prisma.opportunityFeedback.upsert({
    where: {
      opportunityId_firmId: {
        opportunityId,
        firmId,
      },
    },
    update: {
      decision,
      reason,
      userId,
    },
    create: {
      decision,
      firmId,
      opportunityId,
      reason,
      userId,
    },
    select: {
      decision: true,
      reason: true,
      updatedAt: true,
    },
  });
}
