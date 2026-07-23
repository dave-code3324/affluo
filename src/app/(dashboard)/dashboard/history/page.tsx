import { requireFirmContext } from "@/lib/permissions/firm-context";

export default async function HistoryPage() {
  await requireFirmContext();

  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-gold-dark text-xs font-semibold tracking-[0.2em] uppercase">
        Suivi
      </p>
      <h1 className="text-navy mt-2 font-serif text-4xl">Historique</h1>
      <div className="border-navy/20 mt-10 rounded-2xl border border-dashed bg-white/60 p-12 text-center text-sm text-slate-500">
        Vos sélections passées apparaîtront ici.
      </div>
    </div>
  );
}
