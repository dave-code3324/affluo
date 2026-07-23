"use client";

import {
  Ban,
  CheckCircle2,
  Eye,
  LoaderCircle,
  MessageSquare,
} from "lucide-react";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  type DecisionActionState,
  saveOpportunityDecisionAction,
} from "@/modules/opportunities/actions";
import {
  FEEDBACK_DECISIONS,
  FEEDBACK_REASONS,
} from "@/modules/opportunities/domain";

type DecisionControlsProps = {
  initialDecision: DecisionActionState["decision"];
  initialReason: DecisionActionState["reason"];
  opportunityId: string;
};

const icons = {
  TO_CONTACT: CheckCircle2,
  TO_MONITOR: Eye,
  NOT_RELEVANT: Ban,
} as const;

export function DecisionControls({
  initialDecision,
  initialReason,
  opportunityId,
}: DecisionControlsProps) {
  const [selected, setSelected] = useState(initialDecision);
  const [state, formAction, pending] = useActionState(
    saveOpportunityDecisionAction,
    {
      decision: initialDecision,
      message: null,
      reason: initialReason,
      status: "idle",
    },
  );
  const currentDecision = pending
    ? selected
    : state.status === "success"
      ? state.decision
      : state.status === "error"
        ? state.decision
        : selected;

  return (
    <section
      aria-labelledby="commercial-decision"
      className="border-gold/30 bg-navy rounded-3xl border p-6 text-white shadow-[0_20px_70px_rgba(7,24,46,0.12)] sm:p-8"
    >
      <div className="flex items-start gap-3">
        <MessageSquare
          aria-hidden="true"
          className="text-gold-light mt-1 size-5 shrink-0"
        />
        <div>
          <p className="text-gold-light text-xs font-semibold tracking-[0.18em] uppercase">
            Prochaine action
          </p>
          <h2 id="commercial-decision" className="mt-2 font-serif text-2xl">
            Que souhaitez-vous faire ?
          </h2>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {FEEDBACK_DECISIONS.filter(({ value }) => value !== "NOT_RELEVANT").map(
          ({ description, label, value }) => {
            const Icon = icons[value];
            const active = currentDecision === value;
            return (
              <form key={value} action={formAction}>
                <input
                  type="hidden"
                  name="opportunityId"
                  value={opportunityId}
                />
                <button
                  type="submit"
                  name="decision"
                  value={value}
                  aria-pressed={active}
                  disabled={pending}
                  onClick={() => setSelected(value)}
                  className={cn(
                    "focus-visible:ring-gold-light h-full w-full rounded-xl border p-4 text-left transition focus-visible:ring-2 focus-visible:outline-none disabled:cursor-wait disabled:opacity-60",
                    active
                      ? "border-gold bg-gold/15"
                      : "border-white/15 bg-white/5 hover:border-white/30",
                  )}
                >
                  <span className="flex items-center gap-2 font-semibold">
                    <Icon
                      aria-hidden="true"
                      className="text-gold-light size-4"
                    />
                    {label}
                  </span>
                  <span className="mt-2 block text-xs leading-5 text-white/60">
                    {description}
                  </span>
                </button>
              </form>
            );
          },
        )}

        <form
          action={formAction}
          className="rounded-xl border border-white/15 bg-white/5 p-4"
        >
          <input type="hidden" name="opportunityId" value={opportunityId} />
          <label
            htmlFor="feedback-reason"
            className="flex items-center gap-2 font-semibold"
          >
            <Ban aria-hidden="true" className="text-gold-light size-4" />
            Pas pertinent
          </label>
          <select
            id="feedback-reason"
            name="reason"
            defaultValue={initialReason ?? ""}
            disabled={pending}
            className="bg-navy focus-visible:ring-gold-light mt-3 w-full rounded-lg border border-white/15 px-3 py-2 text-xs text-white focus-visible:ring-2 focus-visible:outline-none"
          >
            <option value="">Sans raison particulière</option>
            {FEEDBACK_REASONS.map(({ label, value }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <Button
            type="submit"
            name="decision"
            value="NOT_RELEVANT"
            variant="secondary"
            disabled={pending}
            aria-pressed={currentDecision === "NOT_RELEVANT"}
            onClick={() => setSelected("NOT_RELEVANT")}
            className="mt-3 w-full"
          >
            Confirmer
          </Button>
        </form>
      </div>

      <p
        aria-live="polite"
        className={cn(
          "mt-5 flex min-h-5 items-center gap-2 text-sm",
          state.status === "error" ? "text-red-200" : "text-white/70",
        )}
      >
        {pending ? (
          <>
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            Enregistrement…
          </>
        ) : (
          state.message
        )}
      </p>
    </section>
  );
}
