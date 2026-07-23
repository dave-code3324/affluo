import {
  ConfidenceLevel,
  ContactDetailType,
  ContactabilityStatus,
  OpportunityStatus,
  SignalVerificationStatus,
  VerificationStatus,
  PrismaClient,
  WeeklyBatchStatus,
} from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const prisma = new PrismaClient();

const DEMO = {
  alpha: {
    email: "cgp.alpha@demo.affluo.local",
    firmId: "10000000-0000-4000-8000-000000000001",
    firmName: "Cabinet Aster",
  },
  beta: {
    email: "cgp.beta@demo.affluo.local",
    firmId: "20000000-0000-4000-8000-000000000002",
    firmName: "Cabinet Boréal",
  },
} as const;

const BATCH_IDS = {
  alphaPublished: "11000000-0000-4000-8000-000000000011",
  alphaDraft: "11000000-0000-4000-8000-000000000012",
  betaPublished: "22000000-0000-4000-8000-000000000021",
  betaDraft: "22000000-0000-4000-8000-000000000022",
} as const;

const prospectSeeds = [
  {
    id: "31000000-0000-4000-8000-000000000031",
    firstName: "Claire",
    lastName: "Martin",
    jobTitle: "Présidente",
    companyName: "Atelier Horizon",
    city: "Lyon",
    department: "69",
    linkedinUrl: "https://www.linkedin.com/in/demo-claire-martin",
    professionalEmail: "claire.martin@example.com",
    emailVerificationStatus: VerificationStatus.VERIFIED,
  },
  {
    id: "32000000-0000-4000-8000-000000000032",
    firstName: "Julien",
    lastName: "Robert",
    jobTitle: "Pharmacien titulaire",
    companyName: "Pharmacie des Tilleuls",
    city: "Villeurbanne",
    department: "69",
    linkedinUrl: null,
    professionalEmail: "julien.robert@example.com",
    emailVerificationStatus: VerificationStatus.LIKELY,
  },
  {
    id: "33000000-0000-4000-8000-000000000033",
    firstName: "Sophie",
    lastName: "Bernard",
    jobTitle: "Directrice générale",
    companyName: "Manufacture Alba",
    city: "Saint-Étienne",
    department: "42",
    linkedinUrl: "https://www.linkedin.com/in/demo-sophie-bernard",
    professionalEmail: null,
    emailVerificationStatus: VerificationStatus.UNVERIFIED,
  },
  {
    id: "34000000-0000-4000-8000-000000000034",
    firstName: "Nicolas",
    lastName: "Petit",
    jobTitle: "Associé",
    companyName: "Lexis Conseil",
    city: "Annecy",
    department: "74",
    linkedinUrl: "https://www.linkedin.com/in/demo-nicolas-petit",
    professionalEmail: "nicolas.petit@example.com",
    emailVerificationStatus: VerificationStatus.VERIFIED,
  },
  {
    id: "35000000-0000-4000-8000-000000000035",
    firstName: "Émilie",
    lastName: "Moreau",
    jobTitle: "Fondatrice",
    companyName: "Nova Santé",
    city: "Grenoble",
    department: "38",
    linkedinUrl: null,
    professionalEmail: null,
    emailVerificationStatus: VerificationStatus.UNVERIFIED,
  },
  {
    id: "36000000-0000-4000-8000-000000000036",
    firstName: "Thomas",
    lastName: "Dubois",
    jobTitle: "Gérant",
    companyName: "Boréal Industrie",
    city: "Bordeaux",
    department: "33",
    linkedinUrl: "https://www.linkedin.com/in/demo-thomas-dubois",
    professionalEmail: "thomas.dubois@example.com",
    emailVerificationStatus: VerificationStatus.VERIFIED,
  },
  {
    id: "37000000-0000-4000-8000-000000000037",
    firstName: "Amandine",
    lastName: "Leroy",
    jobTitle: "Directrice associée",
    companyName: "Leroy Architecture",
    city: "Mérignac",
    department: "33",
    linkedinUrl: "https://www.linkedin.com/in/demo-amandine-leroy",
    professionalEmail: null,
    emailVerificationStatus: VerificationStatus.UNVERIFIED,
  },
  {
    id: "38000000-0000-4000-8000-000000000038",
    firstName: "Pierre",
    lastName: "Roux",
    jobTitle: "Chirurgien-dentiste",
    companyName: "Cabinet Dentaire Garonne",
    city: "Pessac",
    department: "33",
    linkedinUrl: null,
    professionalEmail: "pierre.roux@example.com",
    emailVerificationStatus: VerificationStatus.UNVERIFIED,
  },
] as const;

