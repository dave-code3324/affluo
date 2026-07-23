function booleanEnvironment(name: string, fallback = false) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) {
    return fallback;
  }
  return value === "true" || value === "1";
}

function integerEnvironment(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const value = Number(process.env[name] ?? fallback);
  return Number.isInteger(value) && value >= minimum && value <= maximum
    ? value
    : fallback;
}

export const detectionConfig = {
  enabled: booleanEnvironment("DETECTION_ENABLED"),
  schedulerEnabled: booleanEnvironment("DETECTION_SCHEDULER_ENABLED"),
  llmEnabled: booleanEnvironment("DETECTION_LLM_ENABLED"),
  maxDocumentsPerRun: integerEnvironment(
    "DETECTION_MAX_DOCUMENTS_PER_RUN",
    50,
    1,
    500,
  ),
  maxDocumentAttempts: integerEnvironment(
    "DETECTION_MAX_DOCUMENT_ATTEMPTS",
    3,
    1,
    10,
  ),
  minimumScore: integerEnvironment("DETECTION_MINIMUM_SCORE", 75, 0, 100),
  maximumSignalAgeDays: integerEnvironment(
    "DETECTION_MAXIMUM_SIGNAL_AGE_DAYS",
    120,
    1,
    730,
  ),
  staleRunMinutes: integerEnvironment(
    "DETECTION_STALE_RUN_MINUTES",
    30,
    5,
    1_440,
  ),
  bodacc: {
    enabled: booleanEnvironment("DETECTION_SOURCE_BODACC_ENABLED"),
    intervalMinutes: integerEnvironment(
      "DETECTION_SOURCE_BODACC_INTERVAL_MINUTES",
      1_440,
      15,
      43_200,
    ),
    apiBaseUrl:
      process.env.DETECTION_BODACC_API_URL?.trim() ||
      "https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records",
  },
  demo: {
    enabled: booleanEnvironment("DETECTION_SOURCE_BODACC_DEMO_ENABLED"),
    intervalMinutes: 1_440,
  },
} as const;
