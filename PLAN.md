# Feature Roadmap (centré produit) — v0.2

Date: 2025-11-02
Repo: https://github.com/Ishaq74/boss

## Vision produit

Une CLI Astro qui, en <2 minutes, génère un projet prêt à coder et à déployer, avec:
- Intégrations design (icônes, fonts), DB/ORM, Auth, email
- Gestion .env robuste (blocs nommés, placeholders par défaut)
- Résumé immersif et README auto fidèles à l’exécution
- Choix du mode (Realtime ou Fast)
- Déploiement clé-en-main (Cloudflare, Vercel, Netlify, Node)

## État actuel (synchronisé au code)

- Modes: Realtime et Fast — FAIT
- Fast: résumé exact 1:1 et exécution (installs groupés + commandes CLI) — FAIT
- Extras design: astro-font, astro-icon (+ sets Iconify) — FAIT
- DB/Auth: choix DB (dev/local) + Better Auth (plugins, email Nodemailer/Resend) — FAIT
- .env: blocs nommés idempotents (.env et .env.example) — FAIT
- Aliases: @src/@lib/@components/@layouts — FAIT
- Résumé terminal immersif: couleurs + arbre fichiers + package preview + .env + schéma DB + commandes — FAIT
- README auto (projet): stack, deps installées (versions réelles), preview groupée, .env, design, arbres components/lib/api, schéma DB, commandes — FAIT
- Déploiement: sélection (cloudflare, vercel, netlify, node) + exécution « astro add <target> » + section README « Deployment » avec « Try it (deploy) » — FAIT
- Qualité (ESLint/Prettier/CI), Dockerfile/Devcontainer, Presets, Secrets sync, Flags CLI, Provision DB guidé — À FAIRE

## Roadmap par paliers

P0 — Déploiement minimal viable (DV)
- [x] Vercel (adapter + README)
	- `astro add vercel` — FAIT; README « Try it » — FAIT; CI build — À FAIRE
- [x] Netlify (adapter + README)
	- `astro add netlify` — FAIT; README « Try it » — FAIT; `netlify.toml` — À ÉVALUER; CI build — À FAIRE
- [x] Cloudflare (adapter + README)
	- `astro add cloudflare` — FAIT; README « Try it » (wrangler) — FAIT; CI build — À FAIRE
- [x] Node/VPS (adapter + README)
	- `astro add node` — FAIT; README « Try it » — FAIT; scripts start — À ÉVALUER; Dockerfile — À FAIRE

P1 — Provisionning & CI/CD
- [ ] Provision DB (optionnel, guidé)
	- Neon/Supabase/PlanetScale; secrets côté plateforme + local `.env`
- [ ] CI/CD GitHub Actions
	- Matrice Node 18/20, cache pnpm, lint + build + smoke; jobs deploy si tokens présents

P2 — DX avancée
- [ ] Flags CLI: `--fast`, `--yes`, `--no-memory`, `--deploy=<target>`
- [ ] Secrets sync (pull/push) et guide 1Password/Doppler (optionnel)
- [ ] Monorepo (workspaces) — docs de base
- [ ] Tests unitaires ciblés (env/json/computePlanCommands), snapshot README

## Déploiement — spécifications

Contrat (par cible):
- Entrées: target (cloudflare|vercel|netlify|node), env keys, options (région, output)
- Générations:
	- Cloudflare: `astro add cloudflare`, README + commandes wrangler
	- Vercel: `astro add vercel`, README + commandes vercel CLI
	- Netlify: `astro add netlify`, `netlify.toml`, README + netlify CLI
	- Node/VPS: `astro add node`, scripts `build/start`, README Node
- CI: job « build » par défaut; jobs deploy si secrets présents
- Erreurs: secrets manquants (messages clairs), adapter incompatible (fallback), CLI absente (instructions UI)

## .env & Secrets — exigences

- Blocs nommés idempotents: db, better_auth, email(...), supabase_auth
- Placeholders par défaut; option d’entrée immédiate masquée (non-stockée)
- README auto: sections .env avec clés attendues
- (P1) Sync de secrets vers plateforme (opt-in)

## DB & Auth — exigences

- DB: sqlite/postgres/neon/mysql/planetscale/supabase; adapters prisma/drizzle
- Auth: better-auth (plugins), supabase; email (nodemailer/resend)
- Préviews: schéma (prisma/drizzle); drivers ajoutés à l’install groupée

