import { requireFirmContext } from "@/lib/permissions/firm-context";

export default async function SettingsPage() {
  const { firm } = await requireFirmContext();

  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-gold-dark text-xs font-semibold tracking-[0.2em] uppercase">
        Cabinet
      </p>
      <h1 className="text-navy mt-2 font-serif text-4xl">Paramètres</h1>
      <section className="border-navy/10 mt-10 max-w-2xl rounded-2xl border bg-white p-8">
        <p className="text-xs font-semibold tracking-[0.16em] text-slate-400 uppercase">
          Informations
        </p>
        <dl className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">Cabinet</dt>
            <dd className="text-navy mt-1 font-semibold">{firm.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Localisation</dt>
            <dd className="text-navy mt-1 font-semibold">
              {firm.city} · {firm.department}
            </dd>
          </div>
        </dl>
        <p className="border-navy/10 mt-8 border-t pt-6 text-sm text-slate-500">
          La modification des préférences sera disponible prochainement.
        </p>
      </section>
    </div>
  );
}
