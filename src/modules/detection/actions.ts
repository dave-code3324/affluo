"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/permissions/admin";
import { writeAuditLog } from "@/modules/admin/audit";
import {
  DetectionConfigurationError,
  DetectionRunConflictError,
  retryDetectionRun,
  startDetectionRun,
} from "@/modules/detection/pipeline/service";

const sourceKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[A-Z0-9_]+$/);

function detectionUrl(kind: "error" | "message", message: string) {
  return `/admin/detection?${new URLSearchParams({ [kind]: message })}`;
}

function publicError(error: unknown) {
  if (
    error instanceof DetectionConfigurationError ||
    error instanceof DetectionRunConflictError
  ) {
    return error.message;
  }
  return "L’exécution n’a pas pu être lancée.";
}

export async function startDetectionAction(formData: FormData) {
  const admin = await requireAdmin();
  const sourceKey = sourceKeySchema.safeParse(formData.get("sourceKey"));
  if (!sourceKey.success) {
    redirect(detectionUrl("error", "Source invalide."));
  }
  try {
    const run = await startDetectionRun(sourceKey.data, admin.userId);
    await writeAuditLog(prisma, {
      action: "DETECTION_RUN_EXECUTED",
      actorUserId: admin.userId,
      entityId: run.id,
      entityType: "detection_run",
      newData: { sourceKey: run.sourceKey, status: run.status },
    });
    revalidatePath("/admin/detection");
    revalidatePath("/admin/review");
    redirect(`/admin/detection/runs/${run.id}`);
  } catch (error) {
    redirect(detectionUrl("error", publicError(error)));
  }
}

export async function retryDetectionAction(formData: FormData) {
  const admin = await requireAdmin();
  const runId = z.uuid().safeParse(formData.get("runId"));
  if (!runId.success) {
    redirect(detectionUrl("error", "Exécution invalide."));
  }
  try {
    const run = await retryDetectionRun(runId.data, admin.userId);
    await writeAuditLog(prisma, {
      action: "DETECTION_RUN_RETRIED",
      actorUserId: admin.userId,
      entityId: run.id,
      entityType: "detection_run",
      newData: { sourceKey: run.sourceKey, status: run.status },
    });
    revalidatePath("/admin/detection");
    revalidatePath("/admin/review");
    redirect(`/admin/detection/runs/${run.id}`);
  } catch (error) {
    redirect(detectionUrl("error", publicError(error)));
  }
}
