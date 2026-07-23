"use client";

import { Check, ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  completeOnboardingAction,
  initialOnboardingState,
} from "@/modules/firms/actions";
import {
  DEPARTMENT_PATTERN,
  TARGET_PROFILES,
} from "@/modules/firms/onboarding";

const TOTAL_STEPS = 4;

export function OnboardingWizard() {
  const [step, setStep] = useState(1);
  const [firmName, setFirmName] = useState("");
  const [city, setCity] = useState("");
  const [department, setDepartment] = useState("");
  const [nationwide, setNationwide] = useState(false);
  const [departments, setDepartments] = useState("");
  const [targetProfiles, setTargetProfiles] = useState<string[]>([]);
  const [state, formAction, pending] = useActionState(
    completeOnboardingAction,
    initialOnboardingState,
  );

  const activeStep = state.success ? 4 : step;
  const canContinueStepOne =
    firmName.trim().length >= 2 &&
    city.trim().length >= 2 &&
    DEPARTMENT_PATTERN.test(department.trim().toUpperCase());
  const prospectingDepartmentValues = departments
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  const canContinueStepTwo =
    nationwide ||
    (prospectingDepartmentValues.length > 0 &&
      prospectingDepartmentValues.every((value) =>
        DEPARTMENT_PATTERN.test(value),
      ));

  function toggleProfile(profile: string) {
    setTargetProfiles((current) =>
      current.includes(profile)
        ? current.filter((value) => value !== profile)
        : [...current, profile],
    );
  }

  if (state.success) {
    return (
      <section className="mx-auto max-w-xl text-center">
        <div className="bg-gold/15 text-gold-dark mx-auto flex size-16 items-center justify-center rounded-full">
          <Check aria-hidden="true" className="size-7" />
        </div>
        <p className="text-gold-dark mt-8 text-xs font-semibold tracking-[0.22em] uppercase">
          Étape 4 sur 4
        </p>
        <h1 className="text-navy mt-3 font-serif text-4xl">Merci.</h1>
        <p className="mt-5 text-lg leading-relaxed text-slate-600">
          Nous préparons votre première sélection.
          <br />
          Vous recevrez un email dès qu’elle sera disponible.
        </p>
        <Link href="/dashboard" className={cn(buttonVariants(), "mt-10")}>
          Accéder à mon espace
          <ChevronRight aria-hidden="true" className="ml-2 size-4" />
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-2xl">
      <div className="mb-10 flex items-center justify-between">
        <div>
          <p className="text-gold-dark text-xs font-semibold tracking-[0.22em] uppercase">
            Configuration
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Étape {activeStep} sur {TOTAL_STEPS}
          </p>
        </div>
        <div className="flex gap-2" aria-label="Progression">
          {Array.from({ length: TOTAL_STEPS }, (_, index) => (
            <span
              key={index}
              className={`h-1.5 w-10 rounded-full ${
                index + 1 <= activeStep ? "bg-gold" : "bg-navy/10"
              }`}
            />
          ))}
        </div>
      </div>

      <form action={formAction}>
        <input type="hidden" name="firmName" value={firmName} />
        <input type="hidden" name="city" value={city} />
        <input
          type="hidden"
          name="department"
          value={department.trim().toUpperCase()}
        />
        <input type="hidden" name="nationwide" value={String(nationwide)} />
        <input type="hidden" name="departments" value={departments} />
        {targetProfiles.map((profile) => (
          <input
            key={profile}
            type="hidden"
            name="targetProfiles"
            value={profile}
          />
        ))}

        <div className="border-navy/10 rounded-2xl border bg-white p-6 shadow-[0_24px_80px_rgba(7,24,46,0.08)] sm:p-10">
          {step === 1 && (
            <fieldset>
              <legend className="text-navy font-serif text-3xl">
                Votre cabinet
              </legend>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Les informations essentielles pour personnaliser votre espace.
              </p>
              <div className="mt-8 space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="firm-name">Nom du cabinet</Label>
                  <Input
                    id="firm-name"
                    value={firmName}
                    onChange={(event) => setFirmName(event.target.value)}
                    autoFocus
                    required
                  />
                </div>
                <div className="grid gap-5 sm:grid-cols-[1fr_8rem]">
                  <div className="space-y-2">
                    <Label htmlFor="city">Ville</Label>
                    <Input
                      id="city"
                      value={city}
                      onChange={(event) => setCity(event.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="department">Département</Label>
                    <Input
                      id="department"
                      value={department}
                      onChange={(event) => setDepartment(event.target.value)}
                      placeholder="75"
                      maxLength={3}
                      required
                    />
                  </div>
                </div>
              </div>
            </fieldset>
          )}

          {step === 2 && (
            <fieldset>
              <legend className="text-navy font-serif text-3xl">
                Zone de prospection
              </legend>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Où souhaitez-vous recevoir des opportunités ?
              </p>
              <div className="mt-8 space-y-4">
                <label className="border-navy/10 hover:border-gold flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition">
                  <input
                    type="checkbox"
                    checked={nationwide}
                    onChange={(event) => setNationwide(event.target.checked)}
                    className="accent-navy mt-0.5 size-5"
                  />
                  <span>
                    <span className="text-navy block font-semibold">
                      France entière
                    </span>
                    <span className="mt-1 block text-sm text-slate-500">
                      Ne pas limiter la sélection géographiquement.
                    </span>
                  </span>
                </label>

                <div className="space-y-2">
                  <Label htmlFor="prospecting-departments">
                    Département(s)
                  </Label>
                  <Input
                    id="prospecting-departments"
                    value={departments}
                    onChange={(event) => setDepartments(event.target.value)}
                    placeholder="75, 92, 93"
                    disabled={nationwide}
                  />
                  <p className="text-xs text-slate-500">
                    Séparez plusieurs codes par une virgule.
                  </p>
                </div>
              </div>
            </fieldset>
          )}

          {step === 3 && (
            <fieldset>
              <legend className="text-navy font-serif text-3xl">
                Profils recherchés
              </legend>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Sélectionnez les profils les plus pertinents pour votre cabinet.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {TARGET_PROFILES.map((profile) => {
                  const selected = targetProfiles.includes(profile.value);

                  return (
                    <button
                      key={profile.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleProfile(profile.value)}
                      className={`flex items-center justify-between rounded-xl border p-4 text-left text-sm font-semibold transition ${
                        selected
                          ? "border-gold bg-gold/10 text-navy"
                          : "border-navy/10 hover:border-gold/60 bg-white text-slate-700"
                      }`}
                    >
                      {profile.label}
                      <span
                        className={`flex size-5 items-center justify-center rounded-full ${
                          selected
                            ? "bg-gold text-navy"
                            : "border-navy/20 border"
                        }`}
                      >
                        {selected && (
                          <Check aria-hidden="true" className="size-3" />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          {state.error && (
            <p
              role="alert"
              className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              {state.error}
            </p>
          )}

          <div className="border-navy/10 mt-10 flex items-center justify-between border-t pt-6">
            {step > 1 ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep((current) => current - 1)}
              >
                <ChevronLeft aria-hidden="true" className="mr-2 size-4" />
                Retour
              </Button>
            ) : (
              <span />
            )}

            {step < 3 ? (
              <Button
                type="button"
                disabled={
                  step === 1 ? !canContinueStepOne : !canContinueStepTwo
                }
                onClick={() => setStep((current) => current + 1)}
              >
                Continuer
                <ChevronRight aria-hidden="true" className="ml-2 size-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={targetProfiles.length === 0 || pending}
              >
                {pending ? (
                  <>
                    <LoaderCircle
                      aria-hidden="true"
                      className="mr-2 size-4 animate-spin"
                    />
                    Enregistrement…
                  </>
                ) : (
                  "Valider mon ciblage"
                )}
              </Button>
            )}
          </div>
        </div>
      </form>

      <p className="mt-6 text-center text-xs text-slate-500">
        Vous pourrez modifier ces préférences plus tard.
      </p>
    </section>
  );
}
