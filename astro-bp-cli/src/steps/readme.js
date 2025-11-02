import fs from 'node:fs';
import path from 'node:path';

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function listTree(rootDir) {
  const lines = [];
  function walk(dir, prefix = '') {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
    const files = entries.filter((e) => e.isFile()).map((e) => e.name).sort();
    dirs.forEach((dn, i) => {
      const isLastDir = i === dirs.length - 1 && files.length === 0;
      lines.push(`${prefix}${isLastDir ? '└' : '├'}─ ${dn}/`);
      const nextPrefix = `${prefix}${isLastDir ? '  ' : '│ '}`;
      walk(path.join(dir, dn), nextPrefix);
    });
    files.forEach((fn, i) => {
      const isLastFile = i === files.length - 1;
      lines.push(`${prefix}${isLastFile ? '└' : '├'}─ ${fn}`);
    });
  }
  walk(rootDir, '');
  return lines;
}

function buildPackagePreview(runtime, dev, viaAstroAdd = new Set()) {
  const indent = (n) => ' '.repeat(n);
  const groupOrder = ['astro', 'design', 'db', 'auth', 'misc'];
  const catOf = (pkg) => {
    if (pkg === 'astro' || pkg.startsWith('@astrojs/') || pkg.startsWith('astro-')) return 'astro';
    if (pkg.startsWith('@iconify-json/')) return 'design';
    if (pkg === 'astro-icon' || pkg === 'astro-font') return 'astro';
    if (['pg','mysql2','drizzle-orm','drizzle-kit','@prisma/client','prisma'].includes(pkg)) return 'db';
    if (pkg.includes('better-auth') || pkg === 'better-auth' || pkg === 'nodemailer' || pkg === '@types/nodemailer' || pkg === 'resend' || pkg === 'stripe' || pkg.startsWith('@polar-sh/better-auth') || pkg.startsWith('@dub/better-auth')) return 'auth';
    return 'misc';
  };
  const group = (arr) => {
    const g = { astro: [], design: [], db: [], auth: [], misc: [] };
    arr.forEach((p) => g[catOf(p)].push(p));
    groupOrder.forEach((k) => g[k].sort((a,b)=>a.localeCompare(b)));
    return g;
  };
  const R = group(runtime);
  const D = group(dev);

  const lines = [];
  lines.push('{');
  if (runtime.length) {
    lines.push(`${indent(2)}"dependencies": {`);
    groupOrder.forEach((cat) => {
      const list = R[cat];
      if (!list.length) return;
      lines.push(`${indent(4)}// ${cat}`);
      list.forEach((d, idx) => {
        const isLastInCat = idx === list.length - 1;
        // comma only if not last in dependencies overall; we will place comma unless this is last cat and last item and dev is empty
        const isLastGroup = groupOrder.slice(groupOrder.indexOf(cat)+1).every((c) => R[c].length === 0);
        const needComma = !(isLastInCat && isLastGroup && dev.length === 0);
        const comma = needComma ? ',' : '';
        const badge = viaAstroAdd.has(d) ? ' // via astro add' : '';
        lines.push(`${indent(4)}"${d}": "*"${comma}${badge}`);
      });
      if (R[cat].length) lines.push('');
    });
    // remove trailing blank if present
    if (lines[lines.length-1] === '') lines.pop();
    lines.push(`${indent(2)}}${dev.length ? ',' : ''}`);
  }
  if (dev.length) {
    lines.push(`${indent(2)}"devDependencies": {`);
    groupOrder.forEach((cat) => {
      const list = D[cat];
      if (!list.length) return;
      lines.push(`${indent(4)}// ${cat}`);
      list.forEach((d, idx) => {
        const isLastInCat = idx === list.length - 1;
        const isLastGroup = groupOrder.slice(groupOrder.indexOf(cat)+1).every((c) => D[c].length === 0);
        const needComma = !(isLastInCat && isLastGroup);
        const comma = needComma ? ',' : '';
        const badge = viaAstroAdd.has(d) ? ' // via astro add' : '';
        lines.push(`${indent(4)}"${d}": "*"${comma}${badge}`);
      });
      if (D[cat].length) lines.push('');
    });
    if (lines[lines.length-1] === '') lines.pop();
    lines.push(`${indent(2)}}`);
  }
  lines.push('}');
  return lines.join('\n');
}

