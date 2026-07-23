"use client";

import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

type OpportunitiesErrorProps = {
  reset: () => void;
};

export default function OpportunitiesError({ reset }: OpportunitiesErrorProps) {
  return (
    <div className="mx-auto max-w-3xl rounded-3xl border border-red-200 bg-white px-6 py-14 text-center shadow-sm">
      <AlertTriangle
        aria-hidden="true"
        className="mx-auto size-8 text-red-700"
      />
      <h1 className="text-navy mt-5 font-serif text-3xl">
        Impossible de charger votre sélection
      </h1>
      <p className="mx-auto mt-3 max-w-lg leading-7 text-slate-600">
        Un incident temporaire empêche l’affichage des opportunités. Vous pouvez
        réessayer sans perdre votre session.
      </p>
      <Button className="mt-7" onClick={reset}>
        Réessayer
      </Button>
    </div>
  );
}
