import { Activity, ArrowRight, Play, Radar } from "lucide-react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";
import { cn } from "@/lib/utils";
import { detectionConfig } from "@/modules/detection/config";
import { startDetectionAction } from "@/modules/detection/actions";
import { detectionSources } from "@/modules/detection/sources/registry";

type DetectionPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    message?: string | string[];
  }>;
};

export default async function DetectionPage({
  searchParams,
}: DetectionPageProps) {
  const [params, runs] = await Promise.all([
    searchParams,
    prisma.detectionRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        sourceKey: true,
        status: true,
        startedAt: true,
        completedAt: true,
        documentsCollected: true,
        documentsProcessed: true,
        signalsDetected: true,
        opportunitiesCreated: true,
        errorsCount: true,
        createdAt: true,
      },
    }),
  ]);
  const error = first(params.error);
  const message = first(params.message);
  const sources = detectionSources();

  return (
    <section className="mx-auto max-w-7xl">
      <p className="text-gold-dark text-xs font-semibold tracking-[0.2em] uppercase">
        Patrimoine Radar
      </p>
      <h1 className="text-navy mt-2 font-serif text-4xl sm:text-5xl">
        Détection automatique
      </h1>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">
        Chaque source produit uniquement des opportunités en brouillon, non
        affectées, qui doivent être revues par un humain.
      </p>

      {!detectionConfig.enabled ? (
        <Notice kind="warning">
          Le moteur est désactivé. Définissez `DETECTION_ENABLED=true` et
          activez explicitement une source.
        </Notice>
      ) : null}
      {error ? <Notice kind="error">{error}</Notice> : null}
      {message ? <Notice kind="message">{message}</Notice> : null}

      <div className="mt-9 grid gap-5 lg:grid-cols-2">
        {sources.map((registration) => {
          const latest = runs.find(
            ({ sourceKey }) => sourceKey === registration.source.key,
          );
          const nextRun =
            latest?.startedAt && !registration.isDemo
              ? new Date(
                  latest.startedAt.getTime() +
                    registration.intervalMinutes * 60_000,
                )
              : null;
          return (
            <article
              key={registration.source.key}
              className="border-navy/10 rounded-2xl border bg-white p-6 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Radar
                      aria-hidden="true"
                      className="text-gold-dark size-5"
                    />
                    <h2 className="text-navy font-serif text-2xl">
                      {registration.source.label}
                    </h2>
                  </div>
                  <p className="mt-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    {registration.enabled ? "Source active" : "Source inactive"}{" "}
                    · toutes les {registration.intervalMinutes} minutes
                  </p>
                </div>
                {registration.isDemo ? (
                  <span className="bg-gold/20 text-navy rounded-full px-3 py-1 text-xs font-semibold">
                    Simulation
                  </span>
                ) : null}
              </div>
              <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
                <Metric
                  label="Dernière exécution"
                  value={latest?.startedAt ? formatDate(latest.startedAt) : "—"}
                />
                <Metric
                  label="Prochaine prévue"
                  value={nextRun ? formatDate(nextRun) : "Manuelle"}
                />
                <Metric
                  label="Dernier statut"
                  value={latest ? runStatus(latest.status) : "Jamais exécutée"}
                />
                <Metric
                  label="Opportunités"
                  value={String(latest?.opportunitiesCreated ?? 0)}
                />
              </dl>
              <form action={startDetectionAction} className="mt-6">
                <input
                  type="hidden"
                  name="sourceKey"
                  value={registration.source.key}
                />
                <Button
                  type="submit"
                  disabled={!detectionConfig.enabled || !registration.enabled}
                >
                  <Play aria-hidden="true" className="mr-2 size-4" />
                  Lancer maintenant
                </Button>
              </form>
            </article>
          );
        })}
      </div>

      <div className="mt-12 flex items-center gap-3">
        <Activity aria-hidden="true" className="text-gold-dark size-5" />
        <h2 className="text-navy font-serif text-3xl">
          Historique des exécutions
        </h2>
      </div>
      <div className="border-navy/10 mt-5 overflow-hidden rounded-2xl border bg-white">
        {runs.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[60rem] text-left text-sm">
              <thead className="bg-navy text-white">
                <tr>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Documents</th>
                  <th className="px-4 py-3">Signaux</th>
                  <th className="px-4 py-3">Opportunités</th>
                  <th className="px-4 py-3">Erreurs</th>
                  <th className="px-4 py-3">Détail</th>
                </tr>
              </thead>
              <tbody className="divide-navy/10 divide-y">
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td className="px-4 py-4 font-semibold">{run.sourceKey}</td>
                    <td className="px-4 py-4">
                      {formatDate(run.startedAt ?? run.createdAt)}
                    </td>
                    <td className="px-4 py-4">{runStatus(run.status)}</td>
                    <td className="px-4 py-4">
                      {run.documentsProcessed}/{run.documentsCollected}
                    </td>
                    <td className="px-4 py-4">{run.signalsDetected}</td>
                    <td className="px-4 py-4">{run.opportunitiesCreated}</td>
                    <td className="px-4 py-4">{run.errorsCount}</td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/admin/detection/runs/${run.id}`}
                        className={cn(
                          buttonVariants({ variant: "secondary" }),
                          "h-9",
                        )}
                      >
                        Ouvrir
                        <ArrowRight
                          aria-hidden="true"
                          className="ml-2 size-4"
                        />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="p-10 text-center text-sm text-slate-500">
            Aucune exécution enregistrée.
          </p>
        )}
      </div>
    </section>
  );
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-navy mt-1 font-semibold">{value}</dd>
    </div>
  );
}

function Notice({
  children,
  kind,
}: {
  children: React.ReactNode;
  kind: "error" | "message" | "warning";
}) {
  const style =
    kind === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : kind === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-emerald-200 bg-emerald-50 text-emerald-800";
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={`mt-6 rounded-xl border px-4 py-3 text-sm ${style}`}
    >
      {children}
    </p>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(date);
}

function runStatus(status: string) {
  return (
    {
      PENDING: "En attente",
      RUNNING: "En cours",
      COMPLETED: "Terminée",
      COMPLETED_WITH_ERRORS: "Terminée avec erreurs",
      FAILED: "Échec",
    }[status] ?? status
  );
}
