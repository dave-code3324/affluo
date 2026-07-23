# Affluo

Affluo est un moteur de prospection destiné aux conseillers en gestion de
patrimoine. Ce dépôt contient son socle technique, prêt à accueillir le MVP.

## Prérequis

- Node.js 20.9 ou supérieur
- npm 10 ou supérieur
- PostgreSQL local ou un projet Supabase (uniquement nécessaire pour les
  futures fonctionnalités qui utilisent la base)

## Installation locale

1. Installez les dépendances :

   ```bash
   npm install
   ```

2. Créez votre fichier d’environnement local :

   ```bash
   cp .env.example .env
   ```

   Les valeurs d’exemple suffisent pour afficher la page d’accueil. Remplacez
   uniquement les variables nécessaires aux services que vous utilisez. Ne
   commitez jamais `.env`.

3. Générez le client Prisma :

   ```bash
   npm run prisma:generate
   ```

4. Démarrez le serveur de développement :

   ```bash
   npm run dev
   ```

   Ouvrez ensuite [http://localhost:3000](http://localhost:3000).

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
- `src/jobs` : traitements asynchrones
- `src/tests` : tests unitaires, d’intégration et end-to-end
- `prisma` : schéma de données et futures migrations

Le socle n’effectue aucun appel réel à OpenAI, Resend, Stripe ou Supabase et
n’implémente ni authentification ni logique métier. La page d’accueil est un
Server Component ; aucun composant client n’est nécessaire à ce stade.

## Déploiement

Le projet est compatible avec Vercel. Configurez les variables documentées
dans `.env.example` dans les paramètres du projet avant d’activer les
fonctionnalités qui en dépendent. La base de données cible est PostgreSQL,
directement ou via Supabase.
