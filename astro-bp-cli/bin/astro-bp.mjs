#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prompts from 'prompts';
import { runCmd, hasPnpm } from '../src/utils/cmd.js';
import { readJSONSafe, writeJSONSafe } from '../src/utils/json.js';
import { upsertEnvBlock, removeEnvBlock } from '../src/utils/env.js';
import { chooseDbAndAuth } from '../src/steps/dbAuth.js';
import { scaffold } from '../src/steps/scaffold.js';
import { setupExtras } from '../src/steps/extras.js';
import { configureBetterAuth } from '../src/steps/betterAuth.js';
import { writeEnvFiles } from '../src/steps/envFiles.js';
import { ensureAliases } from '../src/steps/aliases.js';
import { persist } from '../src/steps/persist.js';
import { collectFastChoices } from '../src/steps/fastMode.js';
import { reviewAndConfirm, computePlanCommands } from '../src/steps/review.js';
import { updateReadme } from '../src/steps/readme.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function isValidName(name) {
  // Basic npm-like package name rules (simplified) + Windows device names protection
  const basic = /^[a-z0-9]([a-z0-9-_]*[a-z0-9])?$/;
  const windowsDevice = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
  if (!basic.test(name)) return false;
  if (windowsDevice.test(name)) return false;
  return true;
}

// runCmd moved to utils/cmd.js

