import { CheckCircle2, CircleDashed, ShieldQuestion } from "lucide-react";

import { cn } from "@/lib/utils";
import type { OpportunityCardDto } from "@/modules/opportunities/dto";

type ContactabilityBadgeProps = {
  contactability: OpportunityCardDto["contactability"];
  showDescription?: boolean;
};

const styles = {
  positive: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  neutral: "border-slate-200 bg-slate-50 text-slate-600",
};

const icons = {
  positive: CheckCircle2,
  warning: ShieldQuestion,
  neutral: CircleDashed,
};

export function ContactabilityBadge({
  contactability,
  showDescription = false,
}: ContactabilityBadgeProps) {
  const Icon = icons[contactability.tone];

  return (
    <div>
      <span
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold",
          styles[contactability.tone],
        )}
      >
        <Icon aria-hidden="true" className="size-3.5" />
        {contactability.label}
      </span>
      {showDescription && (
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          {contactability.description}
        </p>
      )}
    </div>
  );
}
