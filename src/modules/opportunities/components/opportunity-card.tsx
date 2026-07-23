import { Building2, ChevronRight, MapPin } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ContactabilityBadge } from "@/modules/opportunities/components/contactability-badge";
import type { OpportunityCardDto } from "@/modules/opportunities/dto";

type OpportunityCardProps = {
  opportunity: OpportunityCardDto;
};

export function OpportunityCard({ opportunity }: OpportunityCardProps) {
  return (
    <article className="border-navy/10 hover:border-gold/50 flex h-full flex-col rounded-2xl border bg-white p-6 shadow-[0_16px_60px_rgba(7,24,46,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_70px_rgba(7,24,46,0.09)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-navy font-serif text-2xl">
            {opportunity.firstName} {opportunity.lastName}
          </h2>
          <p className="mt-2 text-sm font-semibold text-slate-700">
            {opportunity.jobTitle}
          </p>
        </div>
        <ContactabilityBadge contactability={opportunity.contactability} />
      </div>

      <div className="border-navy/8 mt-5 flex flex-wrap gap-x-5 gap-y-2 border-y py-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-2">
          <Building2 aria-hidden="true" className="text-gold-dark size-3.5" />
          {opportunity.companyName}
        </span>
        <span className="inline-flex items-center gap-2">
          <MapPin aria-hidden="true" className="text-gold-dark size-3.5" />
          {opportunity.location}
        </span>
      </div>

      <div className="mt-6 flex-1">
        <p className="text-gold-dark text-xs font-semibold tracking-[0.16em] uppercase">
          Signal détecté
        </p>
        <p className="text-navy mt-2 leading-relaxed font-semibold">
          {opportunity.signalSummary}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          {opportunity.whyNow}
        </p>
      </div>

      <Link
        href={`/dashboard/opportunities/${opportunity.id}`}
        className={cn(buttonVariants({ variant: "secondary" }), "mt-7 w-full")}
      >
        Voir le prospect
        <ChevronRight aria-hidden="true" className="ml-2 size-4" />
      </Link>
    </article>
  );
}
