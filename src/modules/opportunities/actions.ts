"use server";

import { revalidatePath } from "next/cache";

import { requireFirmContext } from "@/lib/permissions/firm-context";
import { feedbackInputSchema } from "@/modules/opportunities/domain";
import { saveOpportunityDecision } from "@/modules/opportunities/mutations";

export type DecisionActionState = {
  decision: "TO_CONTACT" | "TO_MONITOR" | "NOT_RELEVANT" | null;
  message: string | null;
  reason:
    | "WRONG_PROFILE"
    | "WEAK_SIGNAL"
    | "WRONG_LOCATION"
    | "ALREADY_KNOWN"
    | "INSUFFICIENT_CONTACT_DETAILS"
    | "OTHER"
    | null;
  status: "idle" | "success" | "error";
};

export async function saveOpportunityDecisionAction(
  previousState: DecisionActionState,
  formData: FormData,
): Promise<DecisionActionState> {
  const reason = formData.get("reason");
  const parsed = feedbackInputSchema.safeParse({
    opportunityId: formData.get("opportunityId"),
    decision: formData.get("decision"),
    reason: typeof reason === "string" ? reason : "",
  });

  if (!parsed.success) {
    return {
      ...previousState,
      message: "La décision n’a pas pu être enregistrée.",
      status: "error",
    };
  }

  const context = await requireFirmContext();

  try {
    const saved = await saveOpportunityDecision({
      decision: parsed.data.decision,
      firmId: context.firm.id,
      opportunityId: parsed.data.opportunityId,
      reason: parsed.data.reason ?? null,
      userId: context.userId,
    });

    if (!saved) {
      return {
        ...previousState,
        message: "Cette opportunité n’est pas accessible.",
        status: "error",
      };
    }

    revalidatePath(`/dashboard/opportunities/${parsed.data.opportunityId}`);

    return {
      decision: saved.decision,
      message: "Votre décision est enregistrée.",
      reason: saved.reason,
      status: "success",
    };
  } catch {
    return {
      ...previousState,
      message: "Une erreur temporaire empêche l’enregistrement.",
      status: "error",
    };
  }
}