const opportunitySeeds = [
  {
    id: "41000000-0000-4000-8000-000000000041",
    firmId: DEMO.alpha.firmId,
    weeklyBatchId: BATCH_IDS.alphaPublished,
    prospectId: prospectSeeds[0].id,
    title: "Transmission d’entreprise en préparation",
    signalType: "Gouvernance",
    signalSummary: "Nomination d’une nouvelle direction opérationnelle",
    whyNow:
      "Cette évolution de gouvernance peut précéder une réorganisation du patrimoine professionnel de la dirigeante.",
    relevanceScore: 94,
    contactabilityStatus: ContactabilityStatus.CONTACTABLE,
    status: OpportunityStatus.PUBLISHED,
    confidenceLevel: ConfidenceLevel.HIGH,
    qualificationSummary:
      "Dirigeante d’une PME régionale correspondant au ciblage prioritaire du cabinet.",
    potentialNeeds: [
      "Organisation d’un éventuel produit de cession",
      "Diversification du patrimoine",
      "Préparation de la transmission",
      "Protection familiale",
    ],
    reviewedAt: new Date("2026-07-19T16:30:00.000Z"),
  },
  {
    id: "42000000-0000-4000-8000-000000000042",
    firmId: DEMO.alpha.firmId,
    weeklyBatchId: BATCH_IDS.alphaPublished,
    prospectId: prospectSeeds[1].id,
    title: "Installation professionnelle récente",
    signalType: "Acquisition",
    signalSummary: "Reprise d’une officine régionale",
    whyNow:
      "Une reprise d’officine ouvre généralement une période de structuration du financement, de la prévoyance et du patrimoine privé.",
    relevanceScore: 89,
    contactabilityStatus: ContactabilityStatus.CONTACTABLE,
    status: OpportunityStatus.PUBLISHED,
  },
  {
    id: "43000000-0000-4000-8000-000000000043",
    firmId: DEMO.alpha.firmId,
    weeklyBatchId: BATCH_IDS.alphaPublished,
    prospectId: prospectSeeds[2].id,
    title: "Croissance externe annoncée",
    signalType: "Développement",
    signalSummary: "Acquisition d’un atelier de production voisin",
    whyNow:
      "L’opération peut faire évoluer la rémunération, les garanties et la stratégie patrimoniale de l’équipe dirigeante.",
    relevanceScore: 86,
    contactabilityStatus: ContactabilityStatus.PARTIALLY_VERIFIED,
    status: OpportunityStatus.PUBLISHED,
  },
  {
    id: "44000000-0000-4000-8000-000000000044",
    firmId: DEMO.alpha.firmId,
    weeklyBatchId: BATCH_IDS.alphaPublished,
    prospectId: prospectSeeds[3].id,
    title: "Association au capital",
    signalType: "Capital",
    signalSummary: "Entrée récente comme associé du cabinet",
    whyNow:
      "L’entrée au capital crée un besoin potentiel d’organisation de l’investissement professionnel et de protection croisée.",
    relevanceScore: 82,
    contactabilityStatus: ContactabilityStatus.CONTACTABLE,
    status: OpportunityStatus.PUBLISHED,
  },
  {
    id: "45000000-0000-4000-8000-000000000045",
    firmId: DEMO.alpha.firmId,
    weeklyBatchId: BATCH_IDS.alphaDraft,
    prospectId: prospectSeeds[4].id,
    title: "Levée de fonds à qualifier",
    signalType: "Financement",
    signalSummary: "Tour de table en cours de vérification",
    whyNow: "Ce signal reste en qualification et ne doit pas être diffusé.",
    relevanceScore: 70,
    contactabilityStatus: ContactabilityStatus.NOT_CONTACTABLE,
    status: OpportunityStatus.DRAFT,
  },
  {
    id: "46000000-0000-4000-8000-000000000046",
    firmId: DEMO.beta.firmId,
    weeklyBatchId: BATCH_IDS.betaPublished,
    prospectId: prospectSeeds[5].id,
    title: "Cession partielle annoncée",
    signalType: "Capital",
    signalSummary: "Ouverture minoritaire du capital à un industriel",
    whyNow:
      "La liquidité créée peut justifier une réflexion patrimoniale personnelle.",
    relevanceScore: 91,
    contactabilityStatus: ContactabilityStatus.CONTACTABLE,
    status: OpportunityStatus.PUBLISHED,
  },
  {
    id: "47000000-0000-4000-8000-000000000047",
    firmId: DEMO.beta.firmId,
    weeklyBatchId: BATCH_IDS.betaPublished,
    prospectId: prospectSeeds[6].id,
    title: "Nouvelle association professionnelle",
    signalType: "Gouvernance",
    signalSummary: "Évolution récente de l’actionnariat de l’agence",
    whyNow:
      "L’association peut faire apparaître de nouveaux enjeux de protection et d’organisation patrimoniale.",
    relevanceScore: 87,
    contactabilityStatus: ContactabilityStatus.CONTACTABLE,
    status: OpportunityStatus.PUBLISHED,
  },
  {
    id: "48000000-0000-4000-8000-000000000048",
    firmId: DEMO.beta.firmId,
    weeklyBatchId: BATCH_IDS.betaPublished,
    prospectId: prospectSeeds[7].id,
    title: "Création d’une structure d’exercice",
    signalType: "Structuration",
    signalSummary: "Immatriculation récente d’une société d’exercice libéral",
    whyNow:
      "La nouvelle structure peut nécessiter un accompagnement sur la rémunération, la prévoyance et l’épargne du praticien.",
    relevanceScore: 83,
    contactabilityStatus: ContactabilityStatus.PARTIALLY_VERIFIED,
    status: OpportunityStatus.PUBLISHED,
  },
] as const;

