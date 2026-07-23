import {
  ArrowRight,
  Download,
  FileCheck2,
  FileClock,
  FileX2,
} from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";
import { cn } from "@/lib/utils";
import { CsvUploadForm } from "@/modules/admin/imports/components/csv-upload-form";

type ImportsPageProps = {
  searchParams: Promise<{ error?: string | string[] }>;
};

const statusPresentation = {
  UPLOADED: { label: "Téléversé", icon: FileClock },
  VALIDATING: { label: "Validation", icon: FileClock },
  READY: { label: "Prêt", icon: FileCheck2 },
  IMPORTING: { label: "Import en cours", icon: FileClock },
  COMPLETED: { label: "Terminé", icon: FileCheck2 },
  FAILED: { label: "Échec", icon: FileX2 },
} as const;

export default async function ImportsPage({ searchParams }: ImportsPageProps) {
  const [params, imports] = await Promise.all([
    searchParams,
    prisma.dataImport.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        filename: true,
        status: true,
        totalRows: true,
        validRows: true,
        invalidRows: true,
        duplicateRows: true,
        processedRows: true,
        createdAt: true,
        createdBy: { select: { email: true } },
      },
    }),
  ]);
  const error = Array.isArray(params.error) ? params.error[0] : params.error;

  return (
    <section className="mx-auto max-w-7xl">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-gold-dark text-xs font-semibold tracking-[0.2em] uppercase">
            Alimentation semi-manuelle
          </p>
          <h1 className="text-navy mt-2 font-serif text-4xl sm:text-5xl">
            Imports CSV
          </h1>
        </div>
        <a
          href="/affluo-import-template.csv"
          download
          className={cn(buttonVariants({ variant: "secondary" }))}
        >
          <Download aria-hidden="true" className="mr-2 size-4" />
          Télécharger le modèle
        </a>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-9 grid gap-8 xl:grid-cols-[24rem_minmax(0,1fr)]">
        <CsvUploadForm />

        <div>
          <h2 className="text-navy font-serif text-2xl">
            Historique des imports
          </h2>
          {imports.length ? (
            <div className="mt-5 space-y-4">
              {imports.map((dataImport) => {
                const presentation = statusPresentation[dataImport.status];
                const Icon = presentation.icon;
                return (
                  <article
                    key={dataImport.id}
                    className="border-navy/10 rounded-2xl border bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Icon
                            aria-hidden="true"
                            className="text-gold-dark size-4 shrink-0"
                          />
                          <h3 className="text-navy truncate font-semibold">
                            {dataImport.filename}
                          </h3>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          {dataImport.createdBy.email} ·{" "}
                          {formatDate(dataImport.createdAt)} ·{" "}
                          {presentation.label}
                        </p>
                        <p className="mt-3 text-sm text-slate-600">
                          {dataImport.totalRows} lignes · {dataImport.validRows}{" "}
                          valides · {dataImport.invalidRows} invalides ·{" "}
                          {dataImport.duplicateRows} doublons ·{" "}
                          {dataImport.processedRows} traitées
                        </p>
                      </div>
                      <Link
                        href={`/admin/imports/${dataImport.id}`}
                        className={cn(
                          buttonVariants({ variant: "secondary" }),
                          "shrink-0",
                        )}
                      >
                        Consulter
                        <ArrowRight
                          aria-hidden="true"
                          className="ml-2 size-4"
                        />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="border-navy/20 mt-5 rounded-2xl border border-dashed bg-white/60 p-10 text-center text-sm text-slate-500">
              Aucun import pour le moment.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(date);
}
