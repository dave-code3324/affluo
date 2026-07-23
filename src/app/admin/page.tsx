import {
  ArrowRight,
  FileCheck2,
  FileWarning,
  Radar,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";
import { cn } from "@/lib/utils";

export default async function AdminDashboardPage() {
  const [readyImports, failedImports, reviewCount, detectionCount] =
    await Promise.all([
      prisma.dataImport.count({ where: { status: "READY" } }),
      prisma.dataImport.count({ where: { status: "FAILED" } }),
      prisma.opportunity.count({
        where: {
          status: "DRAFT",
          reviewStatus: { in: ["TO_REVIEW", "IN_REVIEW", "NEEDS_CHANGES"] },
        },
      }),
      prisma.opportunity.count({
        where: {
          origin: "AUTOMATED_DETECTION",
          status: "DRAFT",
        },
      }),
    ]);

  return (
    <section className="mx-auto max-w-6xl">
      <p className="text-gold-dark text-xs font-semibold tracking-[0.2em] uppercase">
        Opérations internes
      </p>
      <h1 className="text-navy mt-2 font-serif text-4xl sm:text-5xl">
        Administration
      </h1>
      <p className="mt-3 max-w-2xl leading-7 text-slate-600">
        Importez des données, contrôlez les anomalies puis qualifiez chaque
        opportunité avant toute livraison.
      </p>

      <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={FileCheck2}
          label="Imports prêts"
          value={readyImports}
          tone="positive"
        />
        <Metric
          icon={FileWarning}
          label="Imports en échec"
          value={failedImports}
          tone="warning"
        />
        <Metric
          icon={Radar}
          label="Détections en brouillon"
          value={detectionCount}
          tone="neutral"
        />
        <Metric
          icon={ShieldCheck}
          label="Fiches à qualifier"
          value={reviewCount}
          tone="neutral"
        />
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        <article className="border-navy/10 rounded-3xl border bg-white p-7 shadow-sm">
          <h2 className="text-navy font-serif text-2xl">
            Alimenter le produit
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Prévisualisez un CSV, corrigez ses erreurs et résolvez chaque
            doublon avant l’écriture définitive.
          </p>
          <Link href="/admin/imports" className={cn(buttonVariants(), "mt-6")}>
            Gérer les imports
            <ArrowRight aria-hidden="true" className="ml-2 size-4" />
          </Link>
        </article>
        <article className="border-navy/10 rounded-3xl border bg-white p-7 shadow-sm">
          <h2 className="text-navy font-serif text-2xl">
            Surveiller les sources
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Lancez les sources activées, suivez les documents et examinez les
            motifs d’exclusion sans publier automatiquement.
          </p>
          <Link
            href="/admin/detection"
            className={cn(buttonVariants({ variant: "secondary" }), "mt-6")}
          >
            Ouvrir la détection
            <ArrowRight aria-hidden="true" className="ml-2 size-4" />
          </Link>
        </article>
        <article className="border-navy/10 rounded-3xl border bg-white p-7 shadow-sm">
          <h2 className="text-navy font-serif text-2xl">
            Vérifier avant livraison
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Contrôlez les faits, les sources et les coordonnées. Une validation
            ne publie jamais automatiquement la fiche.
          </p>
          <Link
            href="/admin/review"
            className={cn(buttonVariants({ variant: "secondary" }), "mt-6")}
          >
            Ouvrir la file
            <ArrowRight aria-hidden="true" className="ml-2 size-4" />
          </Link>
        </article>
      </div>
    </section>
  );
}

function Metric({
  icon: Icon,
  label,
  tone,
  value,
}: {
  icon: typeof FileCheck2;
  label: string;
  tone: "positive" | "warning" | "neutral";
  value: number;
}) {
  const tones = {
    positive: "bg-emerald-50 text-emerald-800",
    warning: "bg-amber-50 text-amber-900",
    neutral: "bg-blue-50 text-blue-900",
  };
  return (
    <div className="border-navy/10 rounded-2xl border bg-white p-6">
      <div className={`inline-flex rounded-xl p-2.5 ${tones[tone]}`}>
        <Icon aria-hidden="true" className="size-5" />
      </div>
      <p className="text-navy mt-5 font-serif text-4xl">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </div>
  );
}
