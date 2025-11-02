import prompts from 'prompts';

export async function chooseDbAndAuth(prev, onCancel) {
  console.log('\nConfiguration base de données / auth');

  const dbProviders = [
    { title: 'Aucune (Astro Content Collections)', value: 'none' },
    { title: 'SQLite (local file)', value: 'sqlite' },
    { title: 'PostgreSQL (self-hosted)', value: 'postgres' },
    { title: 'PostgreSQL (Neon)', value: 'neon' },
    { title: 'MySQL (self-hosted)', value: 'mysql' },
    { title: 'MySQL (PlanetScale)', value: 'planetscale' },
    { title: 'Supabase (Postgres + outils)', value: 'supabase' }
  ];
  const dbAdapters = [
    { title: 'Aucun', value: 'none' },
    { title: 'Drizzle', value: 'drizzle' },
    { title: 'Prisma', value: 'prisma' }
  ];

  const prevDb = prev?.last?.db || {};
  const sameDefault = Boolean(prevDb.same);
  const sameAsk = await prompts(
    {
      type: 'toggle',
      name: 'same',
      message: 'Utiliser la même base pour dev et local ?',
      initial: sameDefault,
      active: 'Oui',
      inactive: 'Non'
    },
    { onCancel }
  );
  const same = !!sameAsk.same;

  let devDb = { provider: prevDb.dev?.provider || 'sqlite', adapter: prevDb.dev?.adapter || 'none' };
  let localDb = { provider: prevDb.local?.provider || 'sqlite', adapter: prevDb.local?.adapter || 'none' };

  const pickProvider = async (label, initial) => {
    const p1 = await prompts(
      {
        type: 'select',
        name: 'provider',
        message: `(${label}) Choisir la base de données`,
        choices: dbProviders,
        initial: Math.max(0, dbProviders.findIndex(c => c.value === (initial?.provider || 'sqlite')))
      },
      { onCancel }
    );
    return { provider: p1.provider };
  };

  if (same) {
    const picked = await pickProvider('dev & local', prevDb.dev || prevDb.local || { provider: 'sqlite' });
    devDb = { provider: picked.provider, adapter: 'none' };
    localDb = { provider: picked.provider, adapter: 'none' };
  } else {
    const pDev = await pickProvider('dev', prevDb.dev);
    const pLocal = await pickProvider('local', prevDb.local);
    devDb = { provider: pDev.provider, adapter: 'none' };
    localDb = { provider: pLocal.provider, adapter: 'none' };
  }

  const anyDbSelectedForAdapter = devDb.provider !== 'none' || localDb.provider !== 'none';
  const adapterChoicesOne = [
    { title: 'Aucun', value: 'none' },
    { title: 'Drizzle', value: 'drizzle', disabled: !anyDbSelectedForAdapter, description: !anyDbSelectedForAdapter ? 'Choisis au moins une base.' : undefined },
    { title: 'Prisma', value: 'prisma', disabled: !anyDbSelectedForAdapter, description: !anyDbSelectedForAdapter ? 'Choisis au moins une base.' : undefined }
  ];
  const prevAdapter = prevDb?.dev?.adapter || prevDb?.local?.adapter || 'none';
  const adapterAsk = await prompts(
    {
      type: 'select',
      name: 'adapter',
      message: 'Adapter DB (unique pour dev/local)',
      choices: adapterChoicesOne,
      initial: Math.max(0, dbAdapters.findIndex(c => c.value === (prevAdapter || 'none')))
    },
    { onCancel }
  );
  devDb.adapter = adapterAsk.adapter;
  localDb.adapter = adapterAsk.adapter;

  // Auth selection with backtracking for gated options
  while (true) {
    const canUseSupabaseAuth = devDb.provider === 'supabase' && localDb.provider === 'supabase';
    const authChoices = [
      { title: 'Aucune', value: 'none' },
      {
        title: 'Supabase Auth',
        value: 'supabase',
        disabled: !canUseSupabaseAuth,
        description: !canUseSupabaseAuth
          ? 'Choisis Supabase comme DB pour dev et local pour activer cette option.'
          : 'Activer Supabase Auth modifiera certaines valeurs (.env, config).'
      },
      {
        title: 'Better Auth',
        value: 'better-auth',
        description: 'Auth modulaire avec plugins (admin, organization, etc.)'
      }
    ];

    if (!canUseSupabaseAuth) {
      authChoices.push({ title: 'Configurer DB pour activer Supabase Auth…', value: 'revisit-db' });
    }

    const authAsk = await prompts(
      {
        type: 'select',
        name: 'provider',
        message: 'Choisir le fournisseur d’authentification',
        choices: authChoices,
        initial: Math.max(0, authChoices.findIndex(c => c.value === (prev?.last?.auth?.provider || 'none')))
      },
      { onCancel }
    );

    if (authAsk.provider === 'revisit-db') {
      // Loop back to provider selection
      if (same) {
        const picked = await pickProvider('dev & local', prevDb.dev || prevDb.local || { provider: 'supabase' });
        devDb.provider = picked.provider;
        localDb.provider = picked.provider;
      } else {
        const pDev = await pickProvider('dev', { provider: devDb.provider });
        const pLocal = await pickProvider('local', { provider: localDb.provider });
        devDb.provider = pDev.provider;
        localDb.provider = pLocal.provider;
      }
      continue;
    }

    const auth = { provider: authAsk.provider };
    return { same, devDb, localDb, auth };
  }
}
