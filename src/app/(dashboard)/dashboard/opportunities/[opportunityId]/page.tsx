import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  Radar,
  ShieldCheck,
  Sparkles,
  UserRoundSearch,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requireFirmContext } from "@/lib/permissions/firm-context";
import { ContactabilityBadge } from "@/modules/opportunities/components/contactability-badge";
import { CopyContactButton } from "@/modules/opportunities/components/copy-contact-button";
import { DecisionControls } from "@/modules/opportunities/components/decision-controls";
import { opportunityIdSchema } from "@/modules/opportunities/domain";
import type { OpportunityDetailDto } from "@/modules/opportunities/dto";
import { getPublishedOpportunityDetail } from "@/modules/opportunities/queries";

type OpportunityDetailPageProps = {
  params: Promise<{ opportunityId: string }>;
};

const contactIcons = {
  PROFESSIONAL_EMAIL: Mail,
  PROFESSIONAL_PHONE: Phone,
  LINKEDIN: Linkedin,
  COMPANY_WEBSITE: ExternalLink,
} as const;

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

  const primarySignal =
    opportunity.signals.find(({ isPrimary }) => isPrimary) ??
    opportunity.signals[0];

  return (
    <article className="mx-auto max-w-6xl pb-10">
      <Link
        href="/dashboard/opportunities"
        className="text-navy hover:text-gold-dark focus-visible:ring-gold inline-flex items-center text-sm font-semibold transition focus-visible:ring-2 focus-visible:outline-none"
      >
        <ArrowLeft aria-hidden="true" className="mr-2 size-4" />
        Retour à la sélection
      </Link>

      <header className="border-navy/10 mt-7 overflow-hidden rounded-3xl border bg-white shadow-[0_24px_80px_rgba(7,24,46,0.08)]">
        <div className="bg-navy px-6 py-8 text-white sm:px-10">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-gold-light text-xs font-semibold tracking-[0.18em] uppercase">
                Ajouté à la sélection le {opportunity.addedAt}
              </p>
              <h1 className="mt-3 font-serif text-4xl sm:text-5xl">
                {opportunity.firstName} {opportunity.lastName}
              </h1>
              <p className="mt-3 text-lg font-semibold text-white/85">
                {opportunity.jobTitle} · {opportunity.companyName}
              </p>
              <p className="mt-2 inline-flex items-center gap-2 text-sm text-white/60">
                <MapPin aria-hidden="true" className="text-gold-light size-4" />
                {opportunity.location}
              </p>
            </div>
            <ContactabilityBadge
              contactability={opportunity.contactability}
              showDescription
            />
          </div>

          <div className="mt-7 flex flex-wrap gap-3 border-t border-white/10 pt-6">
            {opportunity.primaryEmail ? (
              <CopyContactButton
                label="Copier l’email"
                value={opportunity.primaryEmail}
              />
            ) : null}
            {opportunity.linkedinUrl ? (
              <a
                href={opportunity.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: "secondary" }))}
              >
                <Linkedin aria-hidden="true" className="mr-2 size-4" />
                Ouvrir LinkedIn
              </a>
            ) : null}
            {opportunity.websiteUrl ? (
              <a
                href={opportunity.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: "secondary" }))}
              >
                <ExternalLink aria-hidden="true" className="mr-2 size-4" />
                Visiter le site
              </a>
            ) : null}
          </div>
        </div>

        {opportunity.professionalProfileSummary ? (
          <div className="border-navy/10 border-t px-6 py-5 text-sm leading-6 text-slate-600 sm:px-10">
            <strong className="text-navy">Profil professionnel : </strong>
            {opportunity.professionalProfileSummary}
          </div>
        ) : null}
      </header>

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-8">
          <section
            aria-labelledby="why-now"
            className="border-gold/35 overflow-hidden rounded-3xl border bg-white shadow-[0_18px_60px_rgba(7,24,46,0.06)]"
          >
            <div className="bg-gold/12 px-6 py-4 sm:px-8">
              <p className="text-gold-dark flex items-center gap-2 text-xs font-semibold tracking-[0.17em] uppercase">
                <Radar aria-hidden="true" className="size-4" />
                Pourquoi maintenant ?
              </p>
            </div>
            <div className="px-6 py-7 sm:px-8">
              <div className="border-l-2 border-emerald-600 pl-5">
                <p className="text-xs font-semibold tracking-[0.14em] text-emerald-800 uppercase">
                  {primarySignal?.verificationLabel === "Signal vérifié" &&
                  primarySignal.source
                    ? "Fait vérifié"
                    : "Fait à confirmer"}
                </p>
                <h2 id="why-now" className="text-navy mt-2 font-serif text-3xl">
                  {primarySignal?.title ?? opportunity.signalSummary}
                </h2>
                <p className="mt-3 leading-7 text-slate-600">
                  {primarySignal?.description ?? opportunity.signalSummary}
                  {primarySignal?.eventDate
                    ? ` Événement daté du ${primarySignal.eventDate}.`
                    : ""}
                </p>
              </div>
              <div className="mt-7 rounded-2xl bg-violet-50 p-5">
                <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-violet-800 uppercase">
                  <Sparkles aria-hidden="true" className="size-4" />
                  Interprétation Affluo
                </p>
                <p className="mt-3 leading-7 text-slate-700">
                  {opportunity.whyNow}
                </p>
              </div>
            </div>
          </section>

          <section
            aria-labelledby="selection-reasons"
            className="border-navy/10 rounded-3xl border bg-white p-6 sm:p-8"
          >
            <p className="text-gold-dark text-xs font-semibold tracking-[0.16em] uppercase">
              Qualification
            </p>
            <h2
              id="selection-reasons"
              className="text-navy mt-2 font-serif text-3xl"
            >
              Raisons de la sélection
            </h2>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {opportunity.selectionReasons.map((reason) => (
                <li
                  key={reason}
                  className="bg-ivory/70 flex items-start gap-3 rounded-xl p-4 text-sm leading-6 text-slate-700"
                >
                  <CheckCircle2
                    aria-hidden="true"
                    className="mt-1 size-4 shrink-0 text-emerald-700"
                  />
                  {reason}
                </li>
              ))}
            </ul>
          </section>

          <DecisionInformation opportunity={opportunity} />

          <section
            aria-labelledby="contact-details"
            className="border-navy/10 rounded-3xl border bg-white p-6 sm:p-8"
          >
            <p className="text-gold-dark text-xs font-semibold tracking-[0.16em] uppercase">
              Faits vérifiés
            </p>
            <h2
              id="contact-details"
              className="text-navy mt-2 font-serif text-3xl"
            >
              Coordonnées professionnelles
            </h2>
            {opportunity.contactDetails.length > 0 ? (
              <ul className="mt-6 grid gap-4 sm:grid-cols-2">
                {opportunity.contactDetails.map((contact) => {
                  const Icon = contactIcons[contact.type];
                  return (
                    <li
                      key={contact.id}
                      className="border-navy/10 rounded-2xl border p-5"
                    >
                      <div className="flex items-start gap-3">
                        <Icon
                          aria-hidden="true"
                          className="text-gold-dark mt-1 size-4 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-navy font-semibold">
                            {contact.label}
                          </p>
                          <p className="mt-2 text-sm break-all text-slate-700">
                            {contact.value}
                          </p>
                        </div>
                      </div>
                      <dl className="border-navy/8 mt-4 space-y-2 border-t pt-4 text-xs text-slate-500">
                        <div className="flex justify-between gap-4">
                          <dt>Dernière vérification</dt>
                          <dd className="text-right">
                            {contact.verifiedAt ?? "Non renseignée"}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt>Méthode</dt>
                          <dd className="text-right">
                            {contact.verificationMethod ?? "Non renseignée"}
                          </dd>
                        </div>
                      </dl>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-5 text-sm text-slate-600">
                Aucune coordonnée utilisable n’est disponible.
              </p>
            )}
          </section>

          <section
            aria-labelledby="sources"
            className="border-navy/10 rounded-3xl border bg-white p-6 sm:p-8"
          >
            <p className="text-gold-dark text-xs font-semibold tracking-[0.16em] uppercase">
              Traçabilité
            </p>
            <h2 id="sources" className="text-navy mt-2 font-serif text-3xl">
              Sources publiques
            </h2>
            <div className="mt-6 space-y-4">
              {opportunity.signals
                .filter(({ source }) => source)
                .map((signal) => (
                  <div
                    key={signal.id}
                    className="border-navy/10 rounded-2xl border p-5"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold tracking-[0.12em] text-emerald-800 uppercase">
                          {signal.verificationLabel}
                        </p>
                        <h3 className="text-navy mt-2 font-semibold">
                          {signal.title}
                        </h3>
                        <p className="mt-2 text-sm text-slate-500">
                          {signal.source?.name}
                          {signal.source?.publishedAt
                            ? ` · publiée le ${signal.source.publishedAt}`
                            : ""}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Vérification Affluo :{" "}
                          {signal.source?.verifiedAt ?? "non renseignée"}
                        </p>
                      </div>
                      {signal.source ? (
                        <a
                          href={signal.source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            buttonVariants({ variant: "secondary" }),
                            "shrink-0",
                          )}
                        >
                          Consulter
                          <ExternalLink
                            aria-hidden="true"
                            className="ml-2 size-4"
                          />
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              {opportunity.signals.every(({ source }) => !source) ? (
                <p className="text-sm text-slate-600">
                  Aucune source publique validée n’est affichable.
                </p>
              ) : null}
            </div>
          </section>
        </div>

        <aside className="space-y-6 xl:sticky xl:top-8 xl:h-fit">
          <DecisionControls
            opportunityId={opportunity.id}
            initialDecision={opportunity.decision?.decision ?? null}
            initialReason={opportunity.decision?.reason ?? null}
          />

          <div className="border-navy/10 rounded-2xl border bg-white p-5">
            <p className="text-gold-dark flex items-center gap-2 text-xs font-semibold tracking-[0.14em] uppercase">
              <CalendarDays aria-hidden="true" className="size-4" />
              Sélection
            </p>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-slate-500">Période</dt>
                <dd className="text-navy mt-1 font-semibold">
                  {opportunity.weeklyPeriod}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Publication</dt>
                <dd className="text-navy mt-1 font-semibold">
                  {opportunity.publishedAt}
                </dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </article>
  );
}

function DecisionInformation({
  opportunity,
}: {
  opportunity: OpportunityDetailDto;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section
        aria-labelledby="verified-facts"
        className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-6"
      >
        <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-emerald-800 uppercase">
          <ShieldCheck aria-hidden="true" className="size-4" />
          Informations établies
        </p>
        <h2 id="verified-facts" className="text-navy mt-2 font-serif text-2xl">
          Faits vérifiés
        </h2>
        <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-700">
          {opportunity.facts.map((fact) => (
            <li key={fact} className="flex items-start gap-3">
              <CheckCircle2
                aria-hidden="true"
                className="mt-1 size-4 shrink-0 text-emerald-700"
              />
              {fact}
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="estimates"
        className="rounded-3xl border border-blue-200 bg-blue-50/60 p-6"
      >
        <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-blue-800 uppercase">
          <UserRoundSearch aria-hidden="true" className="size-4" />
          Évaluation Affluo
        </p>
        <h2 id="estimates" className="text-navy mt-2 font-serif text-2xl">
          Estimations
        </h2>
        <dl className="mt-5 space-y-4 text-sm">
          <div>
            <dt className="text-navy font-semibold">
              {opportunity.confidence.label}
            </dt>
            <dd className="mt-1 leading-6 text-slate-600">
              {opportunity.confidence.description}
            </dd>
          </div>
          <div>
            <dt className="text-navy font-semibold">
              {opportunity.contactability.label}
            </dt>
            <dd className="mt-1 leading-6 text-slate-600">
              {opportunity.contactability.description}
            </dd>
          </div>
        </dl>
      </section>

      <section
        aria-labelledby="hypotheses"
        className="rounded-3xl border border-amber-200 bg-amber-50/70 p-6 lg:col-span-2"
      >
        <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-amber-900 uppercase">
          <Sparkles aria-hidden="true" className="size-4" />
          Interprétations à valider
        </p>
        <h2 id="hypotheses" className="text-navy mt-2 font-serif text-2xl">
          {opportunity.hypotheses.label}
        </h2>
        {opportunity.hypotheses.items.length > 0 ? (
          <ul className="mt-5 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
            {opportunity.hypotheses.items.map((need) => (
              <li
                key={need}
                className="rounded-xl border border-amber-200 bg-white/70 p-4"
              >
                {need}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-slate-600">
            Aucune hypothèse patrimoniale n’a été retenue.
          </p>
        )}
        <p className="mt-5 border-t border-amber-200 pt-4 text-xs leading-5 font-medium text-amber-950">
          {opportunity.hypotheses.disclaimer}
        </p>
      </section>
    </div>
  );
}
