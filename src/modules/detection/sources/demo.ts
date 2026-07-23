import type {
  CollectedDocument,
  CollectionContext,
  ProspectSource,
} from "@/modules/detection/types";

function demoRecord(publishedAt: Date) {
  const date = publishedAt.toISOString().slice(0, 10);
  return {
    id: "DEMO-BODACC-AFFLUO-001",
    dateparution: date,
    familleavis: "vente",
    familleavis_lib: "Ventes et cessions",
    commercant: "ATELIER HORIZON DÉMO",
    ville: "Nantes",
    numerodepartement: "44",
    registre: ["901234567", "901 234 567"],
    listepersonnes: JSON.stringify({
      personne: {
        typePersonne: "pm",
        denomination: "ATELIER HORIZON DÉMO",
        formeJuridique: "Société par actions simplifiée",
        numeroImmatriculation: {
          numeroIdentification: "901 234 567",
        },
      },
    }),
    listeprecedentproprietaire: JSON.stringify({
      personne: {
        typePersonne: "pp",
        nom: "Lefèvre",
        prenom: "Camille",
        numeroImmatriculation: {
          numeroIdentification: "812 345 678",
        },
      },
    }),
    acte: JSON.stringify({
      descriptif:
        "Cession publique du fonds exploité à Nantes par Camille Lefèvre.",
      vente: {
        categorieVente: "Achat d’un fonds par une personne morale",
        dateEffet: date,
        prix: 240000,
      },
    }),
    url_complete:
      "https://www.bodacc.fr/pages/annonces-commerciales-detail/?q.id=id:DEMO-BODACC-AFFLUO-001",
    demoContact: {
      professionalEmail: "camille.lefevre@atelier-horizon.example",
      linkedinUrl: "https://www.linkedin.com/in/camille-lefevre-demo",
      sourceUrl: "https://atelier-horizon.example/equipe/camille-lefevre",
    },
  };
}

export class BodaccDemoSource implements ProspectSource {
  readonly key = "BODACC_DEMO";
  readonly label = "BODACC — source simulée";

  async collect(context: CollectionContext): Promise<CollectedDocument[]> {
    const publishedAt = new Date();
    publishedAt.setUTCDate(publishedAt.getUTCDate() - 7);
    const record = demoRecord(publishedAt);

    return [
      {
        sourceKey: this.key,
        externalId: record.id,
        title: "Vente ou cession — Atelier Horizon Démo",
        content: JSON.stringify(record),
        sourceUrl: record.url_complete,
        publishedAt,
        collectedAt: new Date(),
        metadata: {
          demo: true,
          detectionRunId: context.detectionRunId,
          department: "44",
        },
      },
    ];
  }
}
