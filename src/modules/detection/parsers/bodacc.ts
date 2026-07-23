import { DetectionSignalType, ExtractionMethod } from "@prisma/client";
import { z } from "zod";

import type {
  CandidateExtraction,
  CollectedDocument,
  ExtractedCompany,
  ExtractedProspect,
} from "@/modules/detection/types";

const looseRecordSchema = z.record(z.string(), z.unknown());

const personSchema = z
  .object({
    typePersonne: z.string().optional(),
    nom: z.string().optional(),
    prenom: z.string().optional(),
    denomination: z.string().optional(),
    formeJuridique: z.string().optional(),
    numeroImmatriculation: z
      .object({
        numeroIdentification: z.string().optional(),
      })
      .loose()
      .optional(),
  })
  .loose();

const demoContactSchema = z
  .object({
    professionalEmail: z.email().nullable().optional(),
    linkedinUrl: z.url().nullable().optional(),
    sourceUrl: z.url().optional(),
  })
  .optional();

const recordSchema = z
  .object({
    id: z.string().min(1),
    dateparution: z.iso.date(),
    familleavis: z.string(),
    commercant: z.string().nullable().optional(),
    ville: z.string().nullable().optional(),
    numerodepartement: z.string().nullable().optional(),
    registre: z.union([z.array(z.string()), z.string()]).optional(),
    listeprecedentproprietaire: z
      .union([z.string(), looseRecordSchema])
      .nullable()
      .optional(),
    acte: z.union([z.string(), looseRecordSchema]).nullable().optional(),
    url_complete: z.url(),
    demoContact: demoContactSchema,
  })
  .loose();

