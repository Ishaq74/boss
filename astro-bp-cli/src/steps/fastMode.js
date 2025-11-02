import prompts from 'prompts';
import { chooseDbAndAuth } from './dbAuth.js';
import { chooseDeploy } from './deploy.js';

export async function collectFastChoices(prev, onCancel) {
  // Extras selection (no side effects)
  const extraChoices = [
    { title: 'astro-font (package tiers)', value: 'fonts' },
    { title: 'astro-icon (laisser la CLI faire)', value: 'icon' }
  ];
  const prevExtras = prev?.last?.extras || [];
  const extraInitial = extraChoices
    .map((c, idx) => (prevExtras.includes(c.value) ? idx : -1))
    .filter((i) => i >= 0);

  const { extra } = await prompts(
    {
      type: 'multiselect',
      name: 'extra',
      message: 'FAST: Sélection des intégrations',
      hint: 'Espace pour sélectionner, Entrée pour valider',
      choices: extraChoices,
      initial: extraInitial,
      min: 0
    },
    { onCancel }
  );

  let iconSets = [];
  if (Array.isArray(extra) && extra.includes('icon')) {
    const iconChoices = [
      { title: 'openmoji', value: '@iconify-json/openmoji' },
      { title: 'mdi', value: '@iconify-json/mdi' },
      { title: 'circle-flags', value: '@iconify-json/circle-flags' }
    ];
    const prevIconSets = prev?.last?.iconSets || [];
    const iconInitial = iconChoices
      .map((c, idx) => (prevIconSets.includes(c.value) ? idx : -1))
      .filter((i) => i >= 0);
    const picked = await prompts(
      { type: 'multiselect', name: 'iconSets', message: 'FAST: Choisir les librairies d’icônes', choices: iconChoices, initial: iconInitial, min: 0 },
      { onCancel }
    );
    iconSets = Array.isArray(picked.iconSets) ? picked.iconSets : [];
  }

  // DB + Auth (reuses step with backtracking)
  const { same, devDb, localDb, auth } = await chooseDbAndAuth(prev, onCancel);

  // Better Auth plugin + email (no side effects)
  if (auth.provider === 'better-auth') {
    const pluginChoices = [
      { title: 'admin (plugin)', value: 'admin' },
      { title: 'organization (plugin)', value: 'organization' },
      { title: 'username (plugin)', value: 'username' },
      { title: 'twoFactor (plugin)', value: 'twoFactor' },
      { title: 'bearer (plugin)', value: 'bearer' },
      { title: 'anonymous (plugin)', value: 'anonymous' },
      { title: 'openAPI (plugin)', value: 'openAPI' },
      { title: 'SSO (plugin)', value: 'sso' },
      { title: 'Stripe (plugin)', value: 'stripe' },
      { title: 'Polar (plugins)', value: 'polar' },
      { title: 'Dub analytics (plugin)', value: 'dub' },
      { title: 'Expo (plugin)', value: 'expo' },
      { title: 'Email & Password (config)', value: 'email-password' },
      { title: 'OAuth GitHub (config)', value: 'oauth-github' },
      { title: 'OAuth Google (config)', value: 'oauth-google' }
    ];
    const prevBetter = prev?.last?.auth?.provider === 'better-auth' ? (prev?.last?.auth || {}) : {};
    const prevPlugins = prevBetter.plugins || [];
    const initial = pluginChoices.map((c, i) => (prevPlugins.includes(c.value) ? i : -1)).filter((x) => x >= 0);
    const pick = await prompts(
      { type: 'multiselect', name: 'plugins', message: 'FAST: Plugins Better Auth', choices: pluginChoices, initial, min: 0 },
      { onCancel }
    );
    auth.plugins = Array.isArray(pick.plugins) ? pick.plugins : [];

    const emailChoices = [
      { title: 'Nodemailer (SMTP)', value: 'nodemailer' },
      { title: 'Resend', value: 'resend' },
      { title: 'Aucun (plus tard)', value: 'none' }
    ];
    const prevEmail = prev?.last?.auth?.email || 'none';
    const emailAsk = await prompts(
      { type: 'select', name: 'email', message: 'FAST: Choisir un provider email', choices: emailChoices, initial: Math.max(0, emailChoices.findIndex(c => c.value === prevEmail)) },
      { onCancel }
    );
    auth.email = emailAsk.email || 'none';
  }

  // Deployment target
  const deploy = await chooseDeploy(prev, onCancel);

  return { extras: Array.isArray(extra) ? extra : [], iconSets, same, devDb, localDb, auth, deploy };
}
