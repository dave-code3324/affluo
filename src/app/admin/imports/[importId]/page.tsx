import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Play,
  RotateCcw,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { Button, buttonVariants } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";
import { cn } from "@/lib/utils";
import {
  cancelImportAction,
  resolveDuplicateAction,
  runImportAction,
} from "@/modules/admin/imports/actions";
import type { ImportFieldError } from "@/modules/admin/imports/types";

type ImportDetailPageProps = {
  params: Promise<{ importId: string }>;
  searchParams: Promise<{
    error?: string | string[];
    message?: string | string[];
    page?: string;
  }>;
};

const PAGE_SIZE = 50;

export default async function ImportDetailPage({
  params,
  searchParams,
}: ImportDetailPageProps) {
  const [route, query] = await Promise.all([params, searchParams]);
  const id = z.uuid().safeParse(route.importId);
  if (!id.success) {
    notFound();
  }
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const [dataImport, rowCount, unresolvedDuplicates] = await Promise.all([
    prisma.dataImport.findUnique({
      where: { id: id.data },
      select: {
        id: true,
        filename: true,
        status: true,
        failureMessage: true,
        totalRows: true,
        validRows: true,
        invalidRows: true,
        duplicateRows: true,
        processedRows: true,
        createdAt: true,
        completedAt: true,
        createdBy: { select: { email: true } },
        rows: {
          orderBy: { rowNumber: "asc" },
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
          select: {
            id: true,
            rowNumber: true,
            rawData: true,
            status: true,
            errorMessages: true,
            duplicateMatchLevel: true,
            duplicateResolution: true,
            duplicateOfProspectId: true,
            createdOpportunityId: true,
          },
        },
      },
    }),
    prisma.importRow.count({ where: { importId: id.data } }),
    prisma.importRow.count({
      where: {
        importId: id.data,
        status: "DUPLICATE",
        duplicateResolution: null,
      },
    }),
  ]);
  if (!dataImport) {
    notFound();
  }

  const error = first(query.error);
  const message = first(query.message);
  const totalPages = Math.max(1, Math.ceil(rowCount / PAGE_SIZE));

  return (
    <section className="mx-auto max-w-7xl">
      <Link
        href="/admin/imports"
        className="text-navy inline-flex items-center text-sm font-semibold hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="mr-2 size-4" />
        Retour aux imports
      </Link>

      <div className="mt-7 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-gold-dark text-xs font-semibold tracking-[0.18em] uppercase">
            Import {statusLabel(dataImport.status)}
          </p>
          <h1 className="text-navy mt-2 font-serif text-4xl break-all">
            {dataImport.filename}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Créé par {dataImport.createdBy.email} le{" "}
            {formatDate(dataImport.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {dataImport.invalidRows > 0 ? (
            <a
              href={`/admin/imports/${dataImport.id}/errors`}
              className={cn(buttonVariants({ variant: "secondary" }))}
            >
              <Download aria-hidden="true" className="mr-2 size-4" />
              Exporter les erreurs
            </a>
          ) : null}
          {dataImport.status === "READY" ? (
            <>
              <form action={cancelImportAction}>
                <input type="hidden" name="importId" value={dataImport.id} />
                <Button type="submit" variant="secondary">
                  <XCircle aria-hidden="true" className="mr-2 size-4" />
                  Annuler
                </Button>
              </form>
              <form action={runImportAction}>
                <input type="hidden" name="importId" value={dataImport.id} />
                <Button type="submit" disabled={unresolvedDuplicates > 0}>
                  <Play aria-hidden="true" className="mr-2 size-4" />
                  Lancer l’import
                </Button>
              </form>
            </>
          ) : null}
        </div>
      </div>

      {error ? <Notice kind="error">{error}</Notice> : null}
      {message ? <Notice kind="message">{message}</Notice> : null}
      {dataImport.failureMessage ? (
        <Notice kind="error">{dataImport.failureMessage}</Notice>
      ) : null}
      {unresolvedDuplicates > 0 ? (
        <Notice kind="warning">
          {unresolvedDuplicates} doublon
          {unresolvedDuplicates > 1 ? "s doivent" : " doit"} être résolu
          {unresolvedDuplicates > 1 ? "s" : ""} avant l’import.
        </Notice>
      ) : null}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Total" value={dataImport.totalRows} />
        <Metric label="Valides" value={dataImport.validRows} />
        <Metric label="Invalides" value={dataImport.invalidRows} />
        <Metric label="Doublons" value={dataImport.duplicateRows} />
        <Metric label="Traitées" value={dataImport.processedRows} />
      </div>

      <div className="border-navy/10 mt-8 overflow-hidden rounded-2xl border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[64rem] text-left text-sm">
            <thead className="bg-navy text-white">
              <tr>
                <th className="px-4 py-3 font-semibold">Ligne</th>
                <th className="px-4 py-3 font-semibold">Prospect</th>
                <th className="px-4 py-3 font-semibold">Entreprise</th>
                <th className="px-4 py-3 font-semibold">Statut</th>
                <th className="px-4 py-3 font-semibold">Résultat</th>
                <th className="px-4 py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-navy/8 divide-y">
              {dataImport.rows.map((row) => {
                const errors = fieldErrors(row.errorMessages);
                return (
                  <tr key={row.id} className="align-top">
                    <td className="px-4 py-4 font-semibold">{row.rowNumber}</td>
                    <td className="px-4 py-4">
                      {raw(row.rawData, "first_name")}{" "}
                      {raw(row.rawData, "last_name")}
                    </td>
                    <td className="px-4 py-4">
                      {raw(row.rawData, "company_name") || "—"}
                    </td>
                    <td className="px-4 py-4">
                      <RowStatus status={row.status} />
                      {row.duplicateMatchLevel ? (
                        <span className="mt-1 block text-xs text-slate-500">
                          Correspondance{" "}
                          {row.duplicateMatchLevel === "STRONG"
                            ? "forte"
                            : "secondaire"}
                        </span>
                      ) : null}
                    </td>
                    <td className="max-w-md px-4 py-4">
                      {errors.length ? (
                        <ul className="space-y-1 text-xs text-red-800">
                          {errors.map((item, index) => (
                            <li key={`${item.field}-${index}`}>
                              <strong>{item.field}</strong> : {item.message}
                            </li>
                          ))}
                        </ul>
                      ) : row.createdOpportunityId ? (
                        <Link
                          href={`/admin/review/${row.createdOpportunityId}`}
                          className="text-navy font-semibold underline"
                        >
                          Ouvrir la fiche créée
                        </Link>
                      ) : (
                        <span className="text-slate-500">
                          Aucune anomalie détectée
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {row.status === "DUPLICATE" ? (
                        <DuplicateResolutionForm
                          importId={dataImport.id}
                          rowId={row.id}
                          canUpdate={Boolean(row.duplicateOfProspectId)}
                          current={row.duplicateResolution}
                        />
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
      </div>

      {totalPages > 1 ? (
        <nav
          aria-label="Pagination des lignes"
          className="mt-7 flex items-center justify-center gap-4"
        >
          {page > 1 ? (
            <Link
              href={`/admin/imports/${dataImport.id}?page=${page - 1}`}
              className={cn(buttonVariants({ variant: "secondary" }))}
            >
              Précédent
            </Link>
          ) : null}
          <span className="text-sm text-slate-500">
            Page {page} sur {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={`/admin/imports/${dataImport.id}?page=${page + 1}`}
              className={cn(buttonVariants({ variant: "secondary" }))}
            >
              Suivant
            </Link>
          ) : null}
        </nav>
      ) : null}
    </section>
  );
}

function DuplicateResolutionForm({
  canUpdate,
  current,
  importId,
  rowId,
}: {
  canUpdate: boolean;
  current: string | null;
  importId: string;
  rowId: string;
}) {
  return (
    <form action={resolveDuplicateAction} className="flex min-w-56 gap-2">
      <input type="hidden" name="importId" value={importId} />
      <input type="hidden" name="rowId" value={rowId} />
      <select
        name="resolution"
        required
        defaultValue={current ?? ""}
        aria-label="Résolution du doublon"
        className="border-navy/20 text-navy min-w-0 flex-1 rounded-lg border bg-white px-2 py-2 text-xs"
      >
        <option value="" disabled>
          Choisir…
        </option>
        <option value="SKIP">Ignorer la ligne</option>
        {canUpdate ? (
          <option value="UPDATE_EXISTING">Mettre à jour le prospect</option>
        ) : null}
        <option value="CREATE_DISTINCT">Créer un prospect distinct</option>
      </select>
      <Button
        type="submit"
        variant="secondary"
        aria-label="Enregistrer la résolution"
        className="px-3"
      >
        <RotateCcw aria-hidden="true" className="size-4" />
      </Button>
    </form>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-navy/10 rounded-2xl border bg-white p-5">
      <p className="text-navy font-serif text-3xl">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}

function RowStatus({ status }: { status: string }) {
  const positive = ["VALID", "IMPORTED"].includes(status);
  const negative = status === "INVALID";
  const Icon = positive ? CheckCircle2 : negative ? XCircle : AlertTriangle;
  return (
    <span className="text-navy inline-flex items-center gap-1.5 text-xs font-semibold">
      <Icon
        aria-hidden="true"
        className={cn(
          "size-3.5",
          positive
            ? "text-emerald-700"
            : negative
              ? "text-red-700"
              : "text-amber-700",
        )}
      />
      {status}
    </span>
  );
}

function Notice({
  children,
  kind,
}: {
  children: React.ReactNode;
  kind: "error" | "message" | "warning";
}) {
  const styles = {
    error: "border-red-200 bg-red-50 text-red-800",
    message: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
  };
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={cn("mt-5 rounded-xl border px-4 py-3 text-sm", styles[kind])}
    >
      {children}
    </p>
  );
}

function fieldErrors(value: unknown): ImportFieldError[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (
      typeof item === "object" &&
      item !== null &&
      "field" in item &&
      "message" in item &&
      typeof item.field === "string" &&
      typeof item.message === "string"
    ) {
      return [
        {
          field: item.field,
          message: item.message,
          originalValue:
            "originalValue" in item && typeof item.originalValue === "string"
              ? item.originalValue
              : "",
        },
      ];
    }
    return [];
  });
}

function raw(value: unknown, field: string) {
  if (
    typeof value === "object" &&
    value !== null &&
    field in value &&
    typeof (value as Record<string, unknown>)[field] === "string"
  ) {
    return (value as Record<string, string>)[field];
  }
  return "";
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function statusLabel(status: string) {
  return (
    {
      UPLOADED: "téléversé",
      VALIDATING: "en validation",
      READY: "prêt",
      IMPORTING: "en cours",
      COMPLETED: "terminé",
      FAILED: "en échec",
    }[status] ?? status
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(date);
}
