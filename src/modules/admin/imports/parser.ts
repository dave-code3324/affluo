import { ConfidenceLevel, VerificationStatus } from "@prisma/client";
import { parse } from "csv-parse/sync";
import { z } from "zod";

import { REQUIRED_CSV_COLUMNS } from "@/modules/admin/imports/config";
import {
  normalizeDate,
  normalizeDepartment,
  normalizeEmail,
  normalizeEnum,
  normalizeExternalUrl,
  normalizeLinkedinUrl,
  normalizePhone,
  normalizePotentialNeeds,
  normalizeWhitespace,
  titleCase,
} from "@/modules/admin/imports/normalization";
import type {
  ImportFieldError,
  NormalizedImportRow,
  ParsedCsv,
  RawCsvRow,
} from "@/modules/admin/imports/types";
import { externalUrlSchema } from "@/modules/opportunities/domain";

const departmentSchema = z
  .string()
  .regex(/^(0[1-9]|[1-8][0-9]|9[0-5]|2A|2B|97[1-6])$/);

const dateSchema = z.iso.date();

const verificationSchema = z.enum([
  VerificationStatus.UNVERIFIED,
  VerificationStatus.LIKELY,
  VerificationStatus.VERIFIED,
  VerificationStatus.INVALID,
]);

export const normalizedRowSchema = z
  .object({
    firstName: z.string().min(1, "Prénom requis").max(120),
    lastName: z.string().min(1, "Nom requis").max(120),
    jobTitle: z.string().max(160),
    companyName: z.string().max(180),
    companyWebsite: externalUrlSchema.nullable(),
    city: z.string().min(1, "Ville requise").max(120),
    department: departmentSchema,
    professionalEmail: z.email("Email professionnel invalide").nullable(),
    professionalPhone: z
      .string()
      .regex(/^\+?[0-9]{6,20}$/, "Téléphone professionnel invalide")
      .nullable(),
    linkedinUrl: externalUrlSchema
      .refine((value) => {
        try {
          const hostname = new URL(value).hostname.replace(/^www\./, "");
          return (
            hostname === "linkedin.com" || hostname.endsWith(".linkedin.com")
          );
        } catch {
          return false;
        }
      }, "URL LinkedIn invalide")
      .nullable(),
    signalType: z.string().min(1, "Type de signal requis").max(120),
    signalTitle: z.string().min(1, "Titre du signal requis").max(220),
    signalDescription: z
      .string()
      .min(1, "Description du signal requise")
      .max(3_000),
    eventDate: dateSchema,
    sourceName: z.string().min(1, "Nom de source requis").max(180),
    sourceUrl: externalUrlSchema,
    sourcePublishedAt: dateSchema.nullable(),
    whyNow: z
      .string()
      .min(1, "Interprétation « Pourquoi maintenant ? » requise")
      .max(3_000),
    potentialNeeds: z.array(z.string().min(1).max(180)).max(12),
    emailVerificationStatus: verificationSchema,
    phoneVerificationStatus: verificationSchema,
    linkedinVerificationStatus: verificationSchema,
    confidenceLevel: z.enum([
      ConfidenceLevel.LOW,
      ConfidenceLevel.MEDIUM,
      ConfidenceLevel.HIGH,
    ]),
    notes: z.string().max(5_000).nullable(),
  })
  .superRefine((row, context) => {
    if (!row.companyName && !row.jobTitle) {
      context.addIssue({
        code: "custom",
        message: "Une entreprise ou une fonction professionnelle est requise",
        path: ["companyName"],
      });
    }
    if (!row.professionalEmail && !row.professionalPhone && !row.linkedinUrl) {
      context.addIssue({
        code: "custom",
        message: "Au moins une coordonnée professionnelle est requise",
        path: ["professionalEmail"],
      });
    }
  });

const FIELD_NAMES: Record<keyof NormalizedImportRow, string> = {
  city: "city",
  companyName: "company_name",
  companyWebsite: "company_website",
  confidenceLevel: "confidence_level",
  department: "department",
  emailVerificationStatus: "email_verification_status",
  eventDate: "event_date",
  firstName: "first_name",
  jobTitle: "job_title",
  lastName: "last_name",
  linkedinUrl: "linkedin_url",
  linkedinVerificationStatus: "linkedin_verification_status",
  notes: "notes",
  phoneVerificationStatus: "phone_verification_status",
  potentialNeeds: "potential_needs",
  professionalEmail: "professional_email",
  professionalPhone: "professional_phone",
  signalDescription: "signal_description",
  signalTitle: "signal_title",
  signalType: "signal_type",
  sourceName: "source_name",
  sourcePublishedAt: "source_published_at",
  sourceUrl: "source_url",
  whyNow: "why_now",
};

