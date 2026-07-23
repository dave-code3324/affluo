import {
  ContactDetailType,
  ContactabilityStatus,
  OpportunityOrigin,
  OpportunityReviewStatus,
  OpportunityStatus,
  Prisma,
  SignalVerificationStatus,
  VerificationStatus,
} from "@prisma/client";

import {
  findCompanyMatch,
  type CompanyMatchCandidate,
} from "@/modules/detection/matching/company";
import {
  findProspectMatch,
  type ProspectMatchCandidate,
} from "@/modules/detection/matching/prospect";
import { patrimonialHypotheses } from "@/modules/detection/signals/hypotheses";
import type {
  AutomaticQualification,
  SignalCandidate,
} from "@/modules/detection/types";

function comparisonKey(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function domain(value: string | null) {
  if (!value) {
    return null;
  }
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

async function matchOrCreateCompany(
  transaction: Prisma.TransactionClient,
  candidate: SignalCandidate,
) {
  const company = candidate.company;
  const candidates = await transaction.company.findMany({
    where: {
      OR: [
        ...(company.siren ? [{ siren: company.siren }] : []),
        ...(company.siret ? [{ siret: company.siret }] : []),
        ...(domain(company.website)
          ? [{ normalizedDomain: domain(company.website) }]
          : []),
        { normalizedName: comparisonKey(company.legalName) },
      ],
    },
    take: 20,
    select: {
      id: true,
      legalName: true,
      siren: true,
      siret: true,
      normalizedDomain: true,
      city: true,
      department: true,
    },
  });
  const match = findCompanyMatch(
    company,
    candidates satisfies CompanyMatchCandidate[],
  );
  if (match) {
    const saved = await transaction.company.update({
      where: { id: match.candidate.id },
      data: {
        city: company.city,
        department: company.department,
        industry: company.industry,
        legalForm: company.legalForm,
        legalName: company.legalName,
        name: company.tradeName ?? company.legalName,
        normalizedDomain: domain(company.website),
        normalizedName: comparisonKey(company.legalName),
        siren: company.siren,
        siret: company.siret,
        tradeName: company.tradeName,
        website: company.website,
      },
    });
    return { company: saved, created: false, matchReason: match.reason };
  }
  const saved = await transaction.company.create({
    data: {
      city: company.city,
      department: company.department,
      industry: company.industry,
      legalForm: company.legalForm,
      legalName: company.legalName,
      name: company.tradeName ?? company.legalName,
      normalizedDomain: domain(company.website),
      normalizedName: comparisonKey(company.legalName),
      siren: company.siren,
      siret: company.siret,
      tradeName: company.tradeName,
      website: company.website,
    },
  });
  return { company: saved, created: true, matchReason: "CREATED" as const };
}

async function matchOrCreateProspect(
  transaction: Prisma.TransactionClient,
  companyId: string,
  candidate: SignalCandidate,
) {
  const prospect = candidate.prospect;
  const candidates = await transaction.prospect.findMany({
    where: {
      OR: [
        ...(prospect.professionalEmail
          ? [
              {
                professionalEmail: {
                  equals: prospect.professionalEmail,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            ]
          : []),
        ...(prospect.linkedinUrl
          ? [{ linkedinUrl: prospect.linkedinUrl }]
          : []),
        {
          companyId,
          firstName: {
            equals: prospect.firstName,
            mode: Prisma.QueryMode.insensitive,
          },
          lastName: {
            equals: prospect.lastName,
            mode: Prisma.QueryMode.insensitive,
          },
        },
      ],
    },
    take: 20,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      companyId: true,
      professionalEmail: true,
      linkedinUrl: true,
    },
  });
  const match = findProspectMatch(
    { ...prospect, companyId },
    candidates satisfies ProspectMatchCandidate[],
  );
  const commonData = {
    city: candidate.company.city ?? "",
    companyId,
    companyName: candidate.company.tradeName ?? candidate.company.legalName,
    department: candidate.company.department ?? "",
    firstName: prospect.firstName,
    identificationConfidence: prospect.identificationConfidence,
    identificationSource: prospect.identificationSource,
    jobTitle: prospect.jobTitle,
    lastName: prospect.lastName,
    linkedinUrl: prospect.linkedinUrl,
    professionalEmail: prospect.professionalEmail,
  };
  if (match) {
    const saved = await transaction.prospect.update({
      where: { id: match.candidate.id },
      data: commonData,
    });
    return { prospect: saved, created: false, matchReason: match.reason };
  }
  const saved = await transaction.prospect.create({
    data: commonData,
  });
  return { prospect: saved, created: true, matchReason: "CREATED" as const };
}

async function saveContacts(
  transaction: Prisma.TransactionClient,
  prospectId: string,
  candidate: SignalCandidate,
) {
  const contacts = [
    candidate.prospect.professionalEmail
      ? {
          type: ContactDetailType.PROFESSIONAL_EMAIL,
          value: candidate.prospect.professionalEmail,
        }
      : null,
    candidate.prospect.professionalPhone
      ? {
          type: ContactDetailType.PROFESSIONAL_PHONE,
          value: candidate.prospect.professionalPhone,
        }
      : null,
    candidate.prospect.linkedinUrl
      ? {
          type: ContactDetailType.LINKEDIN,
          value: candidate.prospect.linkedinUrl,
        }
      : null,
    candidate.company.website
      ? {
          type: ContactDetailType.COMPANY_WEBSITE,
          value: candidate.company.website,
        }
      : null,
  ].filter((contact): contact is NonNullable<typeof contact> =>
    Boolean(contact),
  );
  for (const [index, contact] of contacts.entries()) {
    await transaction.contactDetail.upsert({
      where: {
        prospectId_type_value: {
          prospectId,
          type: contact.type,
          value: contact.value,
        },
      },
      update: {},
      create: {
        isPrimary: index < 3,
        prospectId,
        type: contact.type,
        value: contact.value,
        verificationStatus: VerificationStatus.UNVERIFIED,
      },
    });
  }
  return contacts.length;
}

export async function persistQualifiedCandidate(
  transaction: Prisma.TransactionClient,
  {
    candidate,
    detectionRunId,
    qualification,
    sourceDocumentId,
    sourceKey,
    sourcePublishedAt,
  }: {
    candidate: SignalCandidate;
    detectionRunId: string;
    qualification: AutomaticQualification;
    sourceDocumentId: string;
    sourceKey: string;
    sourcePublishedAt: Date | null;
  },
) {
  const existingSignal = await transaction.signal.findUnique({
    where: { sourceDocumentId },
    select: {
      id: true,
      prospectId: true,
      prospect: { select: { companyId: true } },
      opportunities: {
        take: 1,
        select: { opportunityId: true },
      },
    },
  });
  if (existingSignal) {
    return {
      companyCreated: false,
      companyId: existingSignal.prospect.companyId,
      prospectCreated: false,
      signalId: existingSignal.id,
      prospectId: existingSignal.prospectId,
      opportunityId: existingSignal.opportunities[0]?.opportunityId ?? null,
      opportunityCreated: false,
      duplicate: true,
    };
  }

  const companyResult = await matchOrCreateCompany(transaction, candidate);
  const prospectResult = await matchOrCreateProspect(
    transaction,
    companyResult.company.id,
    candidate,
  );
  const contactCount = await saveContacts(
    transaction,
    prospectResult.prospect.id,
    candidate,
  );
  const signal = await transaction.signal.create({
    data: {
      confidenceLevel: qualification.confidenceLevel,
      description: candidate.factualSummary,
      detectedAt: new Date(),
      eventDate: candidate.eventDate,
      extractionMethod: candidate.extractionMethod,
      extractionVersion: candidate.extractionVersion,
      prospectId: prospectResult.prospect.id,
      sourceDocumentId,
      sourceName: sourceKey,
      sourcePublishedAt,
      sourceUrl: candidate.sourceUrl,
      title: candidate.title,
      type: candidate.type,
      verificationStatus: SignalVerificationStatus.UNVERIFIED,
    },
  });
  const hypotheses = patrimonialHypotheses(candidate);
  const opportunity = await transaction.opportunity.create({
    data: {
      automaticConfidence: qualification.confidenceLevel,
      automaticScore: qualification.relevanceScore,
      confidenceLevel: qualification.confidenceLevel,
      contactabilityStatus:
        contactCount > 0
          ? ContactabilityStatus.PARTIALLY_VERIFIED
          : ContactabilityStatus.NOT_CONTACTABLE,
      detectionRunId,
      origin: OpportunityOrigin.AUTOMATED_DETECTION,
      potentialNeeds: hypotheses.potentialNeeds,
      prospectId: prospectResult.prospect.id,
      qualificationSummary: hypotheses.qualificationSummary,
      relevanceScore: qualification.relevanceScore,
      reviewStatus: OpportunityReviewStatus.TO_REVIEW,
      signalSummary: candidate.factualSummary,
      signalType: candidate.type,
      status: OpportunityStatus.DRAFT,
      title: candidate.title,
      whyNow: hypotheses.whyNow,
      signals: {
        create: {
          isPrimary: true,
          signalId: signal.id,
        },
      },
    },
  });
  return {
    companyCreated: companyResult.created,
    companyId: companyResult.company.id,
    prospectCreated: prospectResult.created,
    signalId: signal.id,
    prospectId: prospectResult.prospect.id,
    opportunityId: opportunity.id,
    opportunityCreated: true,
    duplicate: false,
  };
}
