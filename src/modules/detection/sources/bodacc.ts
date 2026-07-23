import { z } from "zod";

import { detectionConfig } from "@/modules/detection/config";
import type {
  CollectedDocument,
  CollectionContext,
  ProspectSource,
} from "@/modules/detection/types";

const bodaccRecordSchema = z
  .object({
    id: z.string().min(1),
    dateparution: z.iso.date(),
    familleavis: z.string(),
    familleavis_lib: z.string().optional(),
    commercant: z.string().nullable().optional(),
    ville: z.string().nullable().optional(),
    numerodepartement: z.string().nullable().optional(),
    url_complete: z.url(),
  })
  .loose();

const bodaccResponseSchema = z.object({
  results: z.array(bodaccRecordSchema),
});

function allowedBodaccUrl(value: string) {
  const hostname = new URL(value).hostname.toLowerCase();
  return hostname === "bodacc.fr" || hostname.endsWith(".bodacc.fr");
}

export class BodaccSource implements ProspectSource {
  readonly key = "BODACC";
  readonly label = "BODACC — ventes et cessions";

  async collect(context: CollectionContext): Promise<CollectedDocument[]> {
    const url = new URL(detectionConfig.bodacc.apiBaseUrl);
    const since = context.since.toISOString().slice(0, 10);
    url.searchParams.set(
      "where",
      `familleavis="vente" AND dateparution >= date'${since}'`,
    );
    url.searchParams.set("order_by", "dateparution desc");
    url.searchParams.set("limit", String(context.limit));

    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "Affluo-Detection/0.1 (+https://affluo.fr)",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new Error(`BODACC_HTTP_${response.status}`);
    }

    const parsed = bodaccResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new Error("BODACC_RESPONSE_INVALID");
    }

    return parsed.data.results.flatMap((record) => {
      if (!allowedBodaccUrl(record.url_complete)) {
        return [];
      }
      return [
        {
          sourceKey: this.key,
          externalId: record.id,
          title: `Vente ou cession — ${record.commercant || record.id}`,
          content: JSON.stringify(record),
          sourceUrl: record.url_complete,
          publishedAt: new Date(`${record.dateparution}T00:00:00.000Z`),
          collectedAt: new Date(),
          metadata: {
            family: record.familleavis,
            familyLabel: record.familleavis_lib ?? null,
            department: record.numerodepartement ?? null,
            city: record.ville ?? null,
          },
        },
      ];
    });
  }
}
