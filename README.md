# Affluo

Affluo est un moteur de prospection destiné aux conseillers en gestion de
patrimoine. Ce dépôt contient le socle du MVP, l’authentification, l’onboarding
du cabinet, la consultation sécurisée des sélections hebdomadaires et la fiche
prospect orientée décision. Il comprend également l’outil interne d’import CSV
et de qualification manuelle des opportunités, ainsi qu’un pipeline de
détection déterministe inspiré de Patrimoine Radar.

## Prérequis

- Node.js 20.9 ou supérieur
- npm 10 ou supérieur
- Un projet Supabase

## Installation locale

1. Installez les dépendances :

   ```bash
   npm install
   ```

2. Créez votre fichier d’environnement local :

   ```bash
   cp .env.example .env
   ```

   Renseignez au minimum `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `DATABASE_URL` et `DIRECT_URL` avec
   les valeurs du panneau **Connect** de votre projet Supabase. La clé
   `service_role` n’est nécessaire que pour le seed local optionnel décrit
   plus bas : elle n’est jamais lue par l’application. Ne commitez jamais
   `.env`.

3. Appliquez la migration Supabase :

   ```bash
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```

   Les migrations créent le modèle d’authentification et d’onboarding, le
   modèle minimal des sélections hebdomadaires, leurs politiques RLS et les
   garde-fous de publication. Elles peuvent également être exécutées dans
   l’ordre depuis le SQL Editor de Supabase.

4. Générez le client Prisma :

   ```bash
   npm run prisma:generate
   ```

5. Démarrez le serveur de développement :

   ```bash
   npm run dev
   ```

   Ouvrez ensuite [http://localhost:3000](http://localhost:3000).

## Données de démonstration

Le seed optionnel crée deux cabinets isolés, deux utilisateurs CGP, un
utilisateur administrateur et des lots publiés et brouillons. Toutes les
identités et coordonnées sont fictives
(`example.com` et profils LinkedIn explicitement marqués comme démo).
La première opportunité contient plusieurs sources, un email vérifié, un profil
LinkedIn contrôlé manuellement, des hypothèses patrimoniales et une coordonnée
invalide volontairement masquée.

1. Ajoutez uniquement dans votre `.env` local :

   ```text
   SUPABASE_SERVICE_ROLE_KEY=...
   DEMO_USER_PASSWORD=...
   ```

2. Exécutez :

   ```bash
   npm run db:seed
   ```

3. Connectez-vous avec `cgp.alpha@demo.affluo.local` ou
   `cgp.beta@demo.affluo.local` pour le parcours CGP, ou avec
   `admin@demo.affluo.local` pour l’espace interne. Utilisez le mot de passe
   choisi. Le seed est idempotent et peut être rejoué.

La clé `service_role` sert exclusivement à créer les deux comptes Auth depuis
le script local. Elle ne doit jamais être configurée comme variable publique,
embarquée dans Vercel ou commitée.

## Configuration Supabase Auth

Dans **Authentication > URL Configuration** :

- définissez `http://localhost:3000` comme Site URL en local ;
- ajoutez `http://localhost:3000/auth/callback` aux Redirect URLs ;
- ajoutez l’URL de production Vercel avec le même chemin.

Dans le template **Confirm signup**, utilisez une URL compatible SSR :

```text
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
```

Le parcours de récupération de mot de passe utilise
`/auth/callback?next=/reset-password` et ne nécessite pas de template
personnalisé supplémentaire.

## Commandes

| Commande                  | Usage                                        |
| ------------------------- | -------------------------------------------- |
| `npm run dev`             | Lance Next.js en développement               |
| `npm run build`           | Crée le build de production                  |
| `npm run lint`            | Exécute ESLint                               |
| `npm run format`          | Formate le dépôt avec Prettier               |
| `npm run format:check`    | Vérifie le formatage sans modifier           |
| `npm run typecheck`       | Vérifie TypeScript en mode strict            |
| `npm run test`            | Exécute les tests unitaires avec Vitest      |
| `npm run test:e2e`        | Exécute les tests navigateur avec Playwright |
| `npm run db:seed`         | Charge les données de démonstration locales  |
| `npm run prisma:generate` | Génère le client Prisma                      |
| `npm run prisma:validate` | Valide le schéma Prisma                      |

Avant le premier test end-to-end, installez Chromium :

```bash
npx playwright install chromium
```

Le scénario Playwright authentifié est exécuté lorsqu’un projet Supabase a été
migré et seedé, avec :

```bash
E2E_DEMO_USER_PASSWORD="<mot-de-passe-du-seed>" npm run test:e2e
```

Sans cette variable, le scénario de démonstration est ignoré ; les parcours
publics restent testés. Les tests d’intégration Prisma s’exécutent en CI contre
un PostgreSQL éphémère. En local, utilisez une base de test dédiée :

```bash
npx prisma db push --skip-generate
RUN_DATABASE_TESTS=true npm run test
```

## Architecture

