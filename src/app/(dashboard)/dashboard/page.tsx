import { BellRing, Sparkles } from "lucide-react";

import { AuthNotice } from "@/components/shared/auth-notice";
import { requireFirmContext } from "@/lib/permissions/firm-context";

type DashboardPageProps = {
  searchParams: Promise<{ message?: string | string[] }>;
};

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const [context, params] = await Promise.all([
    requireFirmContext(),
    searchParams,
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <AuthNotice message={params.message} />

      <header className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-gold-dark text-xs font-semibold tracking-[0.2em] uppercase">
            {context.firm.name}
          </p>
          <h1 className="text-navy mt-2 font-serif text-4xl">Opportunités</h1>
        </div>
        <p className="text-sm text-slate-500">Mise à jour hebdomadaire</p>
      </header>

      <section className="border-navy/10 relative mt-10 overflow-hidden rounded-3xl border bg-white px-6 py-16 text-center shadow-[0_24px_80px_rgba(7,24,46,0.07)] sm:px-12 sm:py-24">
        <div
          aria-hidden="true"
          className="border-gold/20 absolute -top-24 -right-24 size-64 rounded-full border"
        />
        <div className="relative mx-auto max-w-xl">
          <div className="bg-navy text-gold mx-auto flex size-16 items-center justify-center rounded-2xl">
            <Sparkles aria-hidden="true" className="size-7" />
          </div>
          <h2 className="text-navy mt-8 font-serif text-3xl">
            Aucune opportunité disponible.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            Notre équipe prépare actuellement votre première sélection.
            <br className="hidden sm:block" /> Vous serez averti par email.
          </p>
          <div className="bg-gold/10 text-gold-dark mt-8 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold">
            <BellRing aria-hidden="true" className="size-4" />
            Préparation en cours
          </div>
        </div>
      </section>
    </div>
  );
}
