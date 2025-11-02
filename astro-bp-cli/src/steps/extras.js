import prompts from 'prompts';
import { runCmd } from '../utils/cmd.js';

export async function setupExtras(pm, projectPath, prev, onCancel, options = {}) {
  const extraChoices = [
    { title: 'astro-font (package tiers)', value: 'fonts' },
    { title: 'astro-icon (laisser la CLI faire)', value: 'icon' }
  ];
  const prevExtras = prev?.last?.extras || [];
  const extraInitial = extraChoices
    .map((c, idx) => (prevExtras.includes(c.value) ? idx : -1))
    .filter((i) => i >= 0);
  let extra;
  if (Array.isArray(options.preselectExtras)) {
    extra = options.preselectExtras;
  } else {
    const res = await prompts(
      {
        type: 'multiselect',
        name: 'extra',
        message: 'Ajouter des intégrations supplémentaires ?',
        hint: 'Espace pour sélectionner, Entrée pour valider',
        choices: extraChoices,
        initial: extraInitial,
        min: 0
      },
      { onCancel }
    );
    extra = res.extra;
  }

  if (Array.isArray(extra) && extra.includes('fonts')) {
    if (!options.dryRun) {
      const fontsCmd = pm === 'pnpm' ? `pnpm add astro-font` : `npm install astro-font`;
      const fontsRes = runCmd('astro-font', fontsCmd, projectPath);
      if (fontsRes.status !== 0) console.error("Échec lors de l'installation de astro-font.");
    }
  }

  let selectedIconSets = [];
  if (Array.isArray(extra) && extra.includes('icon')) {
    if (!options.dryRun) {
      const addIconCmd = pm === 'pnpm' ? `pnpm dlx astro add astro-icon` : `npx astro add astro-icon`;
      const addRes = runCmd('astro add astro-icon', addIconCmd, projectPath);
      if (addRes.status !== 0) console.error("Échec lors de 'astro add astro-icon'.");
    }
    const iconChoices = [
      { title: 'openmoji', value: '@iconify-json/openmoji' },
      { title: 'mdi', value: '@iconify-json/mdi' },
      { title: 'circle-flags', value: '@iconify-json/circle-flags' }
    ];
    let pkgs = [];
    if (Array.isArray(options.preselectIconSets)) {
      pkgs = options.preselectIconSets;
    } else {
      const prevIconSets = prev?.last?.iconSets || [];
      const iconInitial = iconChoices
        .map((c, idx) => (prevIconSets.includes(c.value) ? idx : -1))
        .filter((i) => i >= 0);
      const { iconSets } = await prompts(
        {
          type: 'multiselect',
          name: 'iconSets',
          message: 'Choisir les librairies d’icônes à installer',
          choices: iconChoices,
          initial: iconInitial,
          min: 0
        },
        { onCancel }
      );
      pkgs = Array.isArray(iconSets) ? iconSets : [];
    }
    selectedIconSets = pkgs;
    if (pkgs.length && !options.dryRun) {
      const installIconsCmd = pm === 'pnpm' ? `pnpm add -D ${pkgs.join(' ')}` : `npm i -D ${pkgs.join(' ')}`;
      const iconsRes = runCmd('icon sets', installIconsCmd, projectPath);
      if (iconsRes.status !== 0) console.error("Échec lors de l'installation des packages iconify JSON.");
    }
  }

  return { extras: Array.isArray(extra) ? extra : [], iconSets: selectedIconSets };
}
