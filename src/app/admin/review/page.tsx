import { ArrowRight, CalendarDays, MapPin, ShieldAlert } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  REVIEW_STATUS_LABELS,
  reviewFilterSchema,
  reviewSortSchema,
} from "@/modules/admin/review/domain";
import { getReviewQueue } from "@/modules/admin/review/service";

type ReviewQueuePageProps = {
  searchParams: Promise<{ filter?: string; sort?: string }>;
};

const filters = [
  ["TO_REVIEW", "À examiner"],
  ["INCOMPLETE", "Incomplète"],
  ["APPROVED", "Validée"],
  ["REJECTED", "Rejetée"],
  ["INSUFFICIENT_CONTACT", "Contactabilité insuffisante"],
  ["SIGNAL_TO_VERIFY", "Signal à vérifier"],
] as const;

export default async function ReviewQueuePage({
  searchParams,
}: ReviewQueuePageProps) {
  const params = await searchParams;
  const filterResult = reviewFilterSchema.safeParse(params.filter);
  const sortResult = reviewSortSchema.safeParse(params.sort);
  const filter = filterResult.success ? filterResult.data : "TO_REVIEW";
  const sort = sortResult.success ? sortResult.data : "IMPORTED_DESC";
  const opportunities = await getReviewQueue({ filter, sort });

  return (
    <section className="mx-auto max-w-7xl">
      <p className="text-gold-dark text-xs font-semibold tracking-[0.2em] uppercase">
        Contrôle humain
      </p>
      <h1 className="text-navy mt-2 font-serif text-4xl sm:text-5xl">
        File de qualification
      </h1>
      <p className="mt-3 max-w-3xl leading-7 text-slate-600">
        Chaque opportunité reste en brouillon jusqu’à une revue explicite. Une
        validation ne l’affecte à aucun cabinet et ne la publie pas.
      </p>

      <div className="mt-8 flex flex-col gap-4">
        <nav
          aria-label="Filtres de qualification"
          className="flex gap-2 overflow-x-auto pb-2"
        >
          {filters.map(([value, label]) => (
            <Link
              key={value}
              href={`/admin/review?filter=${value}&sort=${sort}`}
              aria-current={filter === value ? "page" : undefined}
              className={cn(
                "border-navy/15 shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition",
                filter === value
                  ? "bg-navy text-white"
                  : "text-navy hover:bg-navy/5 bg-white",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
        <form className="flex items-center gap-3 self-end">
          <input type="hidden" name="filter" value={filter} />
          <label htmlFor="review-sort" className="text-xs text-slate-500">
            Trier par
          </label>
          <select
            id="review-sort"
            name="sort"
            defaultValue={sort}
            className="border-navy/20 text-navy rounded-lg border bg-white px-3 py-2 text-sm"
          >
            <option value="IMPORTED_DESC">Date d’import</option>
            <option value="EVENT_DESC">Date du signal</option>
            <option value="CONTACTABILITY_DESC">Contactabilité</option>
            <option value="CONFIDENCE_DESC">Confiance</option>
          </select>
          <button
            type="submit"
            className={cn(buttonVariants({ variant: "secondary" }), "py-2")}
          >
            Appliquer
          </button>
        </form>
      </div>

      {opportunities.length ? (
        <div className="mt-6 space-y-4">
          {opportunities.map((opportunity) => {
            const signal = opportunity.signals[0]?.signal;
            return (
              <article
                key={opportunity.id}
                className="border-navy/10 rounded-2xl border bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-navy font-serif text-2xl">
                        {opportunity.prospect.firstName}{" "}
                        {opportunity.prospect.lastName}
                      </h2>
                      <span className="border-navy/10 bg-ivory rounded-full border px-3 py-1 text-xs font-semibold text-slate-700">
                        {REVIEW_STATUS_LABELS[opportunity.reviewStatus]}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-700">
                      {opportunity.prospect.companyName}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin
                          aria-hidden="true"
                          className="text-gold-dark size-3.5"
                        />
                        {opportunity.prospect.city} ·{" "}
                        {opportunity.prospect.department}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays
                          aria-hidden="true"
                          className="text-gold-dark size-3.5"
                        />
                        {signal?.eventDate
                          ? formatDate(signal.eventDate)
                          : "Date inconnue"}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">
                      <strong className="text-navy">
                        {signal?.type ?? "Signal non renseigné"}
                      </strong>{" "}
                      · {opportunity.contactabilityStatus} ·{" "}
                      {opportunity.confidenceLevel}
                    </p>
                    {opportunity.createdImportRow ? (
                      <p className="mt-2 text-xs text-slate-400">
                        Import{" "}
                        {opportunity.createdImportRow.dataImport.filename}
                      </p>
                    ) : null}
                  </div>
                  <Link
                    href={`/admin/review/${opportunity.id}`}
                    className={cn(
                      buttonVariants({ variant: "secondary" }),
                      "shrink-0",
                    )}
                  >
                    Examiner
                    <ArrowRight aria-hidden="true" className="ml-2 size-4" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="border-navy/20 mt-7 rounded-3xl border border-dashed bg-white/60 p-14 text-center">
          <ShieldAlert
            aria-hidden="true"
            className="text-gold-dark mx-auto size-7"
          />
          <p className="text-navy mt-4 font-serif text-2xl">
            Aucune opportunité dans cette vue
          </p>
        </div>
      )}
    </section>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}
