import { DetectionSignalType } from "@prisma/client";

import type {
  PatrimonialHypotheses,
  SignalCandidate,
} from "@/modules/detection/types";

export function patrimonialHypotheses(
  candidate: SignalCandidate,
): PatrimonialHypotheses {
  if (
    candidate.type === DetectionSignalType.COMPANY_SALE ||
    candidate.type === DetectionSignalType.BUSINESS_TRANSFER
  ) {
    return {
      potentialNeeds: [
        "diversification",
        "transmission",
        "réorganisation patrimoniale",
      ],
      whyNow:
        "Hypothèse Affluo : cette transition professionnelle récente peut rendre utile un échange sur l’organisation de la suite, sans présumer d’un prix net reçu personnellement.",
      qualificationSummary:
        "Hypothèse à vérifier : une cession publique peut ouvrir une période de réflexion sur de futurs projets, la diversification ou la transmission. Aucun besoin personnel n’est confirmé.",
    };
  }
  return {
    potentialNeeds: ["réorganisation patrimoniale"],
    whyNow:
      "Hypothèse Affluo : cet événement professionnel récent peut justifier un échange exploratoire, sans déduire la situation patrimoniale de la personne.",
    qualificationSummary:
      "Hypothèse à vérifier pendant la revue humaine ; le signal public ne confirme aucun besoin patrimonial personnel.",
  };
}