function computeEnvSections(plan) {
  const sections = [];
  const dbKeys = [];
  const anyDb = (plan.db?.dev?.provider !== 'none') || (plan.db?.local?.provider !== 'none');
  if (plan.db?.dev?.provider !== 'none') dbKeys.push('DATABASE_URL_DEV');
  if (plan.db?.local?.provider !== 'none') dbKeys.push('DATABASE_URL_LOCAL');
  if (anyDb) dbKeys.push('DATABASE_URL');
  if (dbKeys.length) sections.push({ title: 'db', keys: dbKeys });

  if (plan.auth?.provider === 'better-auth') {
    const keys = ['BETTER_AUTH_ENABLED', 'BETTER_AUTH_PLUGINS', 'BETTER_AUTH_SECRET', 'BETTER_AUTH_URL'];
    const p = new Set(plan.auth.plugins || []);
    if (p.has('oauth-github')) keys.push('GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET');
    if (p.has('oauth-google')) keys.push('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET');
    if (p.has('stripe')) keys.push('STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET');
    if (p.has('polar')) keys.push('POLAR_ACCESS_TOKEN');
    sections.push({ title: 'better_auth', keys });
    if (plan.auth.email === 'nodemailer') sections.push({ title: 'email(nodemailer)', keys: ['SMTP_HOST','SMTP_PORT','SMTP_SECURE','SMTP_USER','SMTP_PASS','SMTP_FROM'] });
    if (plan.auth.email === 'resend') sections.push({ title: 'email(resend)', keys: ['RESEND_API_KEY','RESEND_FROM'] });
  } else if (plan.auth?.provider === 'supabase') {
    sections.push({ title: 'supabase_auth', keys: ['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY'] });
  }
  return sections;
}

function dbSchemaPreview(plan) {
  const adapter = plan.db?.dev?.adapter || plan.db?.local?.adapter;
  const provider = (plan.db?.dev?.provider !== 'none') ? plan.db.dev.provider : plan.db?.local?.provider;
  const prismaDialect = ['postgres','neon','supabase'].includes(provider) ? 'postgresql' : ['mysql','planetscale'].includes(provider) ? 'mysql' : provider === 'sqlite' ? 'sqlite' : 'postgresql';
  if (adapter === 'prisma') {
    return [
      'generator client {',
      '  provider = "prisma-client-js"',
      '}',
      '',
      'datasource db {',
      `  provider = "${prismaDialect}"`,
      '  url      = env("DATABASE_URL")',
      '}',
      '',
      '// Ajoute tes modèles ici',
    ].join('\n');
  } else if (adapter === 'drizzle') {
    const dialect = ['postgres','neon','supabase'].includes(provider) ? 'postgresql' : ['mysql','planetscale'].includes(provider) ? 'mysql' : 'sqlite';
    return [
      'import { defineConfig } from "drizzle-kit";',
      '',
      'export default defineConfig({',
      '  out: "./drizzle",',
      '  schema: "./src/db/schema.ts",',
      `  dialect: "${dialect}",`,
      '  dbCredentials: {',
      '    url: process.env.DATABASE_URL!,',
      '  },',
      '});',
      '',
      '// src/db/schema.ts',
      'export {};',
    ].join('\n');
  }
  return '// Aucun adapter DB sélectionné';
}

