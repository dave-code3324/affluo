import {
  ArrowLeft,
  CheckCircle2,
  Linkedin,
  Save,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  approveOpportunityAction,
  rejectOpportunityAction,
  requestChangesAction,
  saveReviewCorrectionsAction,
  takeOpportunityAction,
  verifyLinkedinAction,
} from "@/modules/admin/review/actions";
import {
  adminOpportunityIdSchema,
  REJECTION_REASONS,
  REVIEW_STATUS_LABELS,
} from "@/modules/admin/review/domain";
import { getAdminReviewDetail } from "@/modules/admin/review/service";

type ReviewDetailPageProps = {
  params: Promise<{ opportunityId: string }>;
  searchParams: Promise<{
    error?: string | string[];
    message?: string | string[];
  }>;
};

export default async function ReviewDetailPage({
  params,
  searchParams,
}: ReviewDetailPageProps) {
  const [route, query] = await Promise.all([params, searchParams]);
  const id = adminOpportunityIdSchema.safeParse(route.opportunityId);
  if (!id.success) {
    notFound();
  }
  const opportunity = await getAdminReviewDetail(id.data);
  if (!opportunity) {
    notFound();
  }

  const signal =
    opportunity.signals.find(({ isPrimary }) => isPrimary)?.signal ??
    opportunity.signals[0]?.signal;
  if (!signal) {
    notFound();
  }
  const email = opportunity.prospect.contactDetails.find(
    ({ type }) => type === "PROFESSIONAL_EMAIL",
  );
  const phone = opportunity.prospect.contactDetails.find(
    ({ type }) => type === "PROFESSIONAL_PHONE",
  );
  const linkedin = opportunity.prospect.contactDetails.find(
    ({ type }) => type === "LINKEDIN",
  );
  const error = first(query.error);
  const message = first(query.message);

  return (
    <section className="mx-auto max-w-6xl pb-12">
      <Link
        href="/admin/review"
        className="text-navy inline-flex items-center text-sm font-semibold hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="mr-2 size-4" />
        Retour à la file
      </Link>

      <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-gold-dark text-xs font-semibold tracking-[0.18em] uppercase">
            {REVIEW_STATUS_LABELS[opportunity.reviewStatus]}
          </p>
          <h1 className="text-navy mt-2 font-serif text-4xl">
            {opportunity.prospect.firstName} {opportunity.prospect.lastName}
          </h1>
          <p className="mt-2 text-slate-600">
            {opportunity.prospect.jobTitle} · {opportunity.prospect.companyName}
          </p>
        </div>
        {opportunity.reviewStatus === "TO_REVIEW" ||
        opportunity.reviewStatus === "NEEDS_CHANGES" ? (
          <form action={takeOpportunityAction}>
            <input type="hidden" name="opportunityId" value={opportunity.id} />
            <Button type="submit" variant="secondary">
              <ShieldCheck aria-hidden="true" className="mr-2 size-4" />
              Prendre en revue
            </Button>
          </form>
        ) : null}
      </div>

      {error ? <Notice kind="error">{error}</Notice> : null}
      {message ? <Notice kind="message">{message}</Notice> : null}

      <form action={saveReviewCorrectionsAction} className="mt-8 space-y-7">
        <input type="hidden" name="opportunityId" value={opportunity.id} />
        <input type="hidden" name="signalId" value={signal.id} />

        <Panel eyebrow="Faits professionnels" title="Identité et entreprise">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Prénom"
              name="firstName"
              defaultValue={opportunity.prospect.firstName}
              required
            />
            <Field
              label="Nom"
              name="lastName"
              defaultValue={opportunity.prospect.lastName}
              required
            />
            <Field
              label="Fonction"
              name="jobTitle"
              defaultValue={opportunity.prospect.jobTitle}
            />
            <Field
              label="Entreprise"
              name="companyName"
              defaultValue={opportunity.prospect.companyName}
            />
            <Field
              label="Site de l’entreprise"
              name="companyWebsite"
              type="url"
              defaultValue={opportunity.prospect.company?.website ?? ""}
            />
            <Field
              label="Ville"
              name="city"
              defaultValue={opportunity.prospect.city}
              required
            />
            <Field
              label="Département"
              name="department"
              defaultValue={opportunity.prospect.department}
              required
            />
          </div>
        </Panel>

        <Panel eyebrow="Fait sourcé" title="Signal principal">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Type"
              name="signalType"
              defaultValue={signal.type}
              required
            />
            <Field
              label="Titre"
              name="signalTitle"
              defaultValue={signal.title}
              required
            />
            <TextArea
              label="Description factuelle"
              name="signalDescription"
              defaultValue={signal.description}
              required
              className="sm:col-span-2"
            />
            <Field
              label="Date de l’événement"
              name="eventDate"
              type="date"
              defaultValue={dateInput(signal.eventDate)}
              required
            />
            <SelectField
              label="Statut du signal"
              name="signalVerificationStatus"
              defaultValue={signal.verificationStatus}
              options={[
                ["UNVERIFIED", "À vérifier"],
                ["VERIFIED", "Vérifié manuellement"],
                ["REJECTED", "Rejeté"],
              ]}
            />
            <Field
              label="Nom de la source"
              name="sourceName"
              defaultValue={signal.sourceName ?? ""}
              required
            />
            <Field
              label="URL de la source"
              name="sourceUrl"
              type="url"
              defaultValue={signal.sourceUrl ?? ""}
              required
            />
            <Field
              label="Date de publication"
              name="sourcePublishedAt"
              type="date"
              defaultValue={dateInput(signal.sourcePublishedAt)}
            />
          </div>
        </Panel>

        <Panel eyebrow="Contact professionnel" title="Coordonnées">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Email professionnel"
              name="professionalEmail"
              type="email"
              defaultValue={email?.value ?? ""}
            />
            <SelectField
              label="Vérification email"
              name="emailVerificationStatus"
              defaultValue={email?.verificationStatus ?? "UNVERIFIED"}
              options={verificationOptions}
            />
            <Field
              label="Téléphone professionnel"
              name="professionalPhone"
              type="tel"
              defaultValue={phone?.value ?? ""}
            />
            <SelectField
              label="Vérification téléphone"
              name="phoneVerificationStatus"
              defaultValue={phone?.verificationStatus ?? "UNVERIFIED"}
              options={verificationOptions}
            />
            <Field
              label="Profil LinkedIn"
              name="linkedinUrl"
              type="url"
              defaultValue={linkedin?.value ?? ""}
            />
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm">
              <p className="font-semibold text-blue-950">
                Statut LinkedIn : {linkedin?.verificationStatus ?? "UNVERIFIED"}
              </p>
              <p className="mt-1 text-xs leading-5 text-blue-800">
                Une URL modifiée repasse automatiquement à non vérifiée. La
                validation utilise l’action humaine dédiée ci-dessous.
              </p>
            </div>
          </div>
        </Panel>

        <Panel eyebrow="Évaluation interne" title="Qualification">
          <div className="grid gap-5 sm:grid-cols-2">
            <SelectField
              label="Confiance"
              name="confidenceLevel"
              defaultValue={opportunity.confidenceLevel}
              options={[
                ["LOW", "Faible"],
                ["MEDIUM", "Moyenne"],
                ["HIGH", "Élevée"],
              ]}
            />
            <SelectField
              label="Contactabilité"
              name="contactabilityStatus"
              defaultValue={opportunity.contactabilityStatus}
              options={[
                ["NOT_CONTACTABLE", "Non contactable"],
                ["PARTIALLY_VERIFIED", "Partiellement vérifiée"],
                ["CONTACTABLE", "Contactable"],
              ]}
            />
            <TextArea
              label="Résumé de qualification"
              name="qualificationSummary"
              defaultValue={opportunity.qualificationSummary ?? ""}
              className="sm:col-span-2"
            />
            <TextArea
              label="Pourquoi maintenant ? — interprétation Affluo"
              name="whyNow"
              defaultValue={opportunity.whyNow}
              required
              className="sm:col-span-2"
            />
            <TextArea
              label="Besoins potentiels séparés par |"
              name="potentialNeeds"
              defaultValue={opportunity.potentialNeeds.join("|")}
              className="sm:col-span-2"
            />
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 sm:col-span-2">
              <TextArea
                label="Notes internes — jamais visibles par le CGP"
                name="internalNotes"
                defaultValue={opportunity.internalNotes ?? ""}
              />
            </div>
          </div>
        </Panel>

        <div className="flex justify-end">
          <Button type="submit">
            <Save aria-hidden="true" className="mr-2 size-4" />
            Enregistrer les corrections
          </Button>
        </div>
      </form>

      <div className="border-navy/10 mt-9 rounded-3xl border bg-white p-6 sm:p-8">
        <h2 className="text-navy font-serif text-2xl">Actions de revue</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          La validation conserve le statut métier `DRAFT`. L’affectation et la
          publication restent hors de ce ticket.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          {linkedin && linkedin.verificationStatus !== "VERIFIED" ? (
            <form action={verifyLinkedinAction}>
              <input
                type="hidden"
                name="opportunityId"
                value={opportunity.id}
              />
              <input type="hidden" name="contactDetailId" value={linkedin.id} />
              <Button type="submit" variant="secondary">
                <Linkedin aria-hidden="true" className="mr-2 size-4" />
                Vérifier LinkedIn manuellement
              </Button>
            </form>
          ) : null}
          <form action={requestChangesAction}>
            <input type="hidden" name="opportunityId" value={opportunity.id} />
            <Button type="submit" variant="secondary">
              Demander des modifications
            </Button>
          </form>
          <form action={approveOpportunityAction}>
            <input type="hidden" name="opportunityId" value={opportunity.id} />
            <Button type="submit">
              <CheckCircle2 aria-hidden="true" className="mr-2 size-4" />
              Valider l’opportunité
            </Button>
          </form>
        </div>

        <form
          action={rejectOpportunityAction}
          className="mt-6 flex flex-col gap-3 border-t border-red-100 pt-6 sm:flex-row sm:items-end"
        >
          <input type="hidden" name="opportunityId" value={opportunity.id} />
          <label className="flex-1 text-sm font-semibold text-red-900">
            Raison du rejet
            <select
              name="rejectionReason"
              required
              defaultValue={opportunity.rejectionReason ?? ""}
              className="mt-2 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Sélectionner…
              </option>
              {REJECTION_REASONS.map(({ label, value }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="submit"
            className="bg-red-800 text-white hover:bg-red-700"
          >
            <XCircle aria-hidden="true" className="mr-2 size-4" />
            Rejeter
          </Button>
        </form>
      </div>
    </section>
  );
}

const verificationOptions = [
  ["UNVERIFIED", "Non vérifié"],
  ["LIKELY", "Probable"],
  ["VERIFIED", "Vérifié"],
  ["INVALID", "Invalide"],
] as const;

function Panel({
  children,
  eyebrow,
  title,
}: {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
}) {
  return (
    <section className="border-navy/10 rounded-3xl border bg-white p-6 sm:p-8">
      <p className="text-gold-dark text-xs font-semibold tracking-[0.16em] uppercase">
        {eyebrow}
      </p>
      <h2 className="text-navy mt-2 font-serif text-2xl">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Field({
  defaultValue,
  label,
  name,
  required,
  type = "text",
}: {
  defaultValue: string;
  label: string;
  name: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="text-navy text-sm font-semibold">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        className="border-navy/20 focus-visible:ring-gold mt-2 w-full rounded-lg border bg-white px-3 py-2.5 text-sm font-normal focus-visible:ring-2 focus-visible:outline-none"
      />
    </label>
  );
}

function TextArea({
  className,
  defaultValue,
  label,
  name,
  required,
}: {
  className?: string;
  defaultValue: string;
  label: string;
  name: string;
  required?: boolean;
}) {
  return (
    <label className={cn("text-navy text-sm font-semibold", className)}>
      {label}
      <textarea
        name={name}
        defaultValue={defaultValue}
        required={required}
        rows={4}
        className="border-navy/20 focus-visible:ring-gold mt-2 w-full rounded-lg border bg-white px-3 py-2.5 text-sm leading-6 font-normal focus-visible:ring-2 focus-visible:outline-none"
      />
    </label>
  );
}

function SelectField({
  defaultValue,
  label,
  name,
  options,
}: {
  defaultValue: string;
  label: string;
  name: string;
  options: ReadonlyArray<readonly [string, string]>;
}) {
  return (
    <label className="text-navy text-sm font-semibold">
      {label}
      <select
        name={name}
        defaultValue={defaultValue}
        className="border-navy/20 focus-visible:ring-gold mt-2 w-full rounded-lg border bg-white px-3 py-2.5 text-sm font-normal focus-visible:ring-2 focus-visible:outline-none"
      >
        {options.map(([value, optionLabel]) => (
          <option key={value} value={value}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function Notice({
  children,
  kind,
}: {
  children: React.ReactNode;
  kind: "error" | "message";
}) {
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={cn(
        "mt-5 rounded-xl border px-4 py-3 text-sm",
        kind === "error"
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-emerald-200 bg-emerald-50 text-emerald-800",
      )}
    >
      {children}
    </p>
  );
}

function dateInput(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "";
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
