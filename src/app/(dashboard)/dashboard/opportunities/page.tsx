import { ArrowLeft, ArrowRight, Clock3, Sparkles } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requireFirmContext } from "@/lib/permissions/firm-context";
import { OpportunityCard } from "@/modules/opportunities/components/opportunity-card";
import { paginationSchema } from "@/modules/opportunities/domain";
import { getLatestPublishedSelection } from "@/modules/opportunities/queries";

type OpportunitiesPageProps = {
  searchParams: Promise<{ page?: string }>;
};

export default async function OpportunitiesPage({
  searchParams,
}: OpportunitiesPageProps) {
  const [{ firm }, parameters] = await Promise.all([
    requireFirmContext(),
    searchParams,
  ]);
  const parsedPage = paginationSchema.safeParse(parameters.page ?? 1);
  const page = parsedPage.success ? parsedPage.data : 1;
  const selection = await getLatestPublishedSelection({
    firmId: firm.id,
    page,
  });

  if (selection.kind === "none") {
    return (
      <section className="mx-auto max-w-6xl">
        <PageHeading />
        <div className="border-navy/10 mt-10 overflow-hidden rounded-3xl border bg-white px-6 py-16 text-center shadow-[0_24px_80px_rgba(7,24,46,0.06)] sm:px-12">
          <div className="bg-gold/15 text-gold-dark mx-auto flex size-14 items-center justify-center rounded-full">
            <Clock3 aria-hidden="true" className="size-6" />
          </div>
          <h2 className="text-navy mt-6 font-serif text-3xl">
            Votre première sélection est en préparation
          </h2>
          <p className="mx-auto mt-4 max-w-xl leading-7 text-slate-600">
            Notre équipe qualifie les opportunités correspondant aux critères de
            votre cabinet. Vous serez averti par email dès qu’elles seront
            disponibles.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl">
      <PageHeading />

      <div className="border-gold/30 bg-navy mt-8 rounded-2xl border px-6 py-6 text-white shadow-[0_20px_70px_rgba(7,24,46,0.15)] sm:flex sm:items-end sm:justify-between sm:gap-8">
        <div>
          <p className="text-gold-light text-xs font-semibold tracking-[0.18em] uppercase">
            Sélection publiée le {selection.batch.publishedAt}
          </p>
          <h2 className="mt-2 font-serif text-2xl sm:text-3xl">
            {selection.batch.period}
          </h2>
          {selection.batch.summary ? (
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
              {selection.batch.summary}
            </p>
          ) : null}
        </div>
        <p className="mt-5 shrink-0 text-sm text-white/70 sm:mt-0">
          <strong className="text-gold-light font-serif text-3xl">
            {selection.batch.opportunityCount}
          </strong>{" "}
          opportunité
          {selection.batch.opportunityCount > 1 ? "s" : ""}
        </p>
      </div>

      {selection.batch.opportunityCount === 0 ? (
        <div className="border-navy/20 mt-10 rounded-2xl border border-dashed bg-white/60 p-12 text-center">
          <Sparkles
            aria-hidden="true"
            className="text-gold-dark mx-auto size-6"
          />
          <h2 className="text-navy mt-4 font-serif text-2xl">
            Aucune opportunité qualifiée cette semaine
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-600">
            Nous privilégions la qualité. La prochaine sélection sera publiée
            dès que des prospects suffisamment pertinents et contactables auront
            été identifiés.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {selection.opportunities.map((opportunity) => (
              <OpportunityCard key={opportunity.id} opportunity={opportunity} />
            ))}
          </div>

          {selection.pagination.totalPages > 1 ? (
            <nav
              aria-label="Pagination des opportunités"
              className="mt-10 flex items-center justify-center gap-4"
            >
              {page > 1 ? (
                <Link
                  href={`/dashboard/opportunities?page=${page - 1}`}
                  className={cn(buttonVariants({ variant: "secondary" }))}
                >
                  <ArrowLeft aria-hidden="true" className="mr-2 size-4" />
                  Précédent
                </Link>
              ) : null}
              <span className="text-sm text-slate-500">
                Page {page} sur {selection.pagination.totalPages}
              </span>
              {page < selection.pagination.totalPages ? (
                <Link
                  href={`/dashboard/opportunities?page=${page + 1}`}
                  className={cn(buttonVariants({ variant: "secondary" }))}
                >
                  Suivant
                  <ArrowRight aria-hidden="true" className="ml-2 size-4" />
                </Link>
              ) : null}
            </nav>
          ) : null}
        </>
      )}
    </section>
  );
}

function PageHeading() {
  return (
    <>
      <p className="text-gold-dark text-xs font-semibold tracking-[0.2em] uppercase">
        Votre sélection
      </p>
      <h1 className="text-navy mt-2 font-serif text-4xl sm:text-5xl">
        Opportunités
      </h1>
      <p className="mt-3 max-w-2xl leading-7 text-slate-600">
        Une courte sélection de prospects qualifiés, pertinents et joignables.
      </p>
    </>
  );
}
