import fs from 'node:fs';
import path from 'node:path';
import prompts from 'prompts';
import { runCmd, hasPnpm } from '../utils/cmd.js';

export async function scaffold(prev, onCancel, options = {}) {
  const defaultPmIsPnpm = hasPnpm();
  const prevPm = prev?.last?.packageManager;

  const answers = await prompts(
    [
      {
        type: 'text',
        name: 'projectName',
        message: 'Nom du projet',
        validate: (val) => {
          if (!val || !val.trim()) return 'Le nom est requis.';
          const basic = /^[a-z0-9]([a-z0-9-_]*[a-z0-9])?$/;
          const windowsDevice = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
          const name = val.trim();
          if (!basic.test(name)) return 'Utilise: lettres/chiffres, "-", "_", sans espaces.';
          if (windowsDevice.test(name)) return 'Nom réservé Windows.';
          const dest = path.resolve(process.cwd(), name);
          if (fs.existsSync(dest)) return 'Ce dossier existe déjà.';
          return true;
        }
      },
      {
        type: 'select',
        name: 'pm',
        message: 'Gestionnaire de paquets',
        choices: [ { title: 'pnpm', value: 'pnpm' }, { title: 'npm', value: 'npm' } ],
        initial: prevPm === 'pnpm' ? 0 : prevPm === 'npm' ? 1 : (defaultPmIsPnpm ? 0 : 1)
      }
    ],
    { onCancel }
  );
  const { projectName, pm } = answers;

  console.log('\nLancement de l’assistant Astro…');
  // In fast mode, use minimal template, skip git/init to keep installs for the end
  let cmdStr = `${pm} create astro@latest ${projectName}`;
  if (options.fast) {
    // npm create needs an extra -- before args; pnpm/yarn don't
    const flags = `--template minimal --git false --install false`;
    cmdStr = pm === 'npm'
      ? `${pm} create astro@latest ${projectName} -- ${flags}`
      : `${pm} create astro@latest ${projectName} ${flags}`;
  }
  const createRes = runCmd('create-astro', cmdStr);
  if (createRes.status !== 0) {
    return { aborted: true };
  }

  let projectPath = path.resolve(process.cwd(), projectName);
  const projectDirExists = fs.existsSync(projectPath);
  const hasPkgJson = fs.existsSync(path.join(projectPath, 'package.json'));
  console.log('\nCible des opérations:');
  console.log(`- Chemin: ${projectPath}`);
  console.log(`- Existe: ${projectDirExists ? 'oui' : 'non'}`);
  console.log(`- package.json: ${hasPkgJson ? 'trouvé' : 'manquant'}`);

  const { useDetectedPath } = await prompts(
    {
      type: 'toggle',
      name: 'useDetectedPath',
      message: 'Utiliser ce dossier pour les installations et intégrations ?',
      initial: projectDirExists && hasPkgJson,
      active: 'Oui',
      inactive: 'Non'
    },
    { onCancel }
  );

  if (!useDetectedPath) {
    const changed = await prompts(
      {
        type: 'text',
        name: 'projectPathInput',
        message: 'Chemin complet du dossier projet',
        initial: projectPath,
        validate: (p) => {
          const abs = path.resolve(String(p || ''));
          if (!fs.existsSync(abs)) return 'Ce dossier n’existe pas.';
          if (!fs.existsSync(path.join(abs, 'package.json'))) return 'package.json introuvable dans ce dossier.';
          return true;
        },
        format: (p) => path.resolve(String(p || ''))
      },
      { onCancel }
    );
    if (changed?.projectPathInput) {
      projectPath = changed.projectPathInput;
    }
  }

  const nodeModulesPath = path.join(projectPath, 'node_modules');
  const installed = fs.existsSync(nodeModulesPath);

  // In fast mode, we defer all installations to the end and skip prompts
  if (!options.fast) {
    let needInstall = !installed;
    if (!installed) {
      const decide = await prompts(
        {
          type: 'toggle',
          name: 'installNow',
          message: `Les dépendances ne semblent pas installées. Installer maintenant avec ${pm} ?`,
          initial: true,
          active: 'Oui',
          inactive: 'Non'
        },
        { onCancel }
      );
      needInstall = !!decide.installNow;
    }

    if (needInstall) {
      console.log(`\nInstallation des dépendances dans ${projectName}…`);
      const installCmd = `${pm} install`;
      const installRes = runCmd('install', installCmd, projectPath);
      if (installRes.status !== 0) {
        console.error('L’installation a échoué. Tu pourras la relancer manuellement.');
      }
    }
  }

  return { projectName, pm, projectPath };
}