## UX & README — exigences

- Résumé terminal immersif (aligné 1:1 avec exécution)
- README auto: stack, deps installées (versions réelles), preview groupée, .env, design, arbres components/lib/api, schéma DB, commandes
- Déploiement: section dédiée + « Try it (deploy) »

## Acceptation (Definition of Done)

- P0 DV: projets générés déployables sur Cloudflare, Vercel, Netlify, Node avec doc + fichiers adaptés
- CI build verte; README clair et exact
- Re-exécution idempotente (pas de cassure)

## Plan d’implémentation (ordre suggéré)

1) Adapters & fichiers de config par cible + sections README « Try it (deploy) »
2) Job GitHub Actions (lint + build) et docs deploy (actions/CLI)
3) (Optionnel) Provision DB guidé (Neon/Supabase/PlanetScale)
4) Flags CLI `--deploy`, `--yes`, `--no-memory` + `--help`

---

## Prochaines features (UX & DX) — Top 10 priorisées

1) Secrets sync & validation (UX)
- Valeur: éviter les erreurs en validant .env et en proposant pull/push vers la plateforme (Vercel/Netlify/Cloudflare).
- Changements: step « Secrets » post-install; vérification .env vs .env.example; commandes suggérées; lint de formats.
- DoD: README affiche le statut des secrets; erreurs bloquantes claires.

2) Presets de stack (UX)
- Valeur: démarrer en un clic avec des stacks courantes (ex: SaaS starter: Drizzle+Postgres+BetterAuth+Resend+Iconify).
- Changements: step « Preset » pré-coche les steps; compatible Fast/Realtime.
- DoD: un preset produit le même plan/summary que les choix manuels correspondants.

3) Flags & fichier de config (DX)
- Valeur: exécutions non-interactives et reproductibles (CI/local).
- Changements: `--fast`, `--yes`, `--no-memory`, `--deploy=<t>`; support `.astro-bp.json`.
- DoD: `node bin/astro-bp.mjs --config ./.astro-bp.json` sans prompts, résultat 1:1 avec le résumé.

4) Idempotence + mode dry-run (UX/DX)
- Valeur: re-run sans casse; visualiser avant d’appliquer.
- Changements: `--dry-run` (Résumé complet, pas d’écritures); patching fin (auth.ts, schema, aliases).
- DoD: 2 runs consécutifs n’introduisent pas de diff; dry-run n’écrit pas.

5) Blueprints composants/API (UX)
- Valeur: accélérer la mise en place UI/API.
- Changements: option « Blueprints » qui génère composants de base (layout, header, icon) et endpoints auth/email.
- DoD: arbres listés dans le résumé/README; exemples compilent.

6) Dockerfile + Devcontainer (DX)
- Valeur: environnement portable local/CI/VPS.
- Changements: `Dockerfile` multi-stage, `.dockerignore`, `.devcontainer/devcontainer.json` (Node+pnpm) optionnels.
- DoD: build d’image OK; devcontainer VS Code fonctionne.

7) Provision DB guidé (UX)
- Valeur: obtenir une URL DB en 1 minute.
- Changements: assistants Neon/Supabase/PlanetScale (si CLI/API dispo); set des secrets plateforme + local.
- DoD: ping/connexion simple OK; README mis à jour.

8) Qualité automatique (DX)
- Valeur: feedback rapide.
- Changements: ESLint+Prettier; GitHub Actions (lint+build+smoke) généré dans le projet cible.
- DoD: pipeline vert; lint sans erreurs.

9) Résumé terminal enrichi (UX)
- Valeur: lisibilité maximale.
- Changements: grouping par catégories + badges « via astro add », bloc « Deploy » avec rappels de commandes.
- DoD: exact 1:1 avec exécution et README.

10) Extensions VS Code recommandées (DX)
- Valeur: DX immédiate.
- Changements: `.vscode/extensions.json` (Astro, ESLint, Prisma/Drizzle, Iconify), `settings.json` minimal (path aliases).
- DoD: VS Code propose les extensions utiles à l’ouverture.

## Parcours utilisateurs (User Experience)

- Onboarding (Realtime)
	1. Mode → nom → PM → scaffold
	2. Extras → DB/Auth → Email → Deploy
	3. (Option) Preset au début pour précocher
	4. Résumé (si applicable) → exécution
	5. Écriture .env/.env.example → Aliases → README
	6. (Option) Secrets sync & vérification → « Try it »