const contactDetailSeeds = [
  {
    id: "51000000-0000-4000-8000-000000000051",
    prospectId: prospectSeeds[0].id,
    type: ContactDetailType.PROFESSIONAL_EMAIL,
    value: "claire.martin@example.com",
    verificationStatus: VerificationStatus.VERIFIED,
    verificationMethod: "Vérification du domaine et contrôle manuel",
    verifiedAt: new Date("2026-07-19T14:00:00.000Z"),
    isPrimary: true,
  },
  {
    id: "52000000-0000-4000-8000-000000000052",
    prospectId: prospectSeeds[0].id,
    type: ContactDetailType.LINKEDIN,
    value: "https://www.linkedin.com/in/demo-claire-martin",
    verificationStatus: VerificationStatus.VERIFIED,
    verificationMethod: "Vérification manuelle du profil professionnel",
    verifiedAt: new Date("2026-07-19T14:10:00.000Z"),
    isPrimary: true,
  },
  {
    id: "53000000-0000-4000-8000-000000000053",
    prospectId: prospectSeeds[0].id,
    type: ContactDetailType.COMPANY_WEBSITE,
    value: "https://example.com/atelier-horizon",
    verificationStatus: VerificationStatus.VERIFIED,
    verificationMethod: "Site institutionnel",
    verifiedAt: new Date("2026-07-19T14:15:00.000Z"),
    isPrimary: true,
  },
  {
    id: "54000000-0000-4000-8000-000000000054",
    prospectId: prospectSeeds[0].id,
    type: ContactDetailType.PROFESSIONAL_PHONE,
    value: "+33 4 00 00 00 00",
    verificationStatus: VerificationStatus.INVALID,
    verificationMethod: "Numéro non attribué lors du contrôle",
    verifiedAt: new Date("2026-07-19T14:20:00.000Z"),
    isPrimary: false,
  },
  {
    id: "55000000-0000-4000-8000-000000000055",
    prospectId: prospectSeeds[1].id,
    type: ContactDetailType.PROFESSIONAL_EMAIL,
    value: "julien.robert@example.com",
    verificationStatus: VerificationStatus.LIKELY,
    verificationMethod: "Format professionnel et domaine actifs",
    verifiedAt: null,
    isPrimary: true,
  },
  {
    id: "56000000-0000-4000-8000-000000000056",
    prospectId: prospectSeeds[2].id,
    type: ContactDetailType.LINKEDIN,
    value: "https://www.linkedin.com/in/demo-sophie-bernard",
    verificationStatus: VerificationStatus.VERIFIED,
    verificationMethod: "Vérification manuelle du profil professionnel",
    verifiedAt: new Date("2026-07-18T10:00:00.000Z"),
    isPrimary: true,
  },
  {
    id: "57000000-0000-4000-8000-000000000057",
    prospectId: prospectSeeds[3].id,
    type: ContactDetailType.PROFESSIONAL_EMAIL,
    value: "nicolas.petit@example.com",
    verificationStatus: VerificationStatus.VERIFIED,
    verificationMethod: "Contrôle manuel",
    verifiedAt: new Date("2026-07-18T11:00:00.000Z"),
    isPrimary: true,
  },
  {
    id: "58000000-0000-4000-8000-000000000058",
    prospectId: prospectSeeds[5].id,
    type: ContactDetailType.PROFESSIONAL_EMAIL,
    value: "thomas.dubois@example.com",
    verificationStatus: VerificationStatus.VERIFIED,
    verificationMethod: "Contrôle du domaine professionnel",
    verifiedAt: new Date("2026-07-18T12:00:00.000Z"),
    isPrimary: true,
  },
  {
    id: "59000000-0000-4000-8000-000000000059",
    prospectId: prospectSeeds[6].id,
    type: ContactDetailType.LINKEDIN,
    value: "https://www.linkedin.com/in/demo-amandine-leroy",
    verificationStatus: VerificationStatus.VERIFIED,
    verificationMethod: "Vérification manuelle du profil professionnel",
    verifiedAt: new Date("2026-07-18T13:00:00.000Z"),
    isPrimary: true,
  },
  {
    id: "5a000000-0000-4000-8000-00000000005a",
    prospectId: prospectSeeds[7].id,
    type: ContactDetailType.PROFESSIONAL_EMAIL,
    value: "pierre.roux@example.com",
    verificationStatus: VerificationStatus.UNVERIFIED,
    verificationMethod: null,
    verifiedAt: null,
    isPrimary: true,
  },
] as const;

