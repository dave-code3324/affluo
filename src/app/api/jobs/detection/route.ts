import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

import { runScheduledDetection } from "@/modules/detection/pipeline/service";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: Request, secret: string) {
  const provided = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  if (!provided) {
    return false;
  }
  const expectedBytes = Buffer.from(secret);
  const providedBytes = Buffer.from(provided);
  return (
    expectedBytes.length === providedBytes.length &&
    timingSafeEqual(expectedBytes, providedBytes)
  );
}

export async function GET(request: Request) {
  const secret =
    process.env.CRON_SECRET ?? process.env.DETECTION_CRON_SECRET ?? "";
  if (!secret || !authorized(request, secret)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const runs = await runScheduledDetection();
    return NextResponse.json({
      executedRuns: runs.length,
      statuses: runs.map(({ id, sourceKey, status }) => ({
        id,
        sourceKey,
        status,
      })),
    });
  } catch {
    return NextResponse.json(
      { error: "Detection job failed" },
      { status: 500 },
    );
  }
}