export function updateReadme(projectPath, plan, deps) {
  const readmePath = path.join(projectPath, 'README.md');
  let original = '';
  try { original = fs.readFileSync(readmePath, 'utf8'); } catch { original = ''; }

  const viaAstroAdd = new Set(
    (deps.cli || [])
      .map((c) => { const m = c.match(/astro\s+add\s+([^\s]+)/); return m ? m[1] : null; })
      .filter(Boolean)
  );

  const runtime = Array.from(new Set([...(deps.runtime || [])]));
  if (Array.isArray(plan.extras) && plan.extras.includes('icon') && !runtime.includes('astro-icon')) runtime.push('astro-icon');
  runtime.sort();
  const dev = Array.from(new Set([...(deps.dev || [])])).sort();

  const pkgPreview = buildPackagePreview(runtime, dev, viaAstroAdd);
  // Read actual installed package.json (with versions)
  const pkgPath = path.join(projectPath, 'package.json');
  let pkgInstalled = '';
  try {
    const raw = fs.readFileSync(pkgPath, 'utf8');
    try {
      const obj = JSON.parse(raw);
      const pick = {};
      const sortKeys = (rec) => {
        const out = {};
        Object.keys(rec || {}).sort((a,b)=>a.localeCompare(b)).forEach((k)=>{ out[k] = rec[k]; });
        return out;
      };
      if (obj.dependencies && Object.keys(obj.dependencies).length) {
        pick.dependencies = sortKeys(obj.dependencies);
      }
      if (obj.devDependencies && Object.keys(obj.devDependencies).length) {
        pick.devDependencies = sortKeys(obj.devDependencies);
      }
      pkgInstalled = JSON.stringify(pick, null, 2);
    } catch {
      pkgInstalled = raw;
    }
  } catch {
    pkgInstalled = '{\n  "error": "package.json not found (install may have failed)"\n}';
  }
  const envSections = computeEnvSections(plan);
  const envBlock = envSections.map((s) => `- ${s.title}\n  ${s.keys.map((k)=>`- ${k}`).join('\n  ')}`).join('\n');

  // Components tree
  const compDir = path.join(projectPath, 'src', 'components');
  const hasComp = fs.existsSync(compDir);
  const compTree = hasComp ? listTree(compDir).join('\n') : '(none yet)';

  // Lib tree
  const libDir = path.join(projectPath, 'src', 'lib');
  const hasLib = fs.existsSync(libDir);
  const libTree = hasLib ? listTree(libDir).join('\n') : '(none yet)';

  // API tree
  const apiDir = path.join(projectPath, 'src', 'pages', 'api');
  const hasApi = fs.existsSync(apiDir);
  const apiTree = hasApi ? listTree(apiDir).join('\n') : '(none yet)';

  // Design section
  const designLines = [];
  const extras = plan.extras || [];
  if (extras.length) designLines.push(`- Extras: ${extras.join(', ')}`);
  if ((plan.iconSets || []).length) designLines.push(`- Icon sets: ${(plan.iconSets||[]).join(', ')}`);
  const designBlock = designLines.length ? designLines.join('\n') : '- (none)';

  // Commands executed preview (as they appeared in summary)
  const commands = [];
  if ((deps.runtime || []).length) commands.push(`${plan.pm === 'pnpm' ? 'pnpm add' : 'npm install'} ${deps.runtime.join(' ')}`);
  if ((deps.dev || []).length) commands.push(`${plan.pm === 'pnpm' ? 'pnpm add -D' : 'npm install -D'} ${deps.dev.join(' ')}`);
  for (const c of (deps.cli || [])) commands.push(c);

  // Quick stack (one-liner)
  const provider = (plan.db?.dev?.provider !== 'none') ? plan.db.dev.provider : plan.db?.local?.provider;
  const adapter = plan.db?.dev?.adapter || plan.db?.local?.adapter;
  const dialect = ['postgres','neon','supabase'].includes(provider) ? 'postgresql' : ['mysql','planetscale'].includes(provider) ? 'mysql' : provider === 'sqlite' ? 'sqlite' : '—';
  const quickStack = `🟦 DB=${provider || 'none'}/${adapter || 'none'}/${dialect}; 🟥 Auth=${plan.auth?.provider || 'none'}${plan.auth?.provider==='better-auth' ? ` (plugins=[${(plan.auth.plugins||[]).join(', ')}], email=${plan.auth.email||'none'})` : ''}; 🟨 Design=extras[${(plan.extras||[]).join(', ')}] icons[${(plan.iconSets||[]).join(', ')}]; PM=${plan.pm}`;

  const markerStart = '<!-- astro-bp-cli:start -->';
  const markerEnd = '<!-- astro-bp-cli:end -->';
  const section = [
    markerStart,
    '',
    '## Bootstrap summary',
    '',
    `- Project: ${plan.projectName}`,
    `- Package manager: ${plan.pm}`,
    '',
  '### Quick stack',
  quickStack,
  '',
  '#### Legend',
  '🟩 astro  🟨 design  🟦 db  🟥 auth',
  '',
  '### package.json (installed)',
  '```json',
  pkgInstalled,
  '```',
  '',
  '### package.json (grouped preview, no versions)',
    '```jsonc',
    pkgPreview,
    '```',
    '',
    '### .env keys',
    envSections.map((s)=>`- ${s.title}\n  ${s.keys.map((k)=>`- ${k}`).join('\n  ')}`).join('\n'),
    '',
    '### Design',
    designBlock,
    '',
    '### Components tree',
    '```text',
    compTree,
    '```',
  '',
  '### Lib tree',
  '```text',
  libTree,
  '```',
  '',
  '### API routes tree',
  '```text',
  apiTree,
  '```',
    '',
    '### DB schema preview',
    '```',
    dbSchemaPreview(plan),
    '```',
    '',
    '### Commands',
    '```sh',
    commands.join('\n'),
    '```',
    '',
    markerEnd,
  ].join('\n');

  let next;
  if (!original.includes(markerStart)) {
    // Append at the end with a separator
    next = original.trimEnd() + '\n\n' + section + '\n';
  } else {
    const before = original.split(markerStart)[0];
    const after = original.split(markerEnd)[1] || '';
    next = before + section + (after.startsWith('\n') ? after : ('\n' + after));
  }
  ensureDir(path.dirname(readmePath));
  fs.writeFileSync(readmePath, next, 'utf8');
}
