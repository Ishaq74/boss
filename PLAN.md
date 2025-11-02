# Feature Roadmap (centré produit)

Date: 2025-11-02
Repo: <https://github.com/Ishaq74/boss/>

## Vision produit

Une CLI Astro qui, en moins de 2 minutes, génère un projet prêt à coder et prêt à déployer, avec:

- Intégrations design (icônes, fonts), DB/ORM, Auth, email
- Gestion .env robuste (blocs nommés, placeholders par défaut)
- Résumé immersif et README auto fidèles à l’exécution
- Choix du mode (Realtime ou Fast)
- Déploiement clé-en-main (Vercel, Netlify, Node/VPS, Docker)

## Cœur de valeur (contrat rapide)

- Entrées: nom projet, package manager, extras, DB (dev/local + adapter), Auth (provider + plugins), email provider, sets d’icônes, cible de déploiement
- Sorties: projet Astro fonctionnel, fichiers générés/modifiés, deps installées, `.env`/`.env.example` écrits, README enrichi, scripts de déploiement et/ou fichiers de config selon la cible
- Erreurs: installations échouées, conflits de fichiers, secrets manquants (guidage), réseau indisponible

## Roadmap par paliers

P0 Déploiement minimal viables (DV)

- [ ] Vercel (adapter + config)
  - Ajouter `@astrojs/vercel` (adapter) et générer `vercel.json` minimal si utile
  - Ajouter un job GitHub Actions d’intégration (build) + docs « vercel deploy » (CLI) ou lien import UI
  - Critères: `pnpm build` OK, déploiement en moins de 2 min avec variables .env documentées
- [ ] Netlify (adapter + config)
  - Ajouter `@astrojs/netlify` (adapter) + `netlify.toml`
  - Docs `netlify deploy` (CLI) + job d’intégration (build)
  - Critères: build et deploy sans modification manuelle (hors secrets)
- [ ] Node/VPS (adapter node + process manager)
  - Ajouter `@astrojs/node` (output: server) + scripts `start`/`build` dédiés
  - Générer un `Dockerfile` (voir ci-dessous) et docs PM2/systemd (Windows: NSSM/Service)
  - Critères: démarrage en local et sur VPS reproductible
- [ ] Docker (unifié)
  - Générer `Dockerfile` multi-stage + `.dockerignore`
  - Scripts `docker build`/`run` + README section « Docker »
  - Critères: image buildable localement; variables .env passables à runtime

P1 Provisionning & CI/CD

- [ ] Provision DB (optionnel, guidé)
- Neon (postgres): création base + URL; Supabase: projet + clés; PlanetScale: DB + branch
- Stockage des secrets côté plateforme (Vercel/Netlify/GitHub Actions) et local `.env`
- Critères: une base + URL en < 1 min (si API/CLI dispo), doc claire
- [ ] CI/CD GitHub Actions
  - Matrice Node 18/20, cache pnpm, lint + build + tests smoke
  - Déploiement: Vercel/Netlify via actions officielles ou CLI
  - Critères: pipeline passe de bout en bout; logs clairs

P2 — DX avancée

- [ ] Flags CLI: `--fast`, `--yes`, `--no-memory`, `--deploy=<target>`
- [ ] Secrets: sync plateforme (e.g. `vercel env pull/push`), guide Doppler/1Password
- [ ] Monorepo (optionnel): support basique (workspaces), docs
- [ ] Tests unitaires ciblés (env/json/computePlanCommands), snapshot du README généré

## Déploiement — spécifications

Contrat (pour chaque cible):

- Inputs: target (vercel|netlify|node|docker), env keys (connues), options (région, output mode)
- Générations:
  - Vercel: adapter `@astrojs/vercel`, `vercel.json` (si besoin), README section, commandes
  - Netlify: adapter `@astrojs/netlify`, `netlify.toml`, README section, commandes
  - Node/VPS: adapter `@astrojs/node` (output:server), scripts `build`/`start`, README Node/PM2/systemd
  - Docker: `Dockerfile` multi-stage, `.dockerignore`, README Docker
- CI: job « build » par défaut; jobs deploy (paramétrés si token/secret dispo)
- Erreurs gérées: secrets manquants (messages), adapter incompatible (fallback), réseau/CLI absent (instructions)

Edge cases:

- Secrets non renseignés: utiliser placeholders + doc pour plateforme cible
- Conflits d’adapters: demander à l’utilisateur ou remplacer proprement
- Plateformes non installées (vercel/netlify CLI absentes): basculer vers guide UI

## .env & Secrets — exigences

- Blocs nommés idempotents: db, better_auth, email(...), supabase_auth
- Placeholders par défaut; option d’entrée immédiate masquée (non-stockée)
- Documentation auto dans README + rappel spécifique par cible (où mettre les secrets)
- (P1) Sync de secrets vers plateforme (facultatif, opt-in)

## DB & Auth — exigences

- DB: sqlite/postgres/neon/mysql/planetscale/supabase; adapters prisma/drizzle
- Auth: better-auth (plugins), supabase; email (nodemailer/resend)
- Préviews: schéma (prisma/drizzle); drivers ajoutés à l’install groupée

## UX & README — exigences

- Résumé terminal immersif (aligné 1:1 avec exécution) — déjà en place
- README auto: stack, deps installées (versions réelles), preview groupée, .env, design, arbres components/lib/api, schéma DB, commandes — déjà en place
- (P0 déploiement) Ajouter sections « Déployer sur Vercel/Netlify/Node/Docker » avec commandes

## Acceptation (Definition of Done)

- P0 DV: projets générés déployables sur Vercel, Netlify, Node/VPS et Docker avec doc + fichiers adaptés
- CI intégration (build) verte par défaut; README clair et exact
- Re-exécution de la CLI sur un projet généré reste idempotente (pas de cassure)

## Plan d’implémentation (ordre suggéré)

1) Adapters & fichiers de config par cible + README sections (Vercel/Netlify/Node/Docker)
2) Dockerfile + `.dockerignore` générés
3) Job GitHub Actions (lint + build) et docs deploy (actions/CLI)
4) (Optionnel) Provision DB guidé (Neon/Supabase/PlanetScale)
5) Flags CLI `--deploy`, `--yes`, `--no-memory` + aide `--help`

Dis-moi si tu valides cette roadmap orientée « features » (avec déploiement en priorité). Dès feu vert, j’attaque P0 Déploiement.
