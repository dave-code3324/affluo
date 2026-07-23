import { redirect } from "next/navigation";

import { createClient } from "@/integrations/supabase/server";

export type FirmContext = {
  email: string;
  firm: {
    city: string;
    department: string;
    id: string;
    name: string;
  };
  userId: string;
};

export async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) {
    redirect("/login");
  }

  return {
    email:
      typeof data.claims.email === "string"
        ? data.claims.email
        : "Votre compte",
    supabase,
    userId,
  };
}

export async function requireFirmContext(): Promise<FirmContext> {
  const { email, supabase, userId } = await requireUser();
  const { data: membership } = await supabase
    .from("firm_members")
    .select("firm_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!membership) {
    redirect("/onboarding");
  }

  const { data: firm } = await supabase
    .from("firms")
    .select("id, name, city, department")
    .eq("id", membership.firm_id)
    .single();

  if (!firm) {
    redirect("/onboarding");
  }

  return { email, firm, userId };
}
