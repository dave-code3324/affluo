# Migration de Patrimoine Radar vers Affluo

## Périmètre de l’audit

Audit réalisé le 23 juillet 2026 sur le dépôt local
`dave-code3324/Insightadar`, dont le paquet se nomme `patrimoine-radar`. Le
dépôt était proprement identifiable par son historique Git, mais son arbre de
travail contenait des évolutions non commitées. L’analyse a donc distingué le
socle versionné et le flux concierge plus récent présent localement.

Fichiers principalement examinés :

- `README.md` et `report.md` ;
- `src/pilot/pilotGenerator.ts` ;
- `src/pilot/titleSaleGenerator.ts` ;
- `src/email/generatePatrimoineDigest.ts` ;
- `src/connectors/apifyReddit.ts` et `apifyRedditComments.ts` ;
- les manifestes et données structurées des lots pilote 001 à 004.

Le moteur actuel n’est pas un collecteur automatique BODACC. C’est un processus
concierge : des annonces sont recherchées et enrichies manuellement, puis des
générateurs déterministes valident un fichier CSV ou JSON et produisent des
fiches et digests.

## Fonctionnement observé

### Sources consultées

Le flux produit actuel s’appuie principalement sur :

1. le BODACC pour les annonces de ventes et cessions ;
2. Pappers pour rapprocher une personne et une entreprise ;
3. des sites professionnels ou annuaires sectoriels pour confirmer une
   activité ou une coordonnée professionnelle ;
4. LinkedIn, uniquement après une vérification humaine explicite.

Les collecteurs Reddit via Apify appartiennent à la validation initiale du
problème de prospection. Ils ne détectent pas d’événements patrimoniaux et ne
doivent pas être migrés dans le pipeline Affluo.

La DILA fournit désormais une
[API BODACC publique](https://www.data.gouv.fr/dataservices/api-bulletin-officiel-des-annonces-civiles-et-commerciales-bodacc/)
et documente le jeu
[BODACC sous Licence Ouverte 2.0](https://www.data.gouv.fr/datasets/bodacc).
La réutilisation doit néanmoins respecter les conditions de l’API, les
rectifications publiées par la DILA et les obligations liées aux données à
caractère personnel.

### Méthodes de collecte

- Les lots BODACC 002 à 004 sont constitués manuellement dans des fichiers CSV
  ou JSON.
- Les commandes `pilot:generate:*` et `patrimoine:email` relisent ces fichiers ;
  elles ne recherchent pas de nouvelles annonces.
- Le module historique Apify lance des Actors distants séquentiellement, écrit
  des fichiers JSON et nécessite un token.
- Il n’existe ni curseur BODACC, ni planificateur, ni reprise par document.

### Signaux et règles

Le premier générateur reconnaît plusieurs libellés génériques : cession ou
apport de titres, création de holding, changement d’actionnariat, fusion,
transmission, distribution exceptionnelle, vente de filiale et départ d’un
dirigeant actionnaire.

Le second lot resserre volontairement la promesse sur les cessions de titres :

- opération réalisée ;
- date documentée ;
- cession de titres, et non simple vente d’actifs ;
- personne explicitement reliée à la cession ;
- véhicule de détention identifié ;
- seuil déterministe de 75/100.

Les lots 003 et 004 utilisent un cas plus directement observable dans les
annonces BODACC : la vente ou cession d’un fonds par une personne physique
nommée. Le digest retient une annonce publiée depuis quatre mois au plus, un
prix publié d’au moins 30 000 euros et une coordonnée professionnelle jugée
exploitable. Le prix reste celui de l’opération ou du fonds ; il ne prouve
jamais un montant net reçu personnellement.

### Entreprises, dirigeants et contacts

L’entreprise, le cédant, l’activité, le prix et la localisation sont saisis à
partir des annonces et contrôlés manuellement. Pappers et les sites
professionnels servent d’éléments complémentaires, mais aucun rapprochement
automatique par SIREN ou SIRET n’existe.

Le prospect n’est conservé que lorsque la personne physique est explicitement
nommée. Les statuts de contact différencient une adresse publiée, probable ou
absente. Un profil LinkedIn direct doit utiliser HTTPS, le domaine
`linkedin.com` et un chemin `/in/`. Les recherches LinkedIn sont validées dans
une interface humaine ; aucun scraping ni appel LinkedIn n’est présent.

### Déduplication, exécution et dépendances

- Les identifiants sont vérifiés à l’intérieur d’un fichier JSON.
- Il n’existe pas de déduplication persistante entre deux lots.
- Les générations sont lancées manuellement avec npm.
- Les écritures JSON utilisent un renommage de fichier temporaire, mais il
  n’existe pas de journal d’exécution ni de reprise transactionnelle.
- Les dépendances actives sont `dotenv`, `nodemailer`, les API Apify historiques
  et la CLI Vercel pour les pages statiques.
- Aucun LLM n’est utilisé.

## Décisions de migration

### Réutilisé conceptuellement

- le BODACC comme première source ;
- la séparation stricte entre fait public et hypothèse patrimoniale ;
- les fenêtres de récence et le score déterministe comme outil de priorité ;
- l’exigence d’une personne explicitement liée à l’événement ;
- l’interdiction de présenter un prix de cession comme une liquidité
  personnelle ;
- la vérification LinkedIn exclusivement humaine.

### Adapté

- les règles du digest deviennent une qualification automatique explicable ;
- les statuts de contacts sont alignés sur les enums Affluo ;
- les documents, exécutions et décisions sont persistés dans PostgreSQL ;
- les opportunités rejoignent la file de qualification du Ticket 5 au lieu
  d’être transformées en pages ou emails ;
- la collecte BODACC utilise un adaptateur isolé, limité et désactivé par
  défaut.

### Réécrit

- collecte, curseur temporel et stockage des annonces ;
- extraction déterministe des structures JSON BODACC ;
- rapprochement SIREN/SIRET/domaine ;
- déduplication documents, sociétés, prospects, signaux et opportunités ;
- idempotence, reprise, journal d’exécution et logs structurés ;
- administration et lancement manuel.

### Non conservé

- collecte Reddit/Apify, sans rapport avec la détection de prospects ;
- génération de messages et envoi SMTP ;
- pages statiques publiques contenant des fiches prospects ;
- affectation directe à des CGP ;
- enrichissement manuel non sourcé ou inférence de coordonnées ;
- toute automatisation LinkedIn.

## Limites assumées de la première migration

L’API BODACC permet de reproduire la collecte de la source cœur, mais elle ne
fournit pas systématiquement un dirigeant ou cédant personne physique
exploitable. La première version ignore donc les documents ambigus et ne crée
un prospect que lorsque l’annonce relie explicitement une personne physique à
l’ancien propriétaire ou à l’événement.

Pappers et les annuaires observés dans Patrimoine Radar ne sont pas collectés
automatiquement : aucun contrat, quota ou droit de réutilisation automatisée
n’a été fourni. Ils restent des sources de vérification humaine.

Le pipeline possède une interface de fournisseur d’extraction et un schéma de
sortie validé par Zod, mais aucun LLM n’est appelé. Le mode déterministe reste
le seul mode actif. La collecte automatique, le planificateur et chaque source
sont désactivés par feature flag tant qu’ils ne sont pas explicitement
configurés.
