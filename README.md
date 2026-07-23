# Affluo

Affluo est un moteur de prospection destiné aux conseillers en gestion de
patrimoine. Ce dépôt contient le socle du MVP, l’authentification et
l’onboarding initial du cabinet.

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
   `service_role` n’est ni nécessaire ni utilisée. Ne commitez jamais `.env`.

3. Appliquez la migration Supabase :

   ```bash
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```

   La migration `supabase/migrations/202607230001_auth_onboarding.sql` crée les
   tables, les politiques RLS et la fonction atomique d’onboarding. Elle peut
   également être exécutée depuis le SQL Editor de Supabase.

4. Générez le client Prisma :

   ```bash
   npm run prisma:generate
   ```

5. Démarrez le serveur de développement :

   ```bash
   npm run dev
   ```

   Ouvrez ensuite [http://localhost:3000](http://localhost:3000).

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
| `npm run prisma:generate` | Génère le client Prisma                      |
| `npm run prisma:validate` | Valide le schéma Prisma                      |

Avant le premier test end-to-end, installez Chromium :

```bash
npx playwright install chromium
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
d’authentification et le dashboard restent des Server Components.

Les intégrations OpenAI, Resend et Stripe restent hors scope et ne sont jamais
appelées.

## Déploiement

Le projet est compatible avec Vercel. Configurez les variables documentées
dans `.env.example`, l’URL de production dans Supabase Auth et exécutez la
migration avant le premier déploiement.
