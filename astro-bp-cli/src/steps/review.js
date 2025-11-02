import prompts from 'prompts';

const color = {
  reset: (s) => `\x1b[0m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  magenta: (s) => `\x1b[35m${s}\x1b[0m`,
  gray: (s) => `\x1b[90m${s}\x1b[0m`,
  blue: (s) => `\x1b[34m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
};

export function computePlanCommands(plan) {
  const pm = plan.pm;
  const runtimePkgs = new Set();
  const devPkgs = new Set();
  const cliCmds = [];

  // Extras
  if (plan.extras?.includes('fonts')) {
    runtimePkgs.add('astro-font');
  }
  if (plan.extras?.includes('icon')) {
    // We'll use the official CLI to wire files
    cliCmds.push(pm === 'pnpm' ? 'pnpm dlx astro add astro-icon' : 'npx astro add astro-icon');
    for (const s of plan.iconSets || []) devPkgs.add(s);
  }

  const primary = plan.db?.dev?.provider !== 'none' ? plan.db.dev.provider : plan.db?.local?.provider;
  const isPg = ['postgres','neon','supabase'].includes(primary);
  const isMysql = ['mysql','planetscale'].includes(primary);

  // Better Auth core + plugins
  if (plan.auth?.provider === 'better-auth') {
    runtimePkgs.add('better-auth');
    const p = new Set(plan.auth.plugins || []);
    if (p.has('sso')) runtimePkgs.add('@better-auth/sso');
    if (p.has('stripe')) { runtimePkgs.add('@better-auth/stripe'); runtimePkgs.add('stripe'); }
    if (p.has('polar')) { runtimePkgs.add('@polar-sh/better-auth'); runtimePkgs.add('@polar-sh/sdk'); }
    if (p.has('dub')) { runtimePkgs.add('@dub/better-auth'); runtimePkgs.add('dub'); }
    if (p.has('expo')) runtimePkgs.add('@better-auth/expo');
    if (isPg) runtimePkgs.add('pg');
    if (isMysql) runtimePkgs.add('mysql2');

    if (plan.auth.email === 'nodemailer') {
      runtimePkgs.add('nodemailer');
      devPkgs.add('@types/nodemailer');
    } else if (plan.auth.email === 'resend') {
      runtimePkgs.add('resend');
    }
  }

  // DB adapters
  const adapter = plan.db?.dev?.adapter || plan.db?.local?.adapter;
  if (adapter === 'prisma') {
    runtimePkgs.add('@prisma/client');
    devPkgs.add('prisma');
    cliCmds.push(pm === 'pnpm' ? 'pnpm dlx prisma generate' : 'npx prisma generate');
  } else if (adapter === 'drizzle') {
    runtimePkgs.add('drizzle-orm');
    devPkgs.add('drizzle-kit');
  }

  return {
    runtime: Array.from(runtimePkgs).sort(),
    dev: Array.from(devPkgs).sort(),
    cli: cliCmds,
  };
}

export async function reviewAndConfirm(plan) {
  const cmds = computePlanCommands(plan);
  const files = (function computeFilePlan() {
    const out = [];
    // Env blocks are always touched
    out.push({ p: '.env', action: 'modify' });
    out.push({ p: '.env.example', action: 'modify' });

    // Better Auth files
    if (plan.auth?.provider === 'better-auth') {
      out.push({ p: 'src/auth.ts', action: 'create' });
      out.push({ p: 'src/pages/api/auth/[...all].ts', action: 'create' });
      out.push({ p: 'src/middleware.ts', action: 'create' });
      out.push({ p: 'src/lib/auth-client.ts', action: 'create' });
      out.push({ p: 'src/env.d.ts', action: 'create' });
      if (plan.auth.email && plan.auth.email !== 'none') out.push({ p: 'src/lib/email.ts', action: 'create' });
    }

    // DB adapter scaffolding
    const adapter = plan.db?.dev?.adapter || plan.db?.local?.adapter;
    if (adapter === 'prisma') {
      out.push({ p: 'prisma/schema.prisma', action: 'create' });
    } else if (adapter === 'drizzle') {
      out.push({ p: 'drizzle.config.ts', action: 'create' });
      out.push({ p: 'src/db/schema.ts', action: 'create' });
    }

    // Config files likely modified by alias/extras steps
    out.push({ p: 'tsconfig.json', action: 'modify' });
    out.push({ p: 'astro.config.*', action: 'modify' });
    return out;
  })();
  function buildTree(entries) {
    const root = { name: '', dirs: new Map(), files: [] };
    for (const e of entries) {
      const parts = e.p.split('/');
      let node = root;
      for (let i = 0; i < parts.length - 1; i++) {
        const seg = parts[i];
        if (!node.dirs.has(seg)) node.dirs.set(seg, { name: seg, dirs: new Map(), files: [] });
        node = node.dirs.get(seg);
      }
      node.files.push({ name: parts[parts.length - 1], action: e.action });
    }
    const lines = [];
    function walk(n, prefix = '') {
      const dirNames = Array.from(n.dirs.keys()).sort();
      const fileList = n.files.sort((a, b) => a.name.localeCompare(b.name));
      dirNames.forEach((dn, i) => {
        const isLastDir = i === dirNames.length - 1 && fileList.length === 0;
        lines.push(`${prefix}${isLastDir ? '└' : '├'}─ ${color.blue(dn)}/`);
        const nextPrefix = `${prefix}${isLastDir ? '  ' : '│ '}`;
        walk(n.dirs.get(dn), nextPrefix);
      });
      fileList.forEach((f, i) => {
        const isLastFile = i === fileList.length - 1;
        const mark = f.action === 'create' ? color.green('+') : color.yellow('~');
        lines.push(`${prefix}${isLastFile ? '└' : '├'}─ ${f.name} ${color.gray('(')}${mark}${color.gray(')')}`);
      });
    }
    walk(root, '');
    return lines;
  }

  function renderPackageJsonLike(runtime, dev, addBadges = new Set()) {
    const L = [];
    const braceO = color.gray('{');
    const braceC = color.gray('}');
    const key = (s) => color.cyan(`\"${s}\"`);
    const val = (s) => color.green(`"${s}"`);
    let needComma = false;

    const catOf = (pkg) => {
      if (pkg === 'astro' || pkg.startsWith('@astrojs/') || pkg.startsWith('astro-')) return 'astro';
      if (pkg.startsWith('@iconify-json/')) return 'design';
      if (pkg === 'astro-icon' || pkg === 'astro-font') return 'astro';
      if (pkg === 'pg' || pkg === 'mysql2' || pkg === 'drizzle-orm' || pkg === 'drizzle-kit' || pkg === '@prisma/client' || pkg === 'prisma') return 'db';
      if (pkg.includes('better-auth') || pkg === 'better-auth' || pkg === 'nodemailer' || pkg === '@types/nodemailer' || pkg === 'resend' || pkg === 'stripe' || pkg.startsWith('@polar-sh/better-auth') || pkg.startsWith('@dub/better-auth')) return 'auth';
      return 'misc';
    };
    const colorPkg = (pkg) => {
      const cat = catOf(pkg);
      const q = `\"${pkg}\"`;
      if (cat === 'astro') return color.green(q);
      if (cat === 'design') return color.yellow(q);
      if (cat === 'db') return color.blue(q);
      if (cat === 'auth') return color.red(q);
      return color.cyan(q);
    };

    L.push(`${braceO}`);
    if (runtime.length) {
      L.push(`  ${key('dependencies')}: ${braceO}`);
      runtime.forEach((d, i) => {
        const comma = i < runtime.length - 1 ? ',' : '';
        const badge = addBadges.has(d) ? ` ${color.dim('// via astro add')}` : '';
        L.push(`    ${colorPkg(d)}: ${val('*')}${comma}${badge}`);
      });
      L.push(`  ${braceC}${dev.length ? ',' : ''}`);
      needComma = false;
    }
    if (dev.length) {
      L.push(`  ${key('devDependencies')}: ${braceO}`);
      dev.forEach((d, i) => {
        const comma = i < dev.length - 1 ? ',' : '';
        const badge = addBadges.has(d) ? ` ${color.dim('// via astro add')}` : '';
        L.push(`    ${colorPkg(d)}: ${val('*')}${comma}${badge}`);
      });
      L.push(`  ${braceC}`);
    }
    L.push(`${braceC}`);
    return L;
  }

  function computeEnvKeys(plan) {
    const sections = [];
    const dbKeys = [];
    const anyDb = (plan.db?.dev?.provider !== 'none') || (plan.db?.local?.provider !== 'none');
    if (plan.db?.dev?.provider !== 'none') dbKeys.push('DATABASE_URL_DEV');
    if (plan.db?.local?.provider !== 'none') dbKeys.push('DATABASE_URL_LOCAL');
    if (anyDb) dbKeys.push('DATABASE_URL');
    if (dbKeys.length) sections.push({ name: 'db', keys: dbKeys });

    if (plan.auth?.provider === 'better-auth') {
      const keys = ['BETTER_AUTH_ENABLED', 'BETTER_AUTH_PLUGINS', 'BETTER_AUTH_SECRET', 'BETTER_AUTH_URL'];
      const p = new Set(plan.auth.plugins || []);
      if (p.has('oauth-github')) keys.push('GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET');
      if (p.has('oauth-google')) keys.push('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET');
      if (p.has('stripe')) keys.push('STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET');
      if (p.has('polar')) keys.push('POLAR_ACCESS_TOKEN');
      sections.push({ name: 'better_auth', keys });
      if (plan.auth.email === 'nodemailer') sections.push({ name: 'email(nodemailer)', keys: ['SMTP_HOST','SMTP_PORT','SMTP_SECURE','SMTP_USER','SMTP_PASS','SMTP_FROM'] });
      if (plan.auth.email === 'resend') sections.push({ name: 'email(resend)', keys: ['RESEND_API_KEY','RESEND_FROM'] });
    } else if (plan.auth?.provider === 'supabase') {
      sections.push({ name: 'supabase_auth', keys: ['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY'] });
    }
    return sections;
  }

  function renderEnvKeys(sections) {
    const L = [];
    for (const s of sections) {
      const head = s.name === 'db' ? color.blue(s.name) : s.name === 'better_auth' ? color.red(s.name) : s.name.startsWith('email') ? color.yellow(s.name) : color.cyan(s.name);
      L.push(`  ${head}:`);
      for (const k of s.keys) {
        const c = s.name === 'db' ? color.blue : s.name === 'better_auth' ? color.red : s.name.startsWith('email') ? color.yellow : color.cyan;
        L.push(`    - ${c(k)}`);
      }
    }
    return L;
  }

  function dbSchemaPreview(plan) {
    const L = [];
    const adapter = plan.db?.dev?.adapter || plan.db?.local?.adapter;
    const provider = (plan.db?.dev?.provider !== 'none') ? plan.db.dev.provider : plan.db?.local?.provider;
    const prismaDialect = ['postgres','neon','supabase'].includes(provider) ? 'postgresql' : ['mysql','planetscale'].includes(provider) ? 'mysql' : provider === 'sqlite' ? 'sqlite' : 'postgresql';
    if (adapter === 'prisma') {
      const kw = (s) => color.magenta(s);
      const str = (s) => color.green(`"${s}"`);
      const fn = (s) => color.cyan(s);
      L.push(`  ${kw('generator')} ${color.cyan('client')} ${color.gray('{')}`);
      L.push(`    ${color.cyan('provider')} = ${str('prisma-client-js')}`);
      L.push(`  ${color.gray('}')}`);
      L.push('');
      L.push(`  ${kw('datasource')} ${color.cyan('db')} ${color.gray('{')}`);
      L.push(`    ${color.cyan('provider')} = ${str(prismaDialect)}`);
      L.push(`    ${color.cyan('url')}      = ${fn('env')}${color.gray('(')}${str('DATABASE_URL')}${color.gray(')')}`);
      L.push(`  ${color.gray('}')}`);
      L.push('');
      L.push(`  ${color.gray('// Ajoute tes modèles ici')}`);
    } else if (adapter === 'drizzle') {
      const kw = (s) => color.magenta(s);
      const q = (s) => color.green(`"${s}"`);
      const dialect = ['postgres','neon','supabase'].includes(provider) ? 'postgresql' : ['mysql','planetscale'].includes(provider) ? 'mysql' : 'sqlite';
      L.push(`  ${kw('import')} ${color.gray('{')} ${color.cyan('defineConfig')} ${color.gray('}')} ${kw('from')} ${q('drizzle-kit')}`);
      L.push('');
      L.push(`  ${kw('export default')} ${color.cyan('defineConfig')}${color.gray('({')}`);
      L.push(`    ${color.cyan('out')}: ${q('./drizzle')},`);
      L.push(`    ${color.cyan('schema')}: ${q('./src/db/schema.ts')},`);
      L.push(`    ${color.cyan('dialect')}: ${q(dialect)},`);
      L.push(`    ${color.cyan('dbCredentials')}: ${color.gray('{')} ${color.cyan('url')}: ${q('${process.env.DATABASE_URL}')} ${color.gray('}')}`);
      L.push(`  ${color.gray('})')}`);
      L.push('');
      L.push(`  ${color.gray('// src/db/schema.ts')}`);
      L.push(`  ${kw('export')} ${color.gray('{}')}`);
    } else {
      L.push(`  ${color.gray('// Aucun adapter DB sélectionné')}`);
    }
    return L;
  }

  const lines = [];
  lines.push(color.magenta(color.bold('═══ Fast Review ═════════════════════════════════════════════════')));
  lines.push('');
  lines.push(`${color.bold('Projet:')} ${plan.projectName}`);
  lines.push(`${color.bold('PM:')} ${plan.pm}`);
  lines.push('');
  // Package first
  lines.push(color.bold('▸ package.json (sans versions)'));
  const previewRuntime = [...cmds.runtime];
  if (Array.isArray(plan.extras) && plan.extras.includes('icon') && !previewRuntime.includes('astro-icon')) {
    previewRuntime.push('astro-icon');
  }
  previewRuntime.sort();
  // Extract packages coming from `astro add <pkg>` to badge them
  const viaAstroAdd = new Set(
    (cmds.cli || [])
      .map((c) => {
        const m = c.match(/astro\s+add\s+([^\s]+)/);
        return m ? m[1] : null;
      })
      .filter(Boolean)
  );
  const pkgLines = renderPackageJsonLike(previewRuntime, cmds.dev, viaAstroAdd);
  lines.push(...pkgLines.map((l) => `  ${l}`));
  lines.push('');
  // Légende + DB design
  const provider = (plan.db?.dev?.provider !== 'none') ? plan.db.dev.provider : plan.db?.local?.provider;
  const adapter = plan.db?.dev?.adapter || plan.db?.local?.adapter;
  const dialect = ['postgres','neon','supabase'].includes(provider) ? 'postgresql' : ['mysql','planetscale'].includes(provider) ? 'mysql' : provider === 'sqlite' ? 'sqlite' : '—';
  lines.push(color.bold('▸ Légende & Design DB'));
  lines.push(`  ${color.cyan('"key"')} ${color.gray(':')} ${color.green('"*"')}  ${color.gray('→ package sans version')}`);
  lines.push(`  ${color.green('astro')} ${color.gray('= vert, ')}${color.yellow('design')} ${color.gray('= jaune, ')}${color.blue('db')} ${color.gray('= bleu, ')}${color.red('auth')} ${color.gray('= rouge')}`);
  lines.push(`  ${color.green('+')} ${color.gray(': créé, ')}${color.yellow('~')}${color.gray(': modifié')}`);
  lines.push(`  ${color.gray('DB:')} provider=${provider || 'none'}, adapter=${adapter || 'none'}, dialect=${dialect}`);
  if (plan.auth?.provider) lines.push(`  ${color.gray('Auth:')} ${plan.auth.provider}${plan.auth.provider==='better-auth' ? `, plugins=[${(plan.auth.plugins||[]).join(', ')}], email=${plan.auth.email||'none'}` : ''}`);
  lines.push('');
  lines.push(color.bold('▸ Fichiers'));
  const treeLines = buildTree(files);
  lines.push(...treeLines.map((l) => `  ${l}`));
  lines.push('');
  // .env keys
  lines.push(color.bold('▸ .env clés'));
  const envSections = computeEnvKeys(plan);
  lines.push(...renderEnvKeys(envSections));
  lines.push('');
  // DB schema preview
  lines.push(color.bold('▸ Schéma DB (aperçu)'));
  const schemaLines = dbSchemaPreview(plan);
  lines.push(...schemaLines);
  lines.push('');
  lines.push(color.bold('▸ Commandes'));
  if (cmds.runtime.length) lines.push(`  ${color.cyan('$')} ${plan.pm === 'pnpm' ? 'pnpm add' : 'npm install'} ${cmds.runtime.join(' ')}`);
  if (cmds.dev.length) lines.push(`  ${color.cyan('$')} ${plan.pm === 'pnpm' ? 'pnpm add -D' : 'npm install -D'} ${cmds.dev.join(' ')}`);
  for (const c of cmds.cli) lines.push(`  ${color.cyan('$')} ${c}`);
  lines.push('');
  lines.push(color.dim('────────────────────────────────────────────────────────────────'));
  lines.push('');

  console.log('\n' + lines.join('\n'));

  const { proceed } = await prompts(
    { type: 'toggle', name: 'proceed', message: 'Appliquer ces changements ?', initial: true, active: 'Oui', inactive: 'Non' },
    { onCancel: () => ({ proceed: false }) }
  );
  return !!proceed;
}
