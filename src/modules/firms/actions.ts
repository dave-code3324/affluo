"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/integrations/supabase/server";
import { onboardingSchema, parseDepartments } from "@/modules/firms/onboarding";

export type OnboardingActionState = {
  error?: string;
  success: boolean;
};

export const initialOnboardingState: OnboardingActionState = {
  success: false,
};

export async function completeOnboardingAction(
  _previousState: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const parsed = onboardingSchema.safeParse({
    firmName: formData.get("firmName"),
    city: formData.get("city"),
    department: formData.get("department"),
    nationwide: formData.get("nationwide") === "true",
    departments: parseDepartments(
      formData.get("departments")?.toString() ?? "",
    ),
    targetProfiles: formData
      .getAll("targetProfiles")
      .map((value) => value.toString()),
  });

  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ??
        "Vérifiez les informations renseignées.",
      success: false,
    };
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();

  if (!claimsData?.claims?.sub) {
    return {
      error: "Votre session a expiré. Reconnectez-vous pour continuer.",
      success: false,
    };
  }

  const { error } = await supabase.rpc("complete_onboarding", {
    departments: parsed.data.departments,
    firm_city: parsed.data.city,
    firm_department: parsed.data.department,
    firm_name: parsed.data.firmName,
    is_nationwide: parsed.data.nationwide,
    profiles: parsed.data.targetProfiles,
  });

  if (error) {
    return {
      error:
        error.message === "Onboarding already completed"
          ? "Votre cabinet est déjà configuré."
          : "Impossible d’enregistrer le cabinet. Réessayez dans un instant.",
      success: false,
    };
  }

  revalidatePath("/dashboard", "layout");
  return { success: true };
}
