# Boss workspace

Ce dépôt contient une CLI Astro « astro-bp-cli » et l’espace pour vos projets Astro. Toute la documentation est centralisée ici.

## Structure du workspace

```text
boss/
├── astro-bp-cli/        # CLI Node ESM pour créer/booster un projet Astro
└── examples/            # Vos projets Astro d’essai (ignorés par Git)
```

Note: Placez vos projets d’essai dans `boss/examples/` pour éviter de les pousser par erreur (le dossier est ignoré par Git). Si vous voulez versionner un exemple, renommez-le et sortez-le de `examples/`.

## astro-bp-cli — la CLI

CLI minimaliste mais puissante pour démarrer un projet Astro et y ajouter des intégrations (DB, Auth, email, icônes, etc.). Deux modes:

- Realtime: guidage étape par étape, exécution immédiate à chaque choix.
- Fast: collecte d’abord tous les choix, affiche un résumé coloré exact (fichiers, package.json, .env, schéma DB, commandes), puis exécute tout d’un coup.

### Installation locale de la CLI

```powershell
# Depuis le dossier du projet CLI
cd c:\Users\Utilisateur\documents\boss\astro-bp-cli
npm install
```

### Lancer la CLI (depuis le dossier parent cible)

```powershell
# Se placer dans le dossier parent où créer le nouveau projet Astro
cd c:\Users\Utilisateur\documents\boss
node .\astro-bp-cli\bin\astro-bp.mjs
```

La CLI refuse d’être lancée depuis son propre dossier; elle doit être exécutée depuis le parent du futur projet créé. Elle vous demandera:

- le nom du projet (validation simple, évite CON/PRN/etc.)
- le gestionnaire de paquets (npm ou pnpm; pnpm préféré si présent)

Puis elle lance l’assistant officiel:

```powershell
<pm> create astro@latest <mon-projet>
```

Les réponses initiales sont mémorisées dans `.cache/answers.json`, et les préférences récentes dans `.cache/prefs.json`.

### Modes et fonctionnalités clés

- Scaffolding: délègue à `create astro@latest` (Fast: template minimal + installs différés).
- Intégrations supplémentaires:
  - astro-font (package tiers)
  - astro-icon via `astro add astro-icon` (+ sets Iconify `@iconify-json/*`)
- Base de données: DEV/LOCAL + adapter (Prisma/Drizzle). Drivers: pg/mysql2 selon choix.
- Auth:
  - Better Auth (plugins: admin, organization, username, twoFactor, bearer, anonymous, openAPI, sso, stripe, polar, dub, expo)
  - Email: Nodemailer (SMTP) ou Resend
  - Supabase Auth (gating selon DB)
- .env et .env.example: blocs nommés (db, better_auth, email(...), supabase_auth), placeholders si secrets non saisis.
- Aliases TypeScript/JS: `@src`, `@lib`, `@components`, `@layouts`.
- Résumé Fast immersif (terminal):
  - Arbre de fichiers (+ créé, ~ modifié)
  - package.json installé (vraies versions) et prévisualisation groupée (sans versions) avec badges `// via astro add`
  - Clés .env par sections
  - Aperçu schéma DB (Prisma/Drizzle)
  - Commandes exactes (install groupé + CLI)
- README auto: injection d’un récap identique dans le README du projet créé.

### Légende (terminal et README)

- Couleurs (terminal):
  - 🟩 astro (librairies Astro et intégrations officielles)
  - 🟨 design (Iconify sets, etc.)
  - 🟦 db (drivers/adapters)
  - 🟥 auth (Better Auth, email, etc.)
- Fichiers: `+` créé, `~` modifié
- Prévisualisation package: "*" = version non figée (vue de synthèse)
- Badge `// via astro add` = dépendance ajoutée par la commande « astro add … »

### Variables d’environnement

- `.env` reçoit les valeurs réelles si vous les saisissez; `.env.example` garde uniquement des placeholders (`__REPLACE_ME__`).
- Sections gérées et réécrites proprement entre exécutions:
  - db: `DATABASE_URL_DEV`, `DATABASE_URL_LOCAL`, `DATABASE_URL`
  - better_auth: `BETTER_AUTH_*`, plus clés OAuth/Stripe/Polar si choisies
  - email(nodemailer): `SMTP_*` | email(resend): `RESEND_*`
  - supabase_auth: `SUPABASE_*`

### Tips Windows / exécution silencieuse

```powershell
$env:ASTRO_BP_SILENT = "1"; node .\astro-bp-cli\bin\astro-bp.mjs
```

Les appels interactifs (`create astro@latest`, `astro add`) masquent déjà l’écho; la variable ci-dessus force un silence global si besoin.

## Référence du code (fichiers et responsabilités)

Chemins sous `astro-bp-cli/`.

### Entrée

- `bin/astro-bp.mjs`
  - Rôle: orchestrateur principal. Vérifie que vous n’êtes pas dans le dossier de la CLI, pose les questions de mode (Realtime/Fast), appelle les steps, exécute les installs/commandes planifiées, met à jour le README du projet.
  - Entrées: environnement (détection pnpm), réponses précédentes (`.cache/prefs.json`), choix utilisateur.
  - Sorties: projet scaffoldé, dépendances installées, fichiers générés, `.env`/`.env.example` mis à jour, aliases, README enrichi.
  - Spécificités:
    - Fast: exécute `setupExtras`/`configureBetterAuth` en `dryRun` pour générer les fichiers sans installer, calcule un plan via `computePlanCommands`, installe en groupe, puis exécute les CLI (ex: `astro add`, `prisma generate`).
    - Realtime: applique chaque étape immédiatement et génère le README à la fin.

