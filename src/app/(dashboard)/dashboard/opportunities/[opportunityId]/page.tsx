import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Linkedin,
  Mail,
  MapPin,
  Radio,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requireFirmContext } from "@/lib/permissions/firm-context";
import { ContactabilityBadge } from "@/modules/opportunities/components/contactability-badge";
import { opportunityIdSchema } from "@/modules/opportunities/domain";
import { getPublishedOpportunityDetail } from "@/modules/opportunities/queries";

type OpportunityDetailPageProps = {
  params: Promise<{ opportunityId: string }>;
};

export default async function OpportunityDetailPage({
  params,
}: OpportunityDetailPageProps) {
  const [{ firm }, routeParameters] = await Promise.all([
    requireFirmContext(),
    params,
  ]);
  const parsedId = opportunityIdSchema.safeParse(routeParameters.opportunityId);

  if (!parsedId.success) {
    notFound();
  }

  const opportunity = await getPublishedOpportunityDetail({
    firmId: firm.id,
    opportunityId: parsedId.data,
  });

  if (!opportunity) {
    notFound();
  }

  return (
    <article className="mx-auto max-w-5xl">
      <Link
        href="/dashboard/opportunities"
        className="text-navy hover:text-gold-dark inline-flex items-center text-sm font-semibold transition"
      >
        <ArrowLeft aria-hidden="true" className="mr-2 size-4" />
        Retour aux opportunités
      </Link>

      <div className="border-navy/10 mt-7 overflow-hidden rounded-3xl border bg-white shadow-[0_24px_80px_rgba(7,24,46,0.08)]">
        <header className="bg-navy px-6 py-8 text-white sm:px-10">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-gold-light text-xs font-semibold tracking-[0.18em] uppercase">
                {opportunity.title}
              </p>
              <h1 className="mt-3 font-serif text-4xl sm:text-5xl">
                {opportunity.firstName} {opportunity.lastName}
              </h1>
              <p className="mt-3 font-semibold text-white/80">
                {opportunity.jobTitle}
              </p>
            </div>
            <ContactabilityBadge contactability={opportunity.contactability} />
          </div>
          <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 border-t border-white/10 pt-5 text-sm text-white/65">
            <span className="inline-flex items-center gap-2">
              <Building2
                aria-hidden="true"
                className="text-gold-light size-4"
              />
              {opportunity.companyName}
            </span>
            <span className="inline-flex items-center gap-2">
              <MapPin aria-hidden="true" className="text-gold-light size-4" />
              {opportunity.location}
            </span>
            <span className="inline-flex items-center gap-2">
              <CalendarDays
                aria-hidden="true"
                className="text-gold-light size-4"
              />
              {opportunity.weeklyPeriod}
            </span>
          </div>
        </header>

        <div className="grid gap-10 px-6 py-8 sm:px-10 sm:py-10 lg:grid-cols-[1fr_18rem]">
          <div className="space-y-9">
            <section>
              <p className="text-gold-dark flex items-center gap-2 text-xs font-semibold tracking-[0.16em] uppercase">
                <Radio aria-hidden="true" className="size-4" />
                Signal détecté · {opportunity.signalType}
              </p>
              <h2 className="text-navy mt-3 font-serif text-2xl">
                {opportunity.signalSummary}
              </h2>
            </section>
            <section className="border-navy/10 border-t pt-8">
              <h2 className="text-navy font-serif text-2xl">
                Pourquoi maintenant ?
              </h2>
              <p className="mt-3 leading-7 text-slate-600">
                {opportunity.whyNow}
              </p>
            </section>
          </div>

          <aside className="border-navy/10 bg-ivory/70 h-fit rounded-2xl border p-5">
            <p className="text-gold-dark text-xs font-semibold tracking-[0.16em] uppercase">
              Contact professionnel
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {opportunity.contactability.description}
            </p>
            <div className="mt-5 space-y-3">
              {opportunity.linkedinUrl ? (
                <a
                  href={opportunity.linkedinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    buttonVariants({ variant: "secondary" }),
                    "w-full",
                  )}
                >
                  <Linkedin aria-hidden="true" className="mr-2 size-4" />
                  Profil LinkedIn
                </a>
              ) : null}
              {opportunity.professionalEmail ? (
                <a
                  href={`mailto:${opportunity.professionalEmail}`}
                  className={cn(
                    buttonVariants({ variant: "secondary" }),
                    "w-full break-all",
                  )}
                >
                  <Mail aria-hidden="true" className="mr-2 size-4 shrink-0" />
                  {opportunity.professionalEmail}
                </a>
              ) : null}
            </div>
            <p className="border-navy/10 mt-5 border-t pt-4 text-xs text-slate-500">
              Sélection publiée le {opportunity.publishedAt}.
            </p>
          </aside>
        </div>
      </div>
    </article>
  );
}
