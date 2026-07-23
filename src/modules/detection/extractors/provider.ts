import {
  ConfidenceLevel,
  DetectionSignalType,
  ExtractionMethod,
} from "@prisma/client";
import { z } from "zod";

import type {
  CollectedDocument,
  SignalCandidate,
} from "@/modules/detection/types";

const nullableUrl = z.union([z.url(), z.null()]);

export const signalExtractionOutputSchema = z.object({
  type: z.enum([
    DetectionSignalType.COMPANY_SALE,
    DetectionSignalType.BUSINESS_TRANSFER,
    DetectionSignalType.FUNDRAISING,
    DetectionSignalType.MANAGEMENT_CHANGE,
    DetectionSignalType.COMPANY_CREATION,
    DetectionSignalType.COMPANY_CLOSURE,
    DetectionSignalType.DIVIDEND_EVENT,
    DetectionSignalType.REAL_ESTATE_TRANSACTION,
    DetectionSignalType.PROFESSIONAL_SUCCESSION,
    DetectionSignalType.LIQUIDITY_EVENT,
    DetectionSignalType.OTHER,
  ]),
  title: z.string().trim().min(1).max(220),
  factualSummary: z.string().trim().min(40).max(3_000),
  eventDate: z.iso.datetime(),
  sourceUrl: z.url(),
  company: z.object({
    legalName: z.string().trim().min(1).max(220),
    tradeName: z.string().trim().max(220).nullable(),
    siren: z
      .string()
      .regex(/^\d{9}$/)
      .nullable(),
    siret: z
      .string()
      .regex(/^\d{14}$/)
      .nullable(),
    website: nullableUrl,
    city: z.string().trim().max(120).nullable(),
    department: z.string().trim().max(3).nullable(),
    industry: z.string().trim().max(180).nullable(),
    legalForm: z.string().trim().max(180).nullable(),
  }),
  prospect: z.object({
    firstName: z.string().trim().min(1).max(120),
    lastName: z.string().trim().min(1).max(120),
    jobTitle: z.string().trim().min(1).max(180),
    identificationSource: z.url(),
    identificationConfidence: z.number().int().min(0).max(100),
    professionalEmail: z.email().nullable(),
    professionalPhone: z
      .string()
      .regex(/^\+?[0-9]{6,20}$/)
      .nullable(),
    linkedinUrl: nullableUrl,
  }),
  confidenceLevel: z.enum([
    ConfidenceLevel.LOW,
    ConfidenceLevel.MEDIUM,
    ConfidenceLevel.HIGH,
  ]),
  evidence: z
    .array(
      z.object({
        field: z.string().min(1).max(100),
        documentExcerpt: z.string().min(1).max(500),
      }),
    )
    .min(1),
});

export type SignalExtractionOutput = z.infer<
  typeof signalExtractionOutputSchema
>;

export interface SignalExtractionProvider {
  readonly provider: string;
  readonly model: string;
  readonly promptVersion: string;
  extract(document: CollectedDocument): Promise<SignalExtractionOutput>;
}

export function candidateFromProviderOutput(
  output: SignalExtractionOutput,
): SignalCandidate {
  return {
    type: output.type,
    title: output.title,
    factualSummary: output.factualSummary,
    eventDate: new Date(output.eventDate),
    sourceUrl: output.sourceUrl,
    company: output.company,
    prospect: output.prospect,
    extractionMethod: ExtractionMethod.LLM,
    extractionVersion: output.evidence.length
      ? "llm-structured-v1"
      : "llm-invalid",
  };
}