const signalSeeds = [
  {
    id: "61000000-0000-4000-8000-000000000061",
    prospectId: prospectSeeds[0].id,
    type: "Gouvernance",
    title: "Cession partielle annoncée",
    description:
      "Atelier Horizon a annoncé la cession de son activité logistique.",
    eventDate: new Date("2026-07-14T00:00:00.000Z"),
    detectedAt: new Date("2026-07-15T08:00:00.000Z"),
    sourceUrl: "https://example.com/actualites/atelier-horizon-cession",
    sourceName: "Journal économique de démonstration",
    sourcePublishedAt: new Date("2026-07-14T07:00:00.000Z"),
    verificationStatus: SignalVerificationStatus.VERIFIED,
    verifiedAt: new Date("2026-07-19T15:00:00.000Z"),
  },
  {
    id: "62000000-0000-4000-8000-000000000062",
    prospectId: prospectSeeds[0].id,
    type: "Gouvernance",
    title: "Nomination d’une direction opérationnelle",
    description:
      "Une nouvelle directrice des opérations a rejoint l’entreprise.",
    eventDate: new Date("2026-07-10T00:00:00.000Z"),
    detectedAt: new Date("2026-07-11T09:00:00.000Z"),
    sourceUrl: "https://example.com/entreprises/atelier-horizon-direction",
    sourceName: "Registre professionnel de démonstration",
    sourcePublishedAt: new Date("2026-07-10T11:00:00.000Z"),
    verificationStatus: SignalVerificationStatus.VERIFIED,
    verifiedAt: new Date("2026-07-19T15:10:00.000Z"),
  },
  {
    id: "63000000-0000-4000-8000-000000000063",
    prospectId: prospectSeeds[5].id,
    type: "Capital",
    title: "Ouverture minoritaire du capital",
    description:
      "Boréal Industrie a communiqué sur l’arrivée d’un partenaire minoritaire.",
    eventDate: new Date("2026-07-16T00:00:00.000Z"),
    detectedAt: new Date("2026-07-17T09:00:00.000Z"),
    sourceUrl: "https://example.com/actualites/boreal-industrie",
    sourceName: "Presse régionale de démonstration",
    sourcePublishedAt: new Date("2026-07-16T10:00:00.000Z"),
    verificationStatus: SignalVerificationStatus.VERIFIED,
    verifiedAt: new Date("2026-07-19T15:20:00.000Z"),
  },
] as const;

