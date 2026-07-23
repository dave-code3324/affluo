import * as React from "react";

import { cn } from "@/lib/utils";

export function Input({
  className,
  type,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "border-navy/15 text-navy focus:border-gold focus:ring-gold/20 flex h-12 w-full rounded-lg border bg-white px-3.5 py-2 text-base shadow-sm transition outline-none placeholder:text-slate-400 focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70",
        className,
      )}
      {...props}
    />
  );
}