- `src/app` : routes App Router et Server Components par défaut
- `src/components` : composants UI shadcn et composants partagés
- `src/modules` : modules fonctionnels isolés
- `src/lib` : accès aux données et utilitaires transverses
- `src/integrations` : adaptateurs vers les services externes
- `supabase/migrations` : schéma SQL, fonction d’onboarding et politiques RLS
- `src/jobs` : traitements asynchrones
- `src/tests` : tests unitaires, d’intégration et end-to-end
- `prisma` : schéma de données et futures migrations

L’authentification utilise Supabase Auth avec des cookies SSR. Les routes
`/dashboard` et `/onboarding` vérifient l’identité côté middleware puis à
nouveau dans les Server Components. Les politiques RLS limitent chaque lecture
et écriture au cabinet de l’utilisateur. Un utilisateur ne peut appartenir
qu’à un seul cabinet dans ce MVP.

Le wizard d’onboarding est le seul composant client significatif : il conserve
les réponses entre les trois écrans de saisie sans rechargement. Les pages
d’authentification, la sélection et le détail restent des Server Components.
La frontière d’erreur des opportunités est un composant client, car le bouton
de nouvelle tentative appelle le mécanisme `reset` de Next.js. Sur la fiche,
seuls le bouton de copie et le formulaire de décision sont clients : ils
nécessitent respectivement l’API du presse-papiers et un retour immédiat
pendant la mutation.

### Sélections hebdomadaires

Les données sont volontairement minimales :

- `weekly_batches` regroupe la sélection d’un cabinet pour une semaine ;
- `prospects` porte l’identité professionnelle et les canaux de contact ;
- `opportunities` associe un prospect, un lot et le cabinet destinataire.

Seul le dernier lot `PUBLISHED` du cabinet connecté est lu. Une opportunité
doit elle-même être `PUBLISHED`, contactable et rattachée au même cabinet. Les
brouillons, les contacts non exploitables et les lots d’un autre tenant sont
exclus côté requête serveur et côté RLS. Les pages consomment des DTO explicites
et ne reçoivent jamais les enregistrements Prisma complets.

Le remplissage métier des lots reste manuel à ce stade, via SQL, Prisma Studio
ou un traitement interne futur. Aucun scoring, enrichissement, CRM ou appel à
un service externe n’est implémenté.

### Fiche prospect et décision

La fiche `/dashboard/opportunities/[opportunityId]` sépare explicitement :

- les **faits vérifiés**, issus de l’identité professionnelle, des coordonnées
  valides et des signaux sourcés ;
- les **estimations Affluo**, limitées à la confiance et à la contactabilité ;
- les **hypothèses**, toujours accompagnées d’une mention précisant qu’elles
  ne décrivent pas une situation personnelle confirmée.

Le modèle ajoute :

- `signals` et `opportunity_signals` pour rattacher une ou plusieurs sources à
  une opportunité ;
- `contact_details` pour les coordonnées multiples et leur vérification ;
- `opportunity_feedback` pour une décision commerciale minimale et modifiable.

La décision n’est ni une tâche, ni une interaction CRM. Une seule valeur
courante est conservée par opportunité et cabinet : `TO_CONTACT`,
`TO_MONITOR` ou `NOT_RELEVANT`.

### Import CSV et qualification interne

L’espace `/admin` est réservé aux utilisateurs dont le rôle applicatif est
`ADMIN`. Il permet de prévisualiser un CSV, de résoudre explicitement les
doublons, de lancer un import relançable et de qualifier les opportunités
créées. Le modèle attendu peut être téléchargé depuis l’écran d’import ; une
fixture plus complète est disponible dans
`fixtures/imports/affluo-demo-import.csv`.

Le parseur accepte les fichiers UTF-8 séparés par une virgule ou un
point-virgule, dans la limite de `CSV_IMPORT_MAX_BYTES` et
`CSV_IMPORT_MAX_ROWS`. Chaque valeur brute est conservée séparément de sa
version normalisée. Les erreurs sont rattachées à une ligne et un champ, puis
exportables en CSV. Les cellules exportées qui commencent comme une formule de
tableur sont neutralisées.

La détection des doublons suit deux niveaux :

- correspondance forte sur l’email, le téléphone ou l’URL LinkedIn normalisés ;
- correspondance secondaire sur l’identité, complétée par l’entreprise, son
  domaine, la localisation ou la fonction.

Un nom seul ne déclenche jamais de fusion. L’administrateur doit choisir entre
ignorer la ligne, mettre à jour le prospect identifié ou créer une identité
distincte. L’import traite chaque ligne dans une transaction et mémorise son
état ; le relancer ne recrée pas les lignes déjà importées.

Les opportunités entrent sans cabinet ni lot, avec les statuts `DRAFT` et
`TO_REVIEW`. L’écran de revue permet les corrections, la prise en charge, le
renvoi en correction, l’approbation ou le rejet motivé. Une approbation ne
publie et n’assigne jamais l’opportunité. Elle exige une source exploitable et
au moins une coordonnée professionnelle utilisable. Une URL LinkedIn importée
n’est jamais considérée comme vérifiée automatiquement : la validation
manuelle enregistre l’administrateur, la date et la méthode.