function countDelimiter(line: string, delimiter: "," | ";") {
  let count = 0;
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === '"') {
      if (quoted && line[index + 1] === '"') {
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && line[index] === delimiter) {
      count += 1;
    }
  }
  return count;
}

export function detectCsvDelimiter(content: string): "," | ";" {
  const firstLine = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .find((line) => line.trim());
  if (!firstLine) {
    return ",";
  }
  return countDelimiter(firstLine, ";") > countDelimiter(firstLine, ",")
    ? ";"
    : ",";
}

function normalizeRawRow(raw: RawCsvRow): NormalizedImportRow {
  return {
    firstName: titleCase(raw.first_name ?? ""),
    lastName: titleCase(raw.last_name ?? ""),
    jobTitle: normalizeWhitespace(raw.job_title ?? ""),
    companyName: normalizeWhitespace(raw.company_name ?? ""),
    companyWebsite: normalizeExternalUrl(raw.company_website ?? ""),
    city: titleCase(raw.city ?? ""),
    department: normalizeDepartment(raw.department ?? ""),
    professionalEmail: normalizeEmail(raw.professional_email ?? ""),
    professionalPhone: normalizePhone(raw.professional_phone ?? ""),
    linkedinUrl: normalizeLinkedinUrl(raw.linkedin_url ?? ""),
    signalType: normalizeWhitespace(raw.signal_type ?? ""),
    signalTitle: normalizeWhitespace(raw.signal_title ?? ""),
    signalDescription: normalizeWhitespace(raw.signal_description ?? ""),
    eventDate: normalizeDate(raw.event_date ?? "") ?? "",
    sourceName: normalizeWhitespace(raw.source_name ?? ""),
    sourceUrl: normalizeExternalUrl(raw.source_url ?? "") ?? "",
    sourcePublishedAt: normalizeDate(raw.source_published_at ?? ""),
    whyNow: normalizeWhitespace(raw.why_now ?? ""),
    potentialNeeds: normalizePotentialNeeds(raw.potential_needs ?? ""),
    emailVerificationStatus: normalizeEnum(
      raw.email_verification_status ?? "",
      VerificationStatus.UNVERIFIED,
    ) as VerificationStatus,
    phoneVerificationStatus: normalizeEnum(
      raw.phone_verification_status ?? "",
      VerificationStatus.UNVERIFIED,
    ) as VerificationStatus,
    linkedinVerificationStatus: normalizeEnum(
      raw.linkedin_verification_status ?? "",
      VerificationStatus.UNVERIFIED,
    ) as VerificationStatus,
    confidenceLevel: normalizeEnum(
      raw.confidence_level ?? "",
      ConfidenceLevel.MEDIUM,
    ) as ConfidenceLevel,
    notes: normalizeWhitespace(raw.notes ?? "") || null,
  };
}

function validationErrors(
  raw: RawCsvRow,
  normalized: NormalizedImportRow,
): ImportFieldError[] {
  const result = normalizedRowSchema.safeParse(normalized);
  if (result.success) {
    return [];
  }

  return result.error.issues.map((issue) => {
    const normalizedField = issue.path[0] as keyof NormalizedImportRow;
    const field = FIELD_NAMES[normalizedField] ?? "row";
    return {
      field,
      message: issue.message,
      originalValue: raw[field] ?? "",
    };
  });
}

export function parseCsvContent(content: string): ParsedCsv {
  const delimiter = detectCsvDelimiter(content);
  const records = parse(content, {
    bom: true,
    delimiter,
    relax_column_count: true,
    relax_quotes: false,
    skip_empty_lines: true,
    trim: false,
  }) as string[][];

  if (!records.length) {
    return {
      delimiter,
      headers: [],
      missingColumns: [...REQUIRED_CSV_COLUMNS],
      rows: [],
    };
  }

  const headers = records[0]!.map((header) =>
    normalizeWhitespace(header).toLowerCase(),
  );
  const missingColumns = REQUIRED_CSV_COLUMNS.filter(
    (column) => !headers.includes(column),
  );

  const rows = records.slice(1).map((values, rowIndex) => {
    const rawData = Object.fromEntries(
      headers.map((header, index) => [header, values[index] ?? ""]),
    );
    const normalizedData = normalizeRawRow(rawData);
    const errors = validationErrors(rawData, normalizedData);

    if (values.length !== headers.length) {
      errors.push({
        field: "row",
        message: `Nombre de colonnes incorrect : ${values.length} au lieu de ${headers.length}`,
        originalValue: values.join(delimiter),
      });
    }

    return {
      errors,
      normalizedData: errors.length ? null : normalizedData,
      rawData,
      rowNumber: rowIndex + 2,
    };
  });

  return { delimiter, headers, missingColumns, rows };
}

export function parseStoredNormalizedRow(
  value: unknown,
): NormalizedImportRow | null {
  const parsed = normalizedRowSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
