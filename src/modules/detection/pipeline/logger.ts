type DetectionLog = {
  stage:
    | "collection"
    | "parsing"
    | "signal_extraction"
    | "company_matching"
    | "prospect_identification"
    | "deduplication"
    | "qualification"
    | "opportunity_creation";
  detectionRunId: string;
  sourceKey: string;
  status: "started" | "completed" | "ignored" | "failed";
  documentId?: string;
  signalId?: string;
  prospectId?: string;
  opportunityId?: string;
  durationMs?: number;
  reasonCode?: string;
};

export function detectionLog(entry: DetectionLog) {
  const payload = {
    timestamp: new Date().toISOString(),
    scope: "detection",
    ...entry,
  };
  console.info(JSON.stringify(payload));
}
