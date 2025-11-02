import prompts from 'prompts';
import { runCmd } from '../utils/cmd.js';

const choices = [
  { title: 'Aucun (plus tard)', value: 'none' },
  { title: 'Vercel', value: 'vercel' },
  { title: 'Netlify', value: 'netlify' },
  { title: 'Cloudflare', value: 'cloudflare' },
  { title: 'Node / VPS', value: 'node' },
];

export async function chooseDeploy(prev, onCancel) {
  const prevVal = prev?.last?.deploy || 'none';
  const initial = Math.max(0, choices.findIndex((c) => c.value === prevVal));
  const { target } = await prompts(
    {
      type: 'select',
      name: 'target',
      message: 'Cible de déploiement',
      choices,
      initial,
    },
    { onCancel }
  );
  return target || 'none';
}

export function addDeployAdapter(pm, projectPath, target) {
  if (!target || target === 'none') return { status: 0 };
  const cmd = pm === 'pnpm' ? `pnpm dlx astro add ${target}` : `npx astro add ${target}`;
  return runCmd(`astro add ${target}`, cmd, projectPath);
}
