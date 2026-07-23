export const REQUIRED_CSV_COLUMNS = [
  "first_name",
  "last_name",
  "job_title",
  "company_name",
  "company_website",
  "city",
  "department",
  "professional_email",
  "professional_phone",
  "linkedin_url",
  "signal_type",
  "signal_title",
  "signal_description",
  "event_date",
  "source_name",
  "source_url",
  "source_published_at",
  "why_now",
  "potential_needs",
] as const;

export const OPTIONAL_CSV_COLUMNS = [
  "email_verification_status",
  "phone_verification_status",
  "linkedin_verification_status",
  "confidence_level",
  "notes",
] as const;

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const CSV_IMPORT_MAX_BYTES = positiveInteger(
  process.env.CSV_IMPORT_MAX_BYTES,
  5 * 1024 * 1024,
);

export const CSV_IMPORT_MAX_ROWS = positiveInteger(
  process.env.CSV_IMPORT_MAX_ROWS,
  1_000,
);

export const CSV_IMPORT_BATCH_SIZE = 25;