const opportunitySignalSeeds = [
  {
    opportunityId: opportunitySeeds[0].id,
    signalId: signalSeeds[0].id,
    isPrimary: true,
  },
  {
    opportunityId: opportunitySeeds[0].id,
    signalId: signalSeeds[1].id,
    isPrimary: false,
  },
  {
    opportunityId: opportunitySeeds[5].id,
    signalId: signalSeeds[2].id,
    isPrimary: true,
  },
] as const;

function requiredEnvironment(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`La variable ${name} est requise pour le seed.`);
  }
  return value;
}

async function ensureAuthUser(email: string, password: string) {
  const supabase = createClient(
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data: existing, error: listError } =
    await supabase.auth.admin.listUsers({ perPage: 1_000 });

  if (listError) {
    throw listError;
  }

  const match = existing.users.find((user) => user.email === email);
  if (match) {
    return match.id;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    throw error;
  }

  return data.user.id;
}

async function seedFirm(
  demo: (typeof DEMO)[keyof typeof DEMO],
  userId: string,
  city: string,
  department: string,
) {
  await prisma.user.upsert({
    where: { id: userId },
    update: { email: demo.email, emailConfirmedAt: new Date() },
    create: {
      id: userId,
      email: demo.email,
      emailConfirmedAt: new Date(),
    },
  });
  await prisma.firm.upsert({
    where: { id: demo.firmId },
    update: {
      name: demo.firmName,
      city,
      department,
      onboardingCompletedAt: new Date(),
    },
    create: {
      id: demo.firmId,
      name: demo.firmName,
      city,
      department,
      onboardingCompletedAt: new Date(),
    },
  });
  await prisma.firmMember.upsert({
    where: { userId },
    update: { firmId: demo.firmId, role: "owner" },
    create: { firmId: demo.firmId, userId, role: "owner" },
  });
  await prisma.firmPreference.upsert({
    where: { firmId: demo.firmId },
    update: {
      nationwide: false,
      prospectingDepartments: [department],
      targetProfiles: ["Dirigeants", "Professions libérales"],
    },
    create: {
      firmId: demo.firmId,
      nationwide: false,
      prospectingDepartments: [department],
      targetProfiles: ["Dirigeants", "Professions libérales"],
    },
  });
}