function decodedRecord(value: unknown) {
  if (!value) {
    return null;
  }
  const candidate =
    typeof value === "string"
      ? (() => {
          try {
            return JSON.parse(value) as unknown;
          } catch {
            return null;
          }
        })()
      : value;
  const parsed = looseRecordSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

function persons(value: unknown) {
  const decoded = decodedRecord(value);
  if (!decoded) {
    return [];
  }
  const entries = Array.isArray(decoded.personne)
    ? decoded.personne
    : [decoded.personne];
  return entries.flatMap((entry) => {
    const parsed = personSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

function digits(value: string | undefined) {
  return value?.replace(/\D/g, "") || null;
}

function identifier(value: string | undefined) {
  const normalized = digits(value);
  if (normalized?.length === 14) {
    return { siren: normalized.slice(0, 9), siret: normalized };
  }
  return {
    siren: normalized?.length === 9 ? normalized : null,
    siret: null,
  };
}

function firstName(value: string) {
  return value.split(",")[0]?.trim().split(/\s+/)[0] ?? "";
}

function eventDetails(value: unknown) {
  const act = decodedRecord(value);
  if (!act) {
    return null;
  }
  const sale = looseRecordSchema.safeParse(act.vente);
  return {
    description:
      typeof act.descriptif === "string" ? act.descriptif.trim() : "",
    effectiveDate:
      sale.success && typeof sale.data.dateEffet === "string"
        ? sale.data.dateEffet
        : null,
    category:
      sale.success && typeof sale.data.categorieVente === "string"
        ? sale.data.categorieVente
        : "",
  };
}

export function classifySignal(text: string, family = ""): DetectionSignalType {
  const normalized = `${family} ${text}`
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  if (/cession de titres|vente de titres|cession d.actions/.test(normalized)) {
    return DetectionSignalType.COMPANY_SALE;
  }
  if (/vente|cession|fonds de commerce|transmission/.test(normalized)) {
    return DetectionSignalType.BUSINESS_TRANSFER;
  }
  if (/levee de fonds|augmentation de capital/.test(normalized)) {
    return DetectionSignalType.FUNDRAISING;
  }
  if (/changement de dirigeant|nomination|president/.test(normalized)) {
    return DetectionSignalType.MANAGEMENT_CHANGE;
  }
  if (/creation|immatriculation/.test(normalized)) {
    return DetectionSignalType.COMPANY_CREATION;
  }
  if (/radiation|cessation|fermeture/.test(normalized)) {
    return DetectionSignalType.COMPANY_CLOSURE;
  }
  if (/dividende|distribution exceptionnelle/.test(normalized)) {
    return DetectionSignalType.DIVIDEND_EVENT;
  }
  return DetectionSignalType.OTHER;
}

function extractedCompany({
  department,
  legalName,
  personIdentifier,
  city,
}: {
  department: string | null;
  legalName: string;
  personIdentifier: string | undefined;
  city: string | null;
}): ExtractedCompany {
  const ids = identifier(personIdentifier);
  return {
    legalName,
    tradeName: null,
    siren: ids.siren,
    siret: ids.siret,
    website: null,
    city,
    department,
    industry: null,
    legalForm: "Entreprise individuelle",
  };
}

function extractedProspect({
  document,
  name,
  surname,
}: {
  document: CollectedDocument;
  name: string;
  surname: string;
}): ExtractedProspect {
  const parsed = recordSchema.parse(JSON.parse(document.content));
  const contact =
    document.sourceKey === "BODACC_DEMO" ? parsed.demoContact : undefined;
  return {
    firstName: firstName(name),
    lastName: surname.trim(),
    jobTitle: "Cédant ou ancien exploitant",
    identificationSource: document.sourceUrl,
    identificationConfidence: 95,
    professionalEmail: contact?.professionalEmail ?? null,
    professionalPhone: null,
    linkedinUrl: contact?.linkedinUrl ?? null,
  };
}

export function extractBodaccCandidate(
  document: CollectedDocument,
): CandidateExtraction {
  let unknownRecord: unknown;
  try {
    unknownRecord = JSON.parse(document.content);
  } catch {
    return { outcome: "ignored", reasons: ["DOCUMENT_JSON_INVALID"] };
  }
  const parsed = recordSchema.safeParse(unknownRecord);
  if (!parsed.success) {
    return { outcome: "ignored", reasons: ["BODACC_SCHEMA_INVALID"] };
  }
  const record = parsed.data;
  if (record.familleavis !== "vente") {
    return { outcome: "ignored", reasons: ["UNSUPPORTED_BODACC_FAMILY"] };
  }

  const previousOwners = persons(record.listeprecedentproprietaire);
  const person = previousOwners.find(
    (owner) =>
      owner.typePersonne?.toLowerCase() === "pp" &&
      owner.nom?.trim() &&
      owner.prenom?.trim(),
  );
  if (!person?.nom || !person.prenom) {
    return {
      outcome: "ignored",
      reasons: ["NO_EXPLICIT_INDIVIDUAL_PREVIOUS_OWNER"],
    };
  }

  const event = eventDetails(record.acte);
  if (!event?.description) {
    return { outcome: "ignored", reasons: ["NO_CONCRETE_EVENT"] };
  }
  const eventDateValue = event.effectiveDate ?? record.dateparution;
  const eventDate = new Date(`${eventDateValue}T00:00:00.000Z`);
  if (Number.isNaN(eventDate.getTime())) {
    return { outcome: "ignored", reasons: ["EVENT_DATE_INVALID"] };
  }

  const legalName = `${firstName(person.prenom)} ${person.nom.trim()}`;
  const company = extractedCompany({
    department: record.numerodepartement ?? null,
    legalName,
    personIdentifier:
      person.numeroImmatriculation?.numeroIdentification ??
      (Array.isArray(record.registre) ? record.registre[0] : record.registre),
    city: record.ville ?? null,
  });
  const prospect = extractedProspect({
    document,
    name: person.prenom,
    surname: person.nom,
  });
  const type = classifySignal(
    `${event.category} ${event.description}`,
    record.familleavis,
  );

  return {
    outcome: "candidate",
    candidate: {
      type,
      title: `Cession publiée concernant ${legalName}`,
      factualSummary: `Le BODACC publie une vente ou cession concernant l’activité précédemment exploitée par ${legalName}${record.ville ? ` à ${record.ville}` : ""}, avec une date d’effet au ${eventDate.toLocaleDateString("fr-FR", { timeZone: "UTC" })}.`,
      eventDate,
      sourceUrl: document.sourceUrl,
      company,
      prospect,
      extractionMethod: ExtractionMethod.DETERMINISTIC,
      extractionVersion: "bodacc-deterministic-v1",
    },
  };
}