- Onboarding (Fast)
	1. Collecte (extras, DB/Auth/email, deploy, preset)
	2. Résumé immersif exact (packages, fichiers, .env, schema, commandes, deploy)
	3. Exécution groupée → README injecté

- Déploiement
	- Sélection de la cible; `astro add <target>`
	- README « Deployment » + « Try it (deploy) » avec commandes

## Parcours développeurs (Developer Experience)

- Local dev
	- Scripts: `pnpm install`, `pnpm dev/build/preview`
	- Aliases prêts (`@src`, `@lib`, `@components`, `@layouts`)

- Re-run & diagnostics
	- `--dry-run` pour voir les changements
	- Logs clairs (astro add, prisma generate, etc.)

- CI/CD
	- Workflow: cache pnpm, lint, build, smoke
	- Deploy conditionnel si secrets présents (Vercel/Netlify/Cloudflare)

---

## Milestones, dépendances et calendrier (anticipation)

- M0 — Foundations (terminé)
	- Modes Realtime/Fast, résumé immersif, README auto, .env blocs, DB/Auth, design, sélection déploiement

- M1 — Déploiement « simple add » (en cours)
	- Adapters via `astro add <cloudflare|vercel|netlify|node>` + README « Try it » par cible
	- Dépend de: M0

- M2 — Qualité minimale (lint + build CI)
	- ESLint/Prettier + GitHub Actions (Node 18/20, Windows) avec cache pnpm
	- Dépend de: M0

- M3 — Secrets sync & validation
	- Step post-install: contrôle .env vs .env.example, commandes `vercel env`/`netlify env`/`wrangler` proposées
	- Dépend de: M1, M2

- M4 — Presets & config file
	- Presets (SaaS starter, Blog), support `.astro-bp.json`, flags `--yes --fast --deploy`
	- Dépend de: M0, M2

- M5 — Idempotence avancée + dry-run
	- Patching fin (auth.ts, schema), `--dry-run` (zéro écriture) avec résumé complet
	- Dépend de: M0

- M6 — Dockerfile & Devcontainer
	- Dockerfile multi-stage, `.dockerignore`, `.devcontainer`
	- Dépend de: M2

- M7 — Provision DB guidé (optionnel)
	- Neon/Supabase/PlanetScale (CLI/API), écriture des secrets plateforme
	- Dépend de: M3

- M8 — Plugin system (extensibilité)
	- Points d’extension pour ajouter des steps tiers (ex: analytics, email templating)
	- Dépend de: M4, M5

- M9 — Publication & versioning
	- Publication npm, SemVer, CHANGELOG, binaire CLI, `--help` complet
	- Dépend de: M2, M5

- M10 — E2E & upgrade path
	- Tests E2E smoke (scaffold → build), snapshot README; upgrade guide + commandes de migration
	- Dépend de: M2, M5

### Dépendances clés (synthèse)
- M1 → M3 (secrets par cible)
- M2 → M3, M4, M6, M9, M10
- M4 → M8
- M5 → M8, M9, M10

## Risques, garde-fous et rollback

- Changements en amont (Astro/Better Auth/adapters) → scripts de compatibilité, tests smoke par cible
- Environnements hétérogènes (Win/Unix) → chemins et quoting revus; wrapper shell unique
- Interactions `astro add` (prompts) → fallback documentation si flags non supportés
- Rollback: feature flags (env vars), désactivation ciblée d’un step; commits atomiques (une feature = un commit)

## KPIs (succès mesurables)

- TTFD (time-to-first-dev) < 2 minutes en Fast (scaffold → `pnpm dev`)
- Idempotence: 2 runs consécutifs = 0 diff
- Parité résumé/README: 100%
- CI verte par défaut (lint+build)
- Taux de déploiement réussi (sans error) avec « Try it » ≥ 90%

## Tests d’acceptation (automatisables)

- Scaffold minimal → build OK
- Avec chaque cible (cloudflare, vercel, netlify, node): build OK; commandes « Try it » valides (sans exécuter un vrai push)
- README: contient les sections attendues (stack, deps, env, trees, schema, deploy)
- .env: blocs correctement écrits/rewritables; `.env.example` placeholders uniquement

## Stratégie de release

- Versioning SemVer; CHANGELOG par feature
- GitHub Releases; tag par version; binaire CLI optionnel
- Templates issues/PR; guidelines contribution; branche principale protégée