async function main() {
  const password = requiredEnvironment("DEMO_USER_PASSWORD");
  const [alphaUserId, betaUserId] = await Promise.all([
    ensureAuthUser(DEMO.alpha.email, password),
    ensureAuthUser(DEMO.beta.email, password),
  ]);

  await seedFirm(DEMO.alpha, alphaUserId, "Lyon", "69");
  await seedFirm(DEMO.beta, betaUserId, "Bordeaux", "33");

  const batches = [
    {
      id: BATCH_IDS.alphaPublished,
      firmId: DEMO.alpha.firmId,
      weekStart: new Date("2026-07-20T00:00:00.000Z"),
      weekEnd: new Date("2026-07-26T00:00:00.000Z"),
      status: WeeklyBatchStatus.PUBLISHED,
      publishedAt: new Date("2026-07-20T07:30:00.000Z"),
      summary:
        "Quatre signaux à fort potentiel identifiés dans votre zone de prospection.",
    },
    {
      id: BATCH_IDS.alphaDraft,
      firmId: DEMO.alpha.firmId,
      weekStart: new Date("2026-07-27T00:00:00.000Z"),
      weekEnd: new Date("2026-08-02T00:00:00.000Z"),
      status: WeeklyBatchStatus.DRAFT,
      publishedAt: null,
      summary: "Sélection en cours de qualification.",
    },
    {
      id: BATCH_IDS.betaPublished,
      firmId: DEMO.beta.firmId,
      weekStart: new Date("2026-07-20T00:00:00.000Z"),
      weekEnd: new Date("2026-07-26T00:00:00.000Z"),
      status: WeeklyBatchStatus.PUBLISHED,
      publishedAt: new Date("2026-07-20T08:00:00.000Z"),
      summary: "Sélection privée du cabinet Boréal.",
    },
    {
      id: BATCH_IDS.betaDraft,
      firmId: DEMO.beta.firmId,
      weekStart: new Date("2026-07-27T00:00:00.000Z"),
      weekEnd: new Date("2026-08-02T00:00:00.000Z"),
      status: WeeklyBatchStatus.DRAFT,
      publishedAt: null,
      summary: "Sélection suivante en préparation.",
    },
  ] as const;

  for (const batch of batches) {
    await prisma.weeklyBatch.upsert({
      where: { id: batch.id },
      update: batch,
      create: batch,
    });
  }

  for (const prospect of prospectSeeds) {
    await prisma.prospect.upsert({
      where: { id: prospect.id },
      update: {
        ...prospect,
        professionalProfileSummary:
          prospect.id === prospectSeeds[0].id
            ? "Dirigeante de PME industrielle, active dans le développement et la gouvernance de son entreprise."
            : null,
      },
      create: {
        ...prospect,
        professionalProfileSummary:
          prospect.id === prospectSeeds[0].id
            ? "Dirigeante de PME industrielle, active dans le développement et la gouvernance de son entreprise."
            : null,
      },
    });
  }

  for (const contactDetail of contactDetailSeeds) {
    await prisma.contactDetail.upsert({
      where: { id: contactDetail.id },
      update: contactDetail,
      create: contactDetail,
    });
  }

  for (const signal of signalSeeds) {
    await prisma.signal.upsert({
      where: { id: signal.id },
      update: signal,
      create: signal,
    });
  }

  for (const opportunity of opportunitySeeds) {
    const data = {
      ...opportunity,
      potentialNeeds:
        "potentialNeeds" in opportunity
          ? [...opportunity.potentialNeeds]
          : undefined,
    };
    await prisma.opportunity.upsert({
      where: { id: opportunity.id },
      update: data,
      create: data,
    });
  }

  for (const opportunitySignal of opportunitySignalSeeds) {
    await prisma.opportunitySignal.upsert({
      where: {
        opportunityId_signalId: {
          opportunityId: opportunitySignal.opportunityId,
          signalId: opportunitySignal.signalId,
        },
      },
      update: { isPrimary: opportunitySignal.isPrimary },
      create: opportunitySignal,
    });
  }

  console.info(
    `Seed terminé : ${DEMO.alpha.email} et ${DEMO.beta.email}. Données strictement fictives.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