Toutes les mutations d’administration revérifient le rôle côté serveur. Les
changements sensibles produisent un journal d’audit avant/après. Le seul
composant client ajouté pour ce parcours affiche localement le nom et la taille
du fichier sélectionné ; le parsing, les droits et l’écriture restent côté
serveur.

### Patrimoine Radar

L’audit du moteur concierge existant et les décisions de migration sont
documentés dans
[`docs/patrimoine-radar-migration.md`](docs/patrimoine-radar-migration.md).
Le moteur observé utilisait principalement des annonces BODACC sélectionnées
et enrichies manuellement. Les collecteurs Reddit/Apify historiques ne sont pas
repris, car ils validaient le marché mais ne détectaient pas d’événements
patrimoniaux.

Le pipeline Affluo sépare explicitement :

```text
source → document → extraction factuelle → entreprise → prospect
       → qualification → déduplication → brouillon → revue humaine
```

La première source réelle utilise l’API publique BODACC de la DILA et se limite
aux ventes et cessions. Elle ne crée un prospect que lorsqu’une personne
physique est explicitement identifiée comme ancien propriétaire. Les documents
ambigus sont conservés avec un motif d’exclusion. Pappers, LinkedIn et les
annuaires observés dans l’ancien moteur ne sont pas collectés automatiquement.

Les faits sont stockés dans le signal et reliés au document source. `whyNow`,
`potentialNeeds` et `qualificationSummary` sont générés séparément et commencent
par une formulation d’hypothèse. Un score automatique sert uniquement à
prioriser la revue ; il ne prouve ni patrimoine, ni liquidité reçue, ni besoin
de conseil.

Chaque opportunité automatisée possède :

```text
status = DRAFT
reviewStatus = TO_REVIEW
origin = AUTOMATED_DETECTION
firmId = null
weeklyBatchId = null
```

Les documents sont dédupliqués par identifiant externe, URL et empreinte. Les
sociétés sont rapprochées en priorité par SIREN, SIRET ou domaine ; un nom seul
ne suffit jamais. Les exécutions et chaque document possèdent un statut, un
nombre de tentatives, un délai progressif et des motifs explicites. Une
contrainte PostgreSQL empêche deux exécutions simultanées d’une même source.

#### Activation

Le moteur, le planificateur et toutes les sources sont désactivés par défaut.
Pour tester uniquement la source fictive :

```dotenv
DETECTION_ENABLED=true
DETECTION_SOURCE_BODACC_DEMO_ENABLED=true
```

Pour activer explicitement la collecte réelle BODACC :

```dotenv
DETECTION_ENABLED=true
DETECTION_SOURCE_BODACC_ENABLED=true
DETECTION_SOURCE_BODACC_INTERVAL_MINUTES=1440
```

L’espace `/admin/detection` permet le lancement manuel et affiche les
documents, signaux, exclusions et erreurs. La source de démonstration
`BODACC_DEMO` ne doit être activée que pour les tests.

Le cron Vercel appelle quotidiennement `/api/jobs/detection`. En production,
configurez une valeur aléatoire longue dans `CRON_SECRET`, puis activez :

```dotenv
DETECTION_SCHEDULER_ENABLED=true
```

Le planificateur respecte ensuite la fréquence de chaque source et reprend en
priorité les documents dont le délai de nouvelle tentative est arrivé à
échéance.

Une interface `SignalExtractionProvider` et un schéma Zod préparent un éventuel
fournisseur LLM. Aucun fournisseur n’est implémenté ou appelé dans ce ticket.
`DETECTION_LLM_ENABLED` reste désactivé.

### Règles de sécurité de la fiche

Le cabinet et l’utilisateur proviennent exclusivement de la session Supabase.
Le client ne transmet jamais de `firmId`. Chaque lecture et mutation exige
simultanément l’identifiant de l’opportunité, le cabinet courant, le statut
`PUBLISHED` de l’opportunité et celui de son lot. Une opportunité inaccessible
retourne `404`, sans indiquer si elle existe dans un autre cabinet.

Les mêmes relations sont vérifiées par les contraintes SQL et les politiques
RLS pour les signaux, coordonnées, sources et décisions. Les coordonnées
`INVALID`, les signaux `REJECTED` et les URL autres que HTTP(S) sont exclus du
DTO avant rendu. Les erreurs côté utilisateur restent génériques et n’exposent
ni requête, ni erreur Prisma, ni identifiant d’un autre tenant.

L’import et la détection ne publient aucune donnée, n’assignent aucun cabinet
et ne déclenchent ni CRM ni enrichissement. Les intégrations OpenAI, Resend et
Stripe restent hors scope et ne sont jamais appelées.

## Déploiement

Le projet est compatible avec Vercel. Configurez les variables documentées
dans `.env.example`, l’URL de production dans Supabase Auth et exécutez la
migration avant le premier déploiement.
