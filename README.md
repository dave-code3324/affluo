# Affluo

Affluo est un moteur de prospection destiné aux conseillers en gestion de
patrimoine. Ce dépôt contient le socle du MVP, l’authentification, l’onboarding
du cabinet et la consultation sécurisée des sélections hebdomadaires.

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

Le seed optionnel crée deux cabinets isolés, leurs utilisateurs et des lots
publiés et brouillons. Toutes les identités et coordonnées sont fictives
(`example.com` et profils LinkedIn explicitement marqués comme démo).

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
   `cgp.beta@demo.affluo.local` et le mot de passe choisi. Le seed est
   idempotent et peut être rejoué.

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
de nouvelle tentative appelle le mécanisme `reset` de Next.js.

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

Les intégrations OpenAI, Resend et Stripe restent hors scope et ne sont jamais
appelées.

## Déploiement

Le projet est compatible avec Vercel. Configurez les variables documentées
dans `.env.example`, l’URL de production dans Supabase Auth et exécutez la
migration avant le premier déploiement.
