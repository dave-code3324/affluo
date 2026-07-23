"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

type CopyContactButtonProps = {
  label: string;
  value: string;
};

export function CopyContactButton({ label, value }: CopyContactButtonProps) {
  const [copied, setCopied] = useState(false);

  async function copyValue() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={copyValue}
        aria-describedby="copy-status"
      >
        {copied ? (
          <Check aria-hidden="true" className="mr-2 size-4" />
        ) : (
          <Copy aria-hidden="true" className="mr-2 size-4" />
        )}
        {copied ? "Email copié" : label}
      </Button>
      <span id="copy-status" aria-live="polite" className="sr-only">
        {copied ? "L’adresse email a été copiée dans le presse-papiers." : ""}
      </span>
    </>
  );
}