async function main() {
  const defaultPmIsPnpm = hasPnpm();

  const onCancel = () => {
    console.log('\nAnnulé.');
    process.exit(1);
  };

  // Enforce running from a target parent folder (not from the CLI repo itself)
  const cliRepoRoot = path.resolve(path.join(__dirname, '..'));
  const cwd = process.cwd();
  const runningInsideCliRepo = path.resolve(cwd).startsWith(cliRepoRoot);

  if (runningInsideCliRepo) {
    console.log('⚠️  Lance la commande depuis le dossier parent où tu veux créer le projet, pas depuis le repo de la CLI.');
    console.log(`Dossier courant: ${cwd}`);
    console.log('Exemple:');
    console.log('  cd ..');
    console.log('  node .\\astro-bp-cli\\bin\\astro-bp.mjs');
    process.exit(1);
  }

  const cacheDir = path.join(__dirname, '..', '.cache');
  const prefsPath = path.join(cacheDir, 'prefs.json');
  const prev = readJSONSafe(prefsPath) || {};
  const prevPm = prev?.last?.packageManager;

  // Mode selection
  const { mode } = await prompts(
    {
      type: 'select',
      name: 'mode',
      message: 'Choisir le mode',
      choices: [
        { title: 'Realtime (guidé, exécution immédiate à chaque étape)', value: 'realtime' },
        { title: 'Fast (tous les choix d’abord, résumé, puis exécution)', value: 'fast' }
      ],
      initial: 0
    },
    { onCancel }
  );

  // scaffold step (prompts project name + pm, run astro create, confirm path, ensure deps)
  const sc = await scaffold({ last: prev?.last }, onCancel, { fast: mode === 'fast' });
  if (sc?.aborted) process.exit(1);
  const { projectName, pm, projectPath } = sc;

  console.log('\nRésumé:');
  console.log(`- Projet: ${projectName}`);
  console.log(`- Package manager: ${pm}`);
  // On différera l'écriture de answers.json après les intégrations pour tout mémoriser

  console.log('\nAstro a terminé. Vérification de l’installation des dépendances…');

  if (mode === 'realtime') {
    // Proposer des intégrations additionnelles post-setup
    const { extras: extra, iconSets: selectedIconSets } = await setupExtras(pm, projectPath, { last: prev?.last }, onCancel);

    // Étape: Choix DB (dev/local) + Auth avec backtracking
    const { same, devDb, localDb, auth } = await chooseDbAndAuth({ last: prev?.last }, onCancel);
    if (auth.provider === 'supabase') {
      console.log('\nNote: Supabase Auth va nécessiter et potentiellement modifier des variables (.env) et la configuration du projet.');
    }
    if (auth.provider === 'better-auth') {
      const res = await configureBetterAuth({ pm, projectPath, devDb, localDb, prev: { last: prev?.last }, onCancel });
      auth.plugins = res.auth.plugins;
      auth.email = res.auth.email;
    }

    const runData = {
      projectName,
      packageManager: pm,
      createdAt: new Date().toISOString(),
      extras: Array.isArray(extra) ? extra : [],
      iconSets: selectedIconSets,
      db: { same, dev: devDb, local: localDb },
      auth
    };
  persist(cacheDir, runData);
  await writeEnvFiles(projectPath, devDb, localDb, auth, onCancel);
  ensureAliases(projectPath);
  // README summary (realtime)
  const finalPlan = { pm, projectName, projectPath, extras: Array.isArray(extra) ? extra : [], iconSets: selectedIconSets, db: { same, dev: devDb, local: localDb }, auth };
  const deps = computePlanCommands(finalPlan);
  const cmdsPreview = [];
  if (deps.runtime.length) cmdsPreview.push(pm === 'pnpm' ? `pnpm add ${deps.runtime.join(' ')}` : `npm install ${deps.runtime.join(' ')}`);
  if (deps.dev.length) cmdsPreview.push(pm === 'pnpm' ? `pnpm add -D ${deps.dev.join(' ')}` : `npm install -D ${deps.dev.join(' ')}`);
  for (const c of deps.cli) cmdsPreview.push(c);
  updateReadme(projectPath, finalPlan, { runtime: deps.runtime, dev: deps.dev, cli: deps.cli, preview: cmdsPreview });

    console.log('\nC’est bon. Étapes suivantes:');
    console.log(`- cd ./${projectName}`);
    console.log(`- ${pm} dev`);
  } else {
    // FAST MODE: collect choices, show summary, then execute
    const fast = await collectFastChoices({ last: prev?.last }, onCancel);
    const plan = {
      pm,
      projectName,
      projectPath,
      extras: fast.extras,
      iconSets: fast.iconSets,
      db: { same: fast.same, dev: fast.devDb, local: fast.localDb },
      auth: fast.auth
    };
    const ok = await reviewAndConfirm(plan);
    if (!ok) {
      console.log('\nAnnulé avant exécution. Aucun changement appliqué.');
      process.exit(0);
    }

    // Execute using presets
    const { extras: extra, iconSets: selectedIconSets } = await setupExtras(pm, projectPath, { last: prev?.last }, onCancel, {
      preselectExtras: fast.extras,
      preselectIconSets: fast.iconSets,
      dryRun: true
    });

    let auth = fast.auth;
    if (auth.provider === 'better-auth') {
      const res = await configureBetterAuth({ pm, projectPath, devDb: fast.devDb, localDb: fast.localDb, prev: { last: prev?.last }, onCancel, preset: { plugins: auth.plugins || [], email: auth.email || 'none' }, dryRun: true });
      auth.plugins = res.auth.plugins;
      auth.email = res.auth.email;
    }

    // Install aggregated dependencies and run planned CLI commands (matches summary)
    const finalPlan = { pm, projectName, projectPath, extras: extra, iconSets: selectedIconSets, db: { same: fast.same, dev: fast.devDb, local: fast.localDb }, auth };
    const deps = computePlanCommands(finalPlan);
    if (deps.runtime.length) {
      const cmd = pm === 'pnpm' ? `pnpm add ${deps.runtime.join(' ')}` : `npm install ${deps.runtime.join(' ')}`;
      const res = runCmd('install runtime deps', cmd, projectPath);
      if (res.status !== 0) console.error('Échec lors de l\'installation des dépendances runtime.');
    }
    if (deps.dev.length) {
      const cmd = pm === 'pnpm' ? `pnpm add -D ${deps.dev.join(' ')}` : `npm install -D ${deps.dev.join(' ')}`;
      const res = runCmd('install dev deps', cmd, projectPath);
      if (res.status !== 0) console.error('Échec lors de l\'installation des dépendances de dev.');
    }
    for (const cli of deps.cli) {
      const res = runCmd('post-install step', cli, projectPath);
      if (res.status !== 0) console.error(`Échec lors de l'exécution: ${cli}`);
    }

    const runData = {
      projectName,
      packageManager: pm,
      createdAt: new Date().toISOString(),
      extras: Array.isArray(extra) ? extra : [],
      iconSets: selectedIconSets,
      db: { same: fast.same, dev: fast.devDb, local: fast.localDb },
      auth
    };
  persist(cacheDir, runData);
  await writeEnvFiles(projectPath, fast.devDb, fast.localDb, auth, onCancel, { nonInteractive: true });
  ensureAliases(projectPath);
  // README summary (fast)
  updateReadme(projectPath, finalPlan, deps);

    console.log('\nC’est bon. Étapes suivantes:');
    console.log(`- cd ./${projectName}`);
    console.log(`- ${pm} dev`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
