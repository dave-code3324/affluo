"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdmin } from "@/lib/permissions/admin";
import {
  adminOpportunityIdSchema,
  rejectionReasonSchema,
  reviewCorrectionSchema,
} from "@/modules/admin/review/domain";
import {
  approveOpportunity,
  manuallyVerifyLinkedin,
  rejectOpportunity,
  requestOpportunityChanges,
  saveReviewCorrections,
  takeOpportunityForReview,
} from "@/modules/admin/review/service";

function reviewUrl(
  opportunityId: string,
  kind: "error" | "message",
  message: string,
) {
  return `/admin/review/${opportunityId}?${new URLSearchParams({ [kind]: message })}`;
}

export async function takeOpportunityAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = adminOpportunityIdSchema.safeParse(formData.get("opportunityId"));
  if (!id.success) {
    redirect("/admin/review");
  }
  await takeOpportunityForReview(admin.userId, id.data);
  revalidatePath(`/admin/review/${id.data}`);
  redirect(reviewUrl(id.data, "message", "Opportunité prise en revue."));
}

export async function saveReviewCorrectionsAction(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = reviewCorrectionSchema.safeParse({
    opportunityId: formData.get("opportunityId"),
    prospect: {
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      jobTitle: formData.get("jobTitle"),
      companyName: formData.get("companyName"),
      companyWebsite: formData.get("companyWebsite"),
      city: formData.get("city"),
      department: formData.get("department"),
    },
    signal: {
      id: formData.get("signalId"),
      type: formData.get("signalType"),
      title: formData.get("signalTitle"),
      description: formData.get("signalDescription"),
      eventDate: formData.get("eventDate"),
      sourceName: formData.get("sourceName"),
      sourceUrl: formData.get("sourceUrl"),
      sourcePublishedAt: formData.get("sourcePublishedAt"),
      verificationStatus: formData.get("signalVerificationStatus"),
    },
    contacts: {
      email: formData.get("professionalEmail"),
      emailStatus: formData.get("emailVerificationStatus"),
      phone: formData.get("professionalPhone"),
      phoneStatus: formData.get("phoneVerificationStatus"),
      linkedinUrl: formData.get("linkedinUrl"),
    },
    opportunity: {
      confidenceLevel: formData.get("confidenceLevel"),
      contactabilityStatus: formData.get("contactabilityStatus"),
      internalNotes: formData.get("internalNotes"),
      potentialNeeds: formData.get("potentialNeeds"),
      qualificationSummary: formData.get("qualificationSummary"),
      whyNow: formData.get("whyNow"),
    },
  });
  const fallbackId = z.uuid().safeParse(formData.get("opportunityId"));
  if (!parsed.success) {
    if (!fallbackId.success) {
      redirect("/admin/review");
    }
    const issue = parsed.error.issues[0];
    redirect(
      reviewUrl(
        fallbackId.data,
        "error",
        issue?.message ?? "Les corrections sont invalides.",
      ),
    );
  }

  const saved = await saveReviewCorrections(admin.userId, parsed.data);
  if (!saved) {
    redirect("/admin/review");
  }
  revalidatePath(`/admin/review/${saved.id}`);
  redirect(reviewUrl(saved.id, "message", "Corrections enregistrées."));
}

export async function requestChangesAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = adminOpportunityIdSchema.safeParse(formData.get("opportunityId"));
  if (!id.success) {
    redirect("/admin/review");
  }
  await requestOpportunityChanges(admin.userId, id.data);
  revalidatePath(`/admin/review/${id.data}`);
  redirect(reviewUrl(id.data, "message", "Modifications demandées."));
}

export async function approveOpportunityAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = adminOpportunityIdSchema.safeParse(formData.get("opportunityId"));
  if (!id.success) {
    redirect("/admin/review");
  }
  const result = await approveOpportunity(admin.userId, id.data);
  if (!result) {
    redirect("/admin/review");
  }
  if (!result.allowed) {
    redirect(
      reviewUrl(
        id.data,
        "error",
        result.reasons[0] ?? "L’opportunité ne peut pas être validée.",
      ),
    );
  }
  revalidatePath("/admin/review");
  redirect(
    reviewUrl(
      id.data,
      "message",
      "Opportunité validée. Elle reste en brouillon non publié.",
    ),
  );
}

export async function rejectOpportunityAction(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      opportunityId: adminOpportunityIdSchema,
      reason: rejectionReasonSchema,
    })
    .safeParse({
      opportunityId: formData.get("opportunityId"),
      reason: formData.get("rejectionReason"),
    });
  if (!parsed.success) {
    redirect("/admin/review");
  }
  await rejectOpportunity(
    admin.userId,
    parsed.data.opportunityId,
    parsed.data.reason,
  );
  revalidatePath("/admin/review");
  redirect(
    reviewUrl(parsed.data.opportunityId, "message", "Opportunité rejetée."),
  );
}

export async function verifyLinkedinAction(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      opportunityId: adminOpportunityIdSchema,
      contactDetailId: z.uuid(),
    })
    .safeParse({
      opportunityId: formData.get("opportunityId"),
      contactDetailId: formData.get("contactDetailId"),
    });
  if (!parsed.success) {
    redirect("/admin/review");
  }
  const result = await manuallyVerifyLinkedin(
    admin.userId,
    parsed.data.opportunityId,
    parsed.data.contactDetailId,
  );
  if (!result) {
    redirect("/admin/review");
  }
  revalidatePath(`/admin/review/${parsed.data.opportunityId}`);
  redirect(
    reviewUrl(
      parsed.data.opportunityId,
      "message",
      "Profil LinkedIn vérifié manuellement.",
    ),
  );
}
