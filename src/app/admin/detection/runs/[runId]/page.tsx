import { ArrowLeft, RotateCcw } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";
import { retryDetectionAction } from "@/modules/detection/actions";

type DetectionRunPageProps = {
  params: Promise<{ runId: string }>;
};

export default async function DetectionRunPage({
  params,
}: DetectionRunPageProps) {
  const route = await params;
  const id = z.uuid().safeParse(route.runId);
  if (!id.success) {
    notFound();
  }
  const run = await prisma.detectionRun.findUnique({
    where: { id: id.data },
    select: {
      id: true,
      sourceKey: true,
      status: true,
      startedAt: true,
      completedAt: true,
      documentsCollected: true,
      documentsProcessed: true,
      signalsDetected: true,
      prospectsCreated: true,
      opportunitiesCreated: true,
      opportunitiesIgnored: true,
      errorsCount: true,
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          status: true,
          rejectionReasons: true,
          matchingReasons: true,
          errorMessage: true,
          attemptCount: true,
          durationMs: true,
          sourceDocument: {
            select: {
              id: true,
              externalId: true,
              title: true,
              sourceUrl: true,
              publishedAt: true,
              processingStatus: true,
              signals: {
                take: 1,
                select: {
                  id: true,
                  type: true,
                  title: true,
                  confidenceLevel: true,
                  verificationStatus: true,
                  opportunities: {
                    take: 1,
                    select: { opportunityId: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!run) {
    notFound();
  }
  const retryable =
    run.status === "FAILED" || run.status === "COMPLETED_WITH_ERRORS";

  return (
    <section className="mx-auto max-w-7xl">
      <Link
        href="/admin/detection"
        className="text-navy inline-flex items-center text-sm font-semibold hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="mr-2 size-4" />
        Retour à la détection
      </Link>

      <div className="mt-7 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-gold-dark text-xs font-semibold tracking-[0.18em] uppercase">
            {run.sourceKey} · {statusLabel(run.status)}
          </p>
          <h1 className="text-navy mt-2 font-serif text-4xl">
            Exécution du {formatDate(run.startedAt ?? new Date())}
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            Terminée : {run.completedAt ? formatDate(run.completedAt) : "non"}
          </p>
        </div>
        {retryable ? (
          <form action={retryDetectionAction}>
            <input type="hidden" name="runId" value={run.id} />
            <Button type="submit">
              <RotateCcw aria-hidden="true" className="mr-2 size-4" />
              Relancer les erreurs
            </Button>
          </form>
        ) : null}
      </div>

      <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Documents"
          value={`${run.documentsProcessed}/${run.documentsCollected}`}
        />
        <Metric label="Signaux" value={String(run.signalsDetected)} />
        <Metric label="Prospects créés" value={String(run.prospectsCreated)} />
        <Metric
          label="Opportunités créées"
          value={String(run.opportunitiesCreated)}
        />
        <Metric
          label="Éléments ignorés"
          value={String(run.opportunitiesIgnored)}
        />
        <Metric label="Erreurs" value={String(run.errorsCount)} />
      </dl>

      <div className="border-navy/10 mt-9 overflow-hidden rounded-2xl border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[72rem] text-left text-sm">
            <thead className="bg-navy text-white">
              <tr>
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">Publication</th>
                <th className="px-4 py-3">Traitement</th>
                <th className="px-4 py-3">Signal</th>
                <th className="px-4 py-3">Décision</th>
                <th className="px-4 py-3">Résultat</th>
              </tr>
            </thead>
            <tbody className="divide-navy/10 divide-y">
              {run.items.map((item) => {
                const signal = item.sourceDocument.signals[0];
                const opportunityId = signal?.opportunities[0]?.opportunityId;
                return (
                  <tr key={item.id} className="align-top">
                    <td className="px-4 py-4">
                      <a
                        href={item.sourceDocument.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-navy font-semibold underline"
                      >
                        {item.sourceDocument.title}
                      </a>
                      <span className="mt-1 block text-xs text-slate-500">
                        {item.sourceDocument.externalId ?? "Sans identifiant"} ·{" "}
                        {item.attemptCount} tentative(s)
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {item.sourceDocument.publishedAt
                        ? formatDate(item.sourceDocument.publishedAt)
                        : "—"}
                    </td>
                    <td className="px-4 py-4">
                      {statusLabel(item.status)}
                      {item.durationMs !== null ? (
                        <span className="mt-1 block text-xs text-slate-500">
                          {item.durationMs} ms
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-4">
                      {signal ? (
                        <>
                          <strong>{signal.type}</strong>
                          <span className="mt-1 block text-xs text-slate-500">
                            {signal.confidenceLevel} ·{" "}
                            {signal.verificationStatus}
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="max-w-sm px-4 py-4 text-xs">
                      {item.rejectionReasons.length
                        ? item.rejectionReasons.join(", ")
                        : item.matchingReasons.join(", ") || "—"}
                      {item.errorMessage ? (
                        <span className="mt-1 block text-red-700">
                          {item.errorMessage}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-4">
                      {opportunityId ? (
                        <Link
                          href={`/admin/review/${opportunityId}`}
                          className="text-navy font-semibold underline"
                        >
                          Ouvrir l’opportunité
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!run.items.length ? (
          <p className="p-10 text-center text-sm text-slate-500">
            Aucun document n’a été collecté.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-navy/10 rounded-xl border bg-white p-5">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-navy mt-2 text-2xl font-semibold">{value}</dd>
    </div>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(date);
}

function statusLabel(status: string) {
  return (
    {
      PENDING: "En attente",
      RUNNING: "En cours",
      COMPLETED: "Terminée",
      COMPLETED_WITH_ERRORS: "Terminée avec erreurs",
      FAILED: "Échec",
      COLLECTED: "Collecté",
      PROCESSING: "Traitement",
      PROCESSED: "Traité",
      IGNORED: "Ignoré",
    }[status] ?? status
  );
}
