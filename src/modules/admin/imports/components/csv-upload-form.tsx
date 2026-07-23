"use client";

import { FileSpreadsheet, LoaderCircle, Upload } from "lucide-react";
import { useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { previewImportAction } from "@/modules/admin/imports/actions";

export function CsvUploadForm() {
  const [file, setFile] = useState<File | null>(null);

  return (
    <form
      action={previewImportAction}
      className="border-navy/10 rounded-3xl border bg-white p-6 shadow-sm sm:p-8"
    >
      <div className="flex items-start gap-4">
        <div className="bg-gold/15 text-gold-dark rounded-xl p-3">
          <FileSpreadsheet aria-hidden="true" className="size-6" />
        </div>
        <div>
          <h2 className="text-navy font-serif text-2xl">
            Prévisualiser un fichier
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            CSV UTF-8 uniquement, 5 Mo et 1 000 lignes maximum. Aucune donnée
            métier n’est créée avant votre confirmation.
          </p>
        </div>
      </div>

      <label
        htmlFor="csv-file"
        className="border-navy/20 hover:border-gold mt-6 flex cursor-pointer flex-col items-center rounded-2xl border border-dashed px-6 py-9 text-center transition"
      >
        <Upload aria-hidden="true" className="text-gold-dark size-6" />
        <span className="text-navy mt-3 text-sm font-semibold">
          Choisir un fichier CSV
        </span>
        <span className="mt-1 text-xs text-slate-500">
          Virgule et point-virgule acceptés
        </span>
      </label>
      <input
        id="csv-file"
        name="file"
        type="file"
        accept=".csv,text/csv"
        required
        className="sr-only"
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
      />

      {file ? (
        <div
          aria-live="polite"
          className="bg-ivory/70 mt-4 flex items-center justify-between gap-4 rounded-xl px-4 py-3 text-sm"
        >
          <span className="text-navy truncate font-semibold">{file.name}</span>
          <span className="shrink-0 text-slate-500">
            {(file.size / 1024).toLocaleString("fr-FR", {
              maximumFractionDigits: 1,
            })}{" "}
            Ko
          </span>
        </div>
      ) : null}

      <SubmitUpload disabled={!file} />
    </form>
  );
}

function SubmitUpload({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      className="mt-5 w-full"
      disabled={disabled || pending}
    >
      {pending ? (
        <LoaderCircle aria-hidden="true" className="mr-2 size-4 animate-spin" />
      ) : (
        <Upload aria-hidden="true" className="mr-2 size-4" />
      )}
      {pending ? "Validation en cours…" : "Créer la prévisualisation"}
    </Button>
  );
}
