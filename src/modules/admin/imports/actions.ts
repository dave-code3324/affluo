"use server";

import { DuplicateResolution, ImportStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdmin } from "@/lib/permissions/admin";
import {
  cancelImport,
  createImportPreview,
  ImportValidationError,
  resolveImportDuplicate,
  runImport,
  validateCsvUpload,
} from "@/modules/admin/imports/service";

const duplicateResolutionSchema = z.object({
  importId: z.uuid(),
  rowId: z.uuid(),
  resolution: z.enum([
    DuplicateResolution.SKIP,
    DuplicateResolution.UPDATE_EXISTING,
    DuplicateResolution.CREATE_DISTINCT,
  ]),
});

function detailUrl(
  importId: string,
  kind: "error" | "message",
  message: string,
) {
  return `/admin/imports/${importId}?${new URLSearchParams({ [kind]: message })}`;
}

export async function previewImportAction(formData: FormData) {
  const admin = await requireAdmin();
  const entry = formData.get("file");
  if (!(entry instanceof File)) {
    redirect(
      `/admin/imports?${new URLSearchParams({ error: "Sélectionnez un fichier CSV." })}`,
    );
  }

  let dataImport;
  try {
    const filename = validateCsvUpload(entry);
    const bytes = await entry.arrayBuffer();
    const content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    dataImport = await createImportPreview({
      actorUserId: admin.userId,
      content,
      filename,
    });
  } catch (error) {
    const message =
      error instanceof ImportValidationError
        ? error.message
        : "Le fichier est invalide ou n’utilise pas l’encodage UTF-8.";
    redirect(`/admin/imports?${new URLSearchParams({ error: message })}`);
  }

  redirect(`/admin/imports/${dataImport.id}`);
}

export async function resolveDuplicateAction(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = duplicateResolutionSchema.safeParse({
    importId: formData.get("importId"),
    rowId: formData.get("rowId"),
    resolution: formData.get("resolution"),
  });
  if (!parsed.success) {
    redirect("/admin/imports");
  }

  const result = await resolveImportDuplicate({
    actorUserId: admin.userId,
    ...parsed.data,
  });
  revalidatePath(`/admin/imports/${parsed.data.importId}`);
  redirect(
    detailUrl(
      parsed.data.importId,
      result ? "message" : "error",
      result
        ? "Résolution enregistrée."
        : "Cette résolution n’est pas applicable.",
    ),
  );
}

export async function runImportAction(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = z.uuid().safeParse(formData.get("importId"));
  if (!parsed.success) {
    redirect("/admin/imports");
  }

  let result;
  try {
    result = await runImport(admin.userId, parsed.data);
  } catch (error) {
    const message =
      error instanceof ImportValidationError
        ? error.message
        : "L’import n’a pas pu être lancé.";
    redirect(detailUrl(parsed.data, "error", message));
  }
  revalidatePath("/admin");
  revalidatePath("/admin/imports");
  revalidatePath("/admin/review");
  redirect(
    detailUrl(
      parsed.data,
      result.status === ImportStatus.COMPLETED ? "message" : "error",
      result.status === ImportStatus.COMPLETED
        ? "Import terminé."
        : "Certaines lignes ont échoué. Corrigez la cause puis relancez l’import.",
    ),
  );
}

export async function cancelImportAction(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = z.uuid().safeParse(formData.get("importId"));
  if (!parsed.success) {
    redirect("/admin/imports");
  }
  const cancelled = await cancelImport(admin.userId, parsed.data);
  revalidatePath("/admin/imports");
  redirect(
    detailUrl(
      parsed.data,
      cancelled ? "message" : "error",
      cancelled
        ? "Import annulé avant écriture."
        : "Cet import ne peut plus être annulé.",
    ),
  );
}
