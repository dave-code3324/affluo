import {
  ConfidenceLevel,
  DetectionSignalType,
  ExtractionMethod,
} from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  candidateFromProviderOutput,
  signalExtractionOutputSchema,
} from "@/modules/detection/extractors/provider";
import { findCompanyMatch } from "@/modules/detection/matching/company";
import { findProspectMatch } from "@/modules/detection/matching/prospect";
import {
  extractBodaccCandidate,
  classifySignal,
} from "@/modules/detection/parsers/bodacc";
import {
  documentFingerprint,
  normalizeDocumentContent,
  normalizeSourceUrl,
} from "@/modules/detection/pipeline/document";
import { patrimonialHypotheses } from "@/modules/detection/signals/hypotheses";
import {
  qualifySignal,
  signalAgeDays,
} from "@/modules/detection/signals/qualification";
import { BodaccDemoSource } from "@/modules/detection/sources/demo";

async function demoCandidate() {
  const source = new BodaccDemoSource();
  const [document] = await source.collect({
    detectionRunId: "00000000-0000-4000-8000-000000000001",
    limit: 10,
    since: new Date("2026-01-01"),
  });
  if (!document) {
    throw new Error("Fixture BODACC absente.");
  }
  const extraction = extractBodaccCandidate(document);
  if (extraction.outcome !== "candidate") {
    throw new Error(extraction.reasons.join(", "));
  }
  return extraction.candidate;
}

describe("Patrimoine Radar detection", () => {
  it("normalizes documents and produces stable fingerprints", () => {
    const left = '{"b":2,"a":{"z":3,"x":1}}';
    const right = '{ "a": { "x": 1, "z": 3 }, "b": 2 }';
    expect(normalizeDocumentContent(left)).toBe('{"a":{"x":1,"z":3},"b":2}');
    expect(documentFingerprint(left)).toBe(documentFingerprint(right));
    expect(
      normalizeSourceUrl(
        "HTTPS://WWW.BODACC.FR/example/?utm_source=test&id=42#details",
      ),
    ).toBe("https://www.bodacc.fr/example/?id=42");
  });

  it("classifies the signal without patrimonial interpretation", () => {
    expect(classifySignal("Cession d’un fonds de commerce", "vente")).toBe(
      DetectionSignalType.BUSINESS_TRANSFER,
    );
    expect(classifySignal("Levée de fonds annoncée")).toBe(
      DetectionSignalType.FUNDRAISING,
    );
    expect(classifySignal("Nomination d’un nouveau président")).toBe(
      DetectionSignalType.MANAGEMENT_CHANGE,
    );
  });

  it("extracts only an explicitly identified BODACC previous owner", async () => {
    const candidate = await demoCandidate();
    expect(candidate.prospect).toMatchObject({
      firstName: "Camille",
      lastName: "Lefèvre",
      identificationConfidence: 95,
    });
    expect(candidate.company.siren).toBe("812345678");
    expect(candidate.factualSummary).not.toMatch(
      /patrimoine|liquidités personnelles|diversification/i,
    );
  });

  it("computes age using UTC calendar days", () => {
    expect(
      signalAgeDays(
        new Date("2026-07-01T00:00:00.000Z"),
        new Date("2026-07-23T20:00:00.000Z"),
      ),
    ).toBe(22);
  });

  it("matches companies by SIREN before weaker attributes", () => {
    const match = findCompanyMatch(
      {
        legalName: "Nom différent",
        tradeName: null,
        siren: "812345678",
        siret: null,
        website: null,
        city: "Paris",
        department: "75",
        industry: null,
        legalForm: null,
      },
      [
        {
          id: "company-1",
          legalName: "Camille Lefèvre",
          siren: "812345678",
          siret: null,
          normalizedDomain: null,
          city: "Nantes",
          department: "44",
        },
      ],
    );
    expect(match?.reason).toBe("SIREN");
  });

  it("never merges companies on a similar name alone", () => {
    expect(
      findCompanyMatch(
        {
          legalName: "Atelier Horizon",
          tradeName: null,
          siren: null,
          siret: null,
          website: null,
          city: "Nantes",
          department: "44",
          industry: null,
          legalForm: null,
        },
        [
          {
            id: "company-1",
            legalName: "Atelier Horizon",
            siren: null,
            siret: null,
            normalizedDomain: null,
            city: "Paris",
            department: "75",
          },
        ],
      ),
    ).toBeNull();
  });

  it("matches a prospect through identity and company", () => {
    expect(
      findProspectMatch(
        {
          firstName: "Camille",
          lastName: "Lefèvre",
          companyId: "company-1",
          professionalEmail: null,
          linkedinUrl: null,
        },
        [
          {
            id: "prospect-1",
            firstName: "CAMILLE",
            lastName: "Lefevre",
            companyId: "company-1",
            professionalEmail: null,
            linkedinUrl: null,
          },
        ],
      )?.reason,
    ).toBe("IDENTITY_AND_COMPANY");
  });

  it("qualifies a recent sourced event and excludes an old one", async () => {
    const candidate = await demoCandidate();
    const referenceDate = new Date(candidate.eventDate);
    referenceDate.setUTCDate(referenceDate.getUTCDate() + 7);
    expect(qualifySignal(candidate, { referenceDate })).toMatchObject({
      isRelevant: true,
      confidenceLevel: ConfidenceLevel.HIGH,
    });

    const oldReference = new Date(candidate.eventDate);
    oldReference.setUTCDate(oldReference.getUTCDate() + 121);
    expect(
      qualifySignal(candidate, { referenceDate: oldReference }),
    ).toMatchObject({
      isRelevant: false,
      rejectionReasons: expect.arrayContaining(["SIGNAL_TOO_OLD"]),
    });
  });

  it("validates structured provider output and rejects invented evidence", async () => {
    const candidate = await demoCandidate();
    const output = {
      ...candidate,
      eventDate: candidate.eventDate.toISOString(),
      confidenceLevel: ConfidenceLevel.HIGH,
      evidence: [],
    };
    expect(signalExtractionOutputSchema.safeParse(output).success).toBe(false);

    const valid = signalExtractionOutputSchema.parse({
      ...output,
      evidence: [
        {
          field: "eventDate",
          documentExcerpt: "Date d’effet publiée : 2026-07-16",
        },
      ],
    });
    expect(candidateFromProviderOutput(valid).extractionMethod).toBe(
      ExtractionMethod.LLM,
    );
  });

  it("keeps patrimonial hypotheses separate from factual summaries", async () => {
    const candidate = await demoCandidate();
    const hypotheses = patrimonialHypotheses(candidate);
    expect(hypotheses.whyNow).toMatch(/^Hypothèse Affluo/);
    expect(hypotheses.qualificationSummary).toContain("Aucun besoin");
    expect(candidate.factualSummary).not.toContain("Hypothèse Affluo");
  });
});
