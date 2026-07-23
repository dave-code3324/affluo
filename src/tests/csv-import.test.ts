import {
  ContactDetailType,
  ContactabilityStatus,
  SignalVerificationStatus,
  VerificationStatus,
} from "@prisma/client";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  findSecondaryDuplicate,
  findStrongDuplicate,
} from "@/modules/admin/imports/duplicates";
import {
  neutralizeCsvFormula,
  normalizeEmail,
  normalizeExternalUrl,
  normalizePhone,
} from "@/modules/admin/imports/normalization";
import {
  detectCsvDelimiter,
  parseCsvContent,
} from "@/modules/admin/imports/parser";
import {
  ImportValidationError,
  validateCsvUpload,
} from "@/modules/admin/imports/service";
import type {
  DuplicateCandidate,
  NormalizedImportRow,
} from "@/modules/admin/imports/types";
import { approvalReadiness } from "@/modules/admin/review/domain";

const normalizedRow: NormalizedImportRow = {
  firstName: "Claire",
  lastName: "Martin",
  jobTitle: "Présidente",
  companyName: "Atelier Démo",
  companyWebsite: "https://example.com/atelier",
  city: "Lyon",
  department: "69",
  professionalEmail: "claire@example.com",
  professionalPhone: null,
  linkedinUrl: "https://linkedin.com/in/demo-claire",
  signalType: "Gouvernance",
  signalTitle: "Cession annoncée",
  signalDescription: "Une cession a été annoncée.",
  eventDate: "2026-09-08",
  sourceName: "Source fictive",
  sourceUrl: "https://example.com/source",
  sourcePublishedAt: "2026-09-08",
  whyNow: "Cet événement peut créer un besoin patrimonial.",
  potentialNeeds: ["Diversification"],
  emailVerificationStatus: VerificationStatus.VERIFIED,
  phoneVerificationStatus: VerificationStatus.UNVERIFIED,
  linkedinVerificationStatus: VerificationStatus.LIKELY,
  confidenceLevel: "HIGH",
  notes: null,
};

const candidate: DuplicateCandidate = {
  id: "10000000-0000-4000-8000-000000000001",
  firstName: "Claire",
  lastName: "Martin",
  jobTitle: "Présidente",
  companyName: "Atelier Demo",
  companyWebsite: "https://example.com",
  city: "Lyon",
  department: "69",
  emails: ["CLAIRE@example.com"],
  phones: [],
  linkedinUrls: [],
};

describe("CSV imports", () => {
  it("detects comma and semicolon delimiters", () => {
    expect(detectCsvDelimiter("first_name,last_name\nClaire,Martin")).toBe(",");
    expect(detectCsvDelimiter("first_name;last_name\nClaire;Martin")).toBe(";");
  });

  it("parses the demonstration fixture and reports invalid rows", () => {
    const fixture = readFileSync(
      resolve(process.cwd(), "fixtures/imports/affluo-demo-import.csv"),
      "utf8",
    );
    const parsed = parseCsvContent(fixture);

    expect(parsed.delimiter).toBe(";");
    expect(parsed.missingColumns).toEqual([]);
    expect(parsed.rows).toHaveLength(11);
    expect(
      parsed.rows.filter(({ normalizedData }) => normalizedData).length,
    ).toBe(7);
    expect(
      parsed.rows.some(({ errors }) =>
        errors.some(({ field }) => field === "source_url"),
      ),
    ).toBe(true);
  });

  it("normalizes emails, phones and URLs without claiming verification", () => {
    expect(normalizeEmail(" Claire.Martin@Entreprise.FR ")).toBe(
      "claire.martin@entreprise.fr",
    );
    expect(normalizePhone("00 33 (0)4 12 34 56 78")).toBe("+330412345678");
    expect(normalizeExternalUrl("Entreprise.FR/actualites")).toBe(
      "https://entreprise.fr/actualites",
    );
  });

  it("detects strong and secondary duplicates without merging by name alone", () => {
    expect(findStrongDuplicate(normalizedRow, [candidate])).toMatchObject({
      level: "STRONG",
      candidateId: candidate.id,
    });

    const withoutStrong = {
      ...normalizedRow,
      professionalEmail: "distinct@example.com",
      linkedinUrl: null,
    };
    expect(findSecondaryDuplicate(withoutStrong, [candidate])).toMatchObject({
      level: "SECONDARY",
    });
    expect(
      findSecondaryDuplicate(
        {
          ...withoutStrong,
          companyName: "Autre",
          companyWebsite: "https://other.example",
          city: "Paris",
          department: "75",
          jobTitle: "Artiste",
        },
        [candidate],
      ),
    ).toBeNull();
  });

  it("prevents approval without a usable professional contact", () => {
    const result = approvalReadiness({
      contactabilityStatus: ContactabilityStatus.NOT_CONTACTABLE,
      prospect: {
        firstName: "Claire",
        lastName: "Martin",
        companyName: "Atelier Démo",
        jobTitle: "Présidente",
        contactDetails: [],
      },
      signals: [
        {
          signal: {
            description: "Une cession a été annoncée.",
            sourceName: "Source fictive",
            sourceUrl: "https://example.com/source",
            verificationStatus: SignalVerificationStatus.UNVERIFIED,
          },
        },
      ],
      whyNow: "Une réorganisation patrimoniale peut être étudiée.",
    });

    expect(result.allowed).toBe(false);
    expect(result.reasons).toContain(
      "Aucun canal professionnel utilisable n’est disponible.",
    );
  });

  it("allows approval when facts, source, interpretation and contact are present", () => {
    const result = approvalReadiness({
      contactabilityStatus: ContactabilityStatus.PARTIALLY_VERIFIED,
      prospect: {
        firstName: "Claire",
        lastName: "Martin",
        companyName: "Atelier Démo",
        jobTitle: "Présidente",
        contactDetails: [
          {
            type: ContactDetailType.PROFESSIONAL_EMAIL,
            value: "claire@example.com",
            verificationStatus: VerificationStatus.LIKELY,
          },
        ],
      },
      signals: [
        {
          signal: {
            description: "Une cession a été annoncée.",
            sourceName: "Source fictive",
            sourceUrl: "https://example.com/source",
            verificationStatus: SignalVerificationStatus.UNVERIFIED,
          },
        },
      ],
      whyNow: "Une réorganisation patrimoniale peut être étudiée.",
    });
    expect(result).toEqual({ allowed: true, reasons: [] });
  });

  it("neutralizes dangerous spreadsheet formulas during export", () => {
    expect(neutralizeCsvFormula('=HYPERLINK("bad")')).toBe(
      '\'=HYPERLINK("bad")',
    );
    expect(neutralizeCsvFormula("+cmd")).toBe("'+cmd");
    expect(neutralizeCsvFormula("texte sûr")).toBe("texte sûr");
  });

  it("rejects misleading file extensions and oversized uploads", () => {
    expect(() =>
      validateCsvUpload({
        name: "../../prospects.csv.exe",
        size: 100,
        type: "text/csv",
      }),
    ).toThrow(ImportValidationError);
    expect(() =>
      validateCsvUpload({
        name: "prospects.csv",
        size: 6 * 1024 * 1024,
        type: "text/csv",
      }),
    ).toThrow("moins de");
  });
});