### Steps (`src/steps/*`)

- `scaffold.js`
  - Lance `create astro@latest`. En mode Fast, utilise un template minimal et évite les installs Git/Node intermédiaires.
  - Retourne `{ projectName, pm, projectPath }`.

- `extras.js` (setupExtras)
  - Propose/présélectionne des intégrations design: `astro-font` (package), `astro-icon` (via `astro add`) + sets Iconify.
  - Options: `preselectExtras`, `preselectIconSets`, `dryRun` (ne fait pas d’install/`astro add`).
  - Sortie: `{ extras, iconSets }` effectifs (après dry-run ou exécution).

- `dbAuth.js` (chooseDbAndAuth)
  - Collecte DB DEV/LOCAL (sqlite, postgres, neon, mysql, planetscale, supabase, etc.) et provider d’auth (better-auth | supabase | none).
  - Gère des règles de compatibilité (gating). Retourne `{ same, devDb, localDb, auth }`.

- `betterAuth.js` (configureBetterAuth)
  - Génère le setup Better Auth (serveur/client/middleware, typings env) selon plugins/email.
  - Options: `preset` (plugins/email), `dryRun` (génère les fichiers mais diffère installations et `prisma generate`).
  - Met à jour le plan d’install (adapters, @prisma/client/drizzle, plugins/email providers) sans installer en Fast.

- `envFiles.js` (writeEnvFiles)
  - Écrit `.env` et `.env.example` avec des blocs nommés idempotents via `upsertEnvBlock`.
  - `nonInteractive`: tout en placeholders (utile en Fast); `.env.example` toujours en placeholders.

- `aliases.js` (ensureAliases)
  - Ajoute les imports alias (`@src`, `@lib`, `@components`, `@layouts`) aux configs (ts/js) du projet.

- `persist.js` (persist)
  - Sauvegarde un résumé d’exécution et les préférences dans `.cache/prefs.json` pour précocher les prochains runs.

- `fastMode.js` (collectFastChoices)
  - Collecte toutes les options en une fois pour Fast et retourne un objet `plan` cohérent.

- `review.js`
  - `computePlanCommands(plan)`: renvoie `{ runtime: string[], dev: string[], cli: string[] }` (installations groupées + commandes exactes).
  - `reviewAndConfirm(plan)`: rendu immersif (couleurs, arbre de fichiers, package preview avec badges, clés .env, schéma DB, commandes) puis confirmation.

- `readme.js` (updateReadme)
  - Injecte une section bornée dans le README du projet créé avec:
    - Quick Stack + légende
    - package.json (installé) — seulement `dependencies`/`devDependencies` avec versions réelles
    - Prévisualisation groupée (sans versions) + badges `// via astro add`
    - Sections .env
    - Design (extras + icon sets)
    - Arbres `src/components`, `src/lib`, `src/pages/api`
    - Prévisualisation schéma DB
    - Commandes exécutées (installs groupés + CLI)

### Utils (`src/utils/*`)

- `cmd.js`
  - `runCmd(title, cmd, cwd, { echo? })`: exécute une commande shell; masque l’écho pour les wizards interactifs par défaut; respect de `ASTRO_BP_SILENT`.
  - `hasPnpm()`: détecte pnpm.

- `env.js`
  - `upsertEnvBlock(file, name, lines)`: ajoute/remplace un bloc nommé dans `.env`/`.env.example`.
  - `removeEnvBlock(file, name)`: supprime un bloc nommé.

- `json.js`
  - `readJSONSafe(path)`, `writeJSONSafe(path, data)`: lecture/écriture tolérante avec création de dossier.

## Projets Astro (où les mettre ?)

Placez vos projets d’exemple/démo dans `boss/` à côté de `astro-bp-cli/` (non listés ici pour garder le README concis). Exemple:

```text
boss/
├── astro-bp-cli/
├── mon-projet-astro-1/
└── mon-projet-astro-2/
```

Commandes usuelles dans un projet Astro:

```powershell
pnpm install
pnpm dev
pnpm build
pnpm preview
```

> Par défaut, le dev server écoute sur <http://localhost:4321>

## Problèmes connus / Tips Windows

- Si `pnpm` n’est pas détecté, la CLI propose `npm`. Installez `pnpm` si vous le préférez.
- Sur PowerShell, enchaînez des commandes avec `;` si nécessaire.
- Les appels interactifs (`create astro@latest`, `astro add`) masquent l’écho des commandes; vous pouvez forcer le silence global via `ASTRO_BP_SILENT`.

## Déploiement (simple via astro add)

Dans un projet généré, ajoutez l’adapter de votre cible avec l’outil officiel Astro, puis déployez selon la plateforme.

Vercel

```powershell
# Dans le dossier du projet créé
pnpm dlx astro add vercel
# ou
npx astro add vercel
```

Netlify

```powershell
pnpm dlx astro add netlify
# ou
npx astro add netlify
```

Node / VPS (mode serveur Node)

```powershell
pnpm dlx astro add node
# ou
npx astro add node
```

Docker (VPS): un `Dockerfile` multi‑stage sera ajouté prochainement. En attendant, vous pouvez générer un build Node (`astro add node`) puis dockeriser l’output.

## Roadmap

- Flags CLI: `--fast`, `--yes`, `--no-memory`
- Grouping colorisé côté terminal pour la preview package
- Patch idempotent de `src/auth.ts` quand ajout/suppression de plugins après coup

## Licence

Ce workspace est destiné à l’expérimentation et aux démos. Adaptez selon vos besoins.
