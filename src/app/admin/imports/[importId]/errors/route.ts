import { notFound } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/permissions/admin";
import { csvCell } from "@/modules/admin/imports/service";

type ErrorExportRouteProps = {
  params: Promise<{ importId: string }>;
};

export async function GET(
  _request: Request,
  { params }: ErrorExportRouteProps,
) {
  await requireAdmin();
  const route = await params;
  const id = z.uuid().safeParse(route.importId);
  if (!id.success) {
    notFound();
  }
  const dataImport = await prisma.dataImport.findUnique({
    where: { id: id.data },
    select: {
      id: true,
      rows: {
        where: { status: "INVALID" },
        orderBy: { rowNumber: "asc" },
        select: {
          rowNumber: true,
          errorMessages: true,
        },
      },
    },
  });
  if (!dataImport) {
    notFound();
  }

  const lines = [
    ["row_number", "field", "error", "original_value"].map(csvCell).join(","),
  ];
  for (const row of dataImport.rows) {
    for (const error of errors(row.errorMessages)) {
      lines.push(
        [String(row.rowNumber), error.field, error.message, error.originalValue]
          .map(csvCell)
          .join(","),
      );
    }
  }

  return new Response(`\uFEFF${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Disposition": `attachment; filename="affluo-import-errors-${dataImport.id}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function errors(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (
      typeof item === "object" &&
      item !== null &&
      "field" in item &&
      "message" in item &&
      typeof item.field === "string" &&
      typeof item.message === "string"
    ) {
      return [
        {
          field: item.field,
          message: item.message,
          originalValue:
            "originalValue" in item && typeof item.originalValue === "string"
              ? item.originalValue
              : "",
        },
      ];
    }
    return [];
  });
}
