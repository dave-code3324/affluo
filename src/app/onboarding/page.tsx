import { redirect } from "next/navigation";

import { requireUser } from "@/lib/permissions/firm-context";
import { OnboardingWizard } from "@/modules/firms/components/onboarding-wizard";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const { supabase, userId } = await requireUser();
  const { data: membership } = await supabase
    .from("firm_members")
    .select("firm_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (membership) {
    redirect("/dashboard");
  }

  return (
    <main className="bg-ivory relative flex min-h-screen items-center overflow-hidden px-5 py-12">
      <div
        aria-hidden="true"
        className="border-gold/20 absolute -top-32 -right-32 size-96 rounded-full border"
      />
      <div
        aria-hidden="true"
        className="bg-gold/10 absolute -bottom-48 -left-48 size-[30rem] rounded-full blur-3xl"
      />
      <div className="relative mx-auto w-full max-w-5xl">
        <p className="text-navy mb-10 font-serif text-2xl">Affluo</p>
        <OnboardingWizard />
      </div>
    </main>
  );
}
