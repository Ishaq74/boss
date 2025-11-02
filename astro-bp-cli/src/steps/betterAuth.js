import fs from 'node:fs';
import path from 'node:path';
import prompts from 'prompts';
import { runCmd } from '../utils/cmd.js';

export async function configureBetterAuth({ pm, projectPath, devDb, localDb, prev, onCancel, preset, dryRun = false }) {
  console.log('\nBetter Auth: sélection des plugins (optionnel)');
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
  let selected;
  if (preset && Array.isArray(preset.plugins)) {
    selected = preset.plugins;
  } else {
    const prevBetter = prev?.last?.auth?.provider === 'better-auth' ? (prev?.last?.auth || {}) : {};
    const prevPlugins = prevBetter.plugins || [];
    const initial = pluginChoices.map((c, i) => (prevPlugins.includes(c.value) ? i : -1)).filter((x) => x >= 0);
    const pick = await prompts(
      { type: 'multiselect', name: 'plugins', message: 'Plugins Better Auth', choices: pluginChoices, initial, min: 0 },
      { onCancel }
    );
    selected = Array.isArray(pick.plugins) ? pick.plugins : [];
  }

  if (!dryRun) {
    console.log('\nInstallation de better-auth…');
    const installBetter = pm === 'pnpm' ? `pnpm add better-auth` : `npm install better-auth`;
    const betterRes = runCmd('better-auth', installBetter, projectPath);
    if (betterRes.status !== 0) console.error("Échec lors de l'installation de better-auth.");
  }

  if ((!preset || !preset.plugins) && selected.includes('expo') && !selected.includes('email-password')) {
    const enableEmail = await prompts(
      {
        type: 'toggle',
        name: 'ok',
        message: 'Expo fonctionne mieux avec Email & Password. Activer maintenant ?',
        initial: true,
        active: 'Oui',
        inactive: 'Non'
      },
      { onCancel }
    );
    if (enableEmail.ok) selected = [...selected, 'email-password'];
  }

  const installPkg = async (label, pkgs) => {
    const pkgList = Array.isArray(pkgs) ? pkgs : [pkgs];
    if (!dryRun) {
      const cmd = pm === 'pnpm' ? `pnpm add ${pkgList.join(' ')}` : `npm install ${pkgList.join(' ')}`;
      const res = runCmd(label, cmd, projectPath);
      if (res.status !== 0) console.error(`Échec lors de l'installation de ${label}.`);
    }
  };

  if (selected.includes('sso')) await installPkg('better-auth sso', ['@better-auth/sso']);
  if (selected.includes('stripe')) await installPkg('better-auth stripe', ['@better-auth/stripe', 'stripe']);
  if (selected.includes('polar')) await installPkg('better-auth polar', ['@polar-sh/better-auth', '@polar-sh/sdk']);
  if (selected.includes('dub')) await installPkg('better-auth dub', ['@dub/better-auth', 'dub']);
  if (selected.includes('expo')) await installPkg('better-auth expo', ['@better-auth/expo']);

  const primaryProvider = devDb.provider !== 'none' ? devDb.provider : localDb.provider;
  const isPg = ['postgres','neon','supabase'].includes(primaryProvider);
  const isMysql = ['mysql','planetscale'].includes(primaryProvider);
  const isSqlite = primaryProvider === 'sqlite';

  if (isPg) {
    if (!dryRun) {
      const installPg = pm === 'pnpm' ? `pnpm add pg` : `npm install pg`;
      const pgRes = runCmd('pg', installPg, projectPath);
      if (pgRes.status !== 0) console.error("Échec lors de l'installation de pg.");
    }
  } else if (isMysql) {
    if (!dryRun) {
      const installMysql = pm === 'pnpm' ? `pnpm add mysql2` : `npm install mysql2`;
      const myRes = runCmd('mysql2', installMysql, projectPath);
      if (myRes.status !== 0) console.error("Échec lors de l'installation de mysql2.");
    }
  } else if (isSqlite) {
    console.log('\nNote: SQLite sélectionné — configure la DB dans src/auth.ts selon ton driver favori (ex: better-sqlite3).');
  }

  const authFile = path.join(projectPath, 'src', 'auth.ts');
  if (!fs.existsSync(authFile)) {
    const corePlugins = selected.filter(p => ['admin','organization','username','twoFactor','bearer','anonymous','openAPI'].includes(p));
    const needsEmailPw = selected.includes('email-password');
    const wantsGithub = selected.includes('oauth-github');
    const wantsGoogle = selected.includes('oauth-google');
    const useSso = selected.includes('sso');
    const useStripe = selected.includes('stripe');
    const usePolar = selected.includes('polar');
    const useDub = selected.includes('dub');
    const useExpo = selected.includes('expo');
    const pluginImports = corePlugins.length ? `import { ${corePlugins.join(', ')} } from "better-auth/plugins";` : '';
    const extraImports = [];
    if (useSso) extraImports.push(`import { sso } from "@better-auth/sso";`);
    if (useStripe) extraImports.push(`import { stripe as stripePlugin } from "@better-auth/stripe";`, `import Stripe from "stripe";`);
    if (usePolar) extraImports.push(`import { polar } from "@polar-sh/better-auth";`, `import { Polar } from "@polar-sh/sdk";`);
    if (useDub) extraImports.push(`import { dubAnalytics } from "@dub/better-auth";`, `import { Dub } from "dub";`);
    if (useExpo) extraImports.push(`import { expo } from "@better-auth/expo";`);
    const pluginCalls = corePlugins.map(p => `${p}()`).join(', ');
    const socialProviders = [];
    if (wantsGithub) socialProviders.push(`github: { clientId: process.env.GITHUB_CLIENT_ID!, clientSecret: process.env.GITHUB_CLIENT_SECRET! }`);
    if (wantsGoogle) socialProviders.push(`google: { clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! }`);
    const importDb = isPg
      ? `import { Pool } from "pg";\n`
      : isMysql
        ? `import mysql from "mysql2/promise";\n`
        : ``;
    const dbLine = isPg
      ? `  database: new Pool({ connectionString: process.env.DATABASE_URL_DEV || process.env.DATABASE_URL_LOCAL || process.env.DATABASE_URL }),\n`
      : isMysql
        ? `  database: mysql.createPool(process.env.DATABASE_URL_DEV || process.env.DATABASE_URL_LOCAL || process.env.DATABASE_URL),\n`
        : ``;

    const extraPluginCalls = [];
    if (useSso) extraPluginCalls.push('sso()');
    if (useStripe) extraPluginCalls.push(`stripePlugin({ stripeClient: new Stripe(process.env.STRIPE_SECRET_KEY!), stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET! })`);
    if (usePolar) extraPluginCalls.push(`polar({ client: new Polar({ accessToken: process.env.POLAR_ACCESS_TOKEN }) })`);
    if (useDub) extraPluginCalls.push(`dubAnalytics({ dubClient: new Dub() })`);
    if (useExpo) extraPluginCalls.push('expo()');

    const allPluginCallsArr = [pluginCalls, ...extraPluginCalls].filter(Boolean);
    const allPluginCalls = allPluginCallsArr.join(', ');

    const emailImport = '';
    const emailVerificationBlock = '';

    const authTs = `// Auto-generated by astro-bp-cli — ajuste selon ton projet\n`+
`import { betterAuth } from "better-auth";\n${importDb}${pluginImports}${pluginImports && extraImports.length ? '\n' : ''}${extraImports.join('\n')}\n${emailImport}\n`+
`export const auth = betterAuth({\n`+
dbLine+
`${needsEmailPw ? `  emailAndPassword: { enabled: true },\n` : ''}`+
`${emailVerificationBlock}`+
`${socialProviders.length ? `  socialProviders: { ${socialProviders.join(', ')} },\n` : ''}`+
`${allPluginCalls ? `  plugins: [ ${allPluginCalls} ]\n` : ''}`+
`});\n`;
    fs.mkdirSync(path.dirname(authFile), { recursive: true });
    fs.writeFileSync(authFile, authTs, 'utf8');
  }

  if (devDb.adapter === 'prisma') {
    if (!dryRun) {
      const installPrisma = pm === 'pnpm'
        ? [`pnpm add @prisma/client`, `pnpm add -D prisma`]
        : [`npm install @prisma/client`, `npm install -D prisma`];
      for (const cmd of installPrisma) {
        const res = runCmd('prisma', cmd, projectPath);
        if (res.status !== 0) { console.error('Échec lors de l\'installation de Prisma.'); break; }
      }
    }
    const prismaDir = path.join(projectPath, 'prisma');
    const prismaSchema = path.join(prismaDir, 'schema.prisma');
    const isPg = ['postgres','neon','supabase'].includes(devDb.provider !== 'none' ? devDb.provider : localDb.provider);
    const isMysql = ['mysql','planetscale'].includes(devDb.provider !== 'none' ? devDb.provider : localDb.provider);
    const isSqlite = (devDb.provider !== 'none' ? devDb.provider : localDb.provider) === 'sqlite';
    const prismaProvider = isPg ? 'postgresql' : isMysql ? 'mysql' : isSqlite ? 'sqlite' : 'postgresql';
    fs.mkdirSync(prismaDir, { recursive: true });
    const schema = `generator client {\n  provider = \"prisma-client-js\"\n}\n\n`+
`datasource db {\n  provider = \"${prismaProvider}\"\n  url      = env(\"DATABASE_URL\")\n}\n\n// Ajoute tes modèles ici\n`;
    fs.writeFileSync(prismaSchema, schema, 'utf8');
    if (!dryRun) {
      const genCmd = pm === 'pnpm' ? `pnpm dlx prisma generate` : `npx prisma generate`;
      const genRes = runCmd('prisma generate', genCmd, projectPath);
      if (genRes.status !== 0) console.error('Prisma generate a échoué.');
    }
  } else if (devDb.adapter === 'drizzle') {
    if (!dryRun) {
      const cmd = pm === 'pnpm' ? `pnpm add drizzle-orm` : `npm install drizzle-orm`;
      const res = runCmd('drizzle-orm', cmd, projectPath);
      if (res.status !== 0) console.error("Échec lors de l'installation de drizzle-orm.");
      const dkCmd = pm === 'pnpm' ? `pnpm add -D drizzle-kit` : `npm install -D drizzle-kit`;
      const dkRes = runCmd('drizzle-kit', dkCmd, projectPath);
      if (dkRes.status !== 0) console.error("Échec lors de l'installation de drizzle-kit.");
    }
    const dialect = ['postgres','neon','supabase'].includes(devDb.provider !== 'none' ? devDb.provider : localDb.provider) ? 'postgresql' : ['mysql','planetscale'].includes(devDb.provider !== 'none' ? devDb.provider : localDb.provider) ? 'mysql' : 'sqlite';
    const drizzleCfg = `import { defineConfig } from \"drizzle-kit\";\n\nexport default defineConfig({\n  out: \"./drizzle\",\n  schema: \"./src/db/schema.ts\",\n  dialect: \"${dialect}\",\n  dbCredentials: {\n    url: process.env.DATABASE_URL!,\n  },\n});\n`;
    fs.writeFileSync(path.join(projectPath, 'drizzle.config.ts'), drizzleCfg, 'utf8');
    const schemaDir = path.join(projectPath, 'src', 'db');
    fs.mkdirSync(schemaDir, { recursive: true });
    const schemaTs = `// Schéma Drizzle minimal — ajoute tes tables ici\nexport {};\n`;
    fs.writeFileSync(path.join(schemaDir, 'schema.ts'), schemaTs, 'utf8');
  }

  const apiDir = path.join(projectPath, 'src', 'pages', 'api', 'auth');
  const apiCatchAll = path.join(apiDir, '[...all].ts');
  if (!fs.existsSync(apiCatchAll)) {
    fs.mkdirSync(apiDir, { recursive: true });
    const routeTs = `import type { APIRoute } from \"astro\";\nimport { auth } from \"../../../../auth\";\n\nexport const ALL: APIRoute = async (ctx) => {\n  return auth.handler(ctx.request);\n};\n`;
    fs.writeFileSync(apiCatchAll, routeTs, 'utf8');
  }

  const mwFile = path.join(projectPath, 'src', 'middleware.ts');
  if (!fs.existsSync(mwFile)) {
    const mwTs = `import { auth } from \"./auth\";\nimport { defineMiddleware } from \"astro:middleware\";\n\nexport const onRequest = defineMiddleware(async (context, next) => {\n  const session = await auth.api.getSession({ headers: context.request.headers });\n  if (session) {\n    context.locals.user = session.user;\n    context.locals.session = session.session;\n  } else {\n    context.locals.user = null;\n    context.locals.session = null;\n  }\n  return next();\n});\n`;
    fs.writeFileSync(mwFile, mwTs, 'utf8');
  }

  const clientDir = path.join(projectPath, 'src', 'lib');
  const clientFile = path.join(clientDir, 'auth-client.ts');
  if (!fs.existsSync(clientFile)) {
    fs.mkdirSync(clientDir, { recursive: true });
    const useSso = selected.includes('sso');
    const useStripe = selected.includes('stripe');
    const usePolar = selected.includes('polar');
    const clientImports = [`import { createAuthClient } from \"better-auth/client\";`];
    if (useSso) clientImports.push(`import { ssoClient } from \"@better-auth/sso/client\";`);
    if (useStripe) clientImports.push(`import { stripeClient } from \"@better-auth/stripe/client\";`);
    if (usePolar) clientImports.push(`import { polarClient } from \"@polar-sh/better-auth\";`);
    const clientPlugins = [];
    if (useSso) clientPlugins.push('ssoClient()');
    if (useStripe) clientPlugins.push('stripeClient({ subscription: true })');
    if (usePolar) clientPlugins.push('polarClient()');
    const clientTs = `${clientImports.join('\n')}\n`+
`export const authClient = createAuthClient({\n  ${clientPlugins.length ? `plugins: [ ${clientPlugins.join(', ')} ]` : ''}\n});\n`;
    fs.writeFileSync(clientFile, clientTs, 'utf8');
  }

  const envTypes = path.join(projectPath, 'src', 'env.d.ts');
  if (!fs.existsSync(envTypes)) {
    const envDts = `/// <reference path=\"../.astro/types.d.ts\" />\n\ndeclare namespace App {\n  interface Locals {\n    user: import(\"better-auth\").User | null;\n    session: import(\"better-auth\").Session | null;\n  }\n}\n`;
    fs.writeFileSync(envTypes, envDts, 'utf8');
  }

  // Email provider selection/install and util generation handled in main bin previously;
  // here we only return selections to be used by envFiles step.
  const emailChoices = [
    { title: 'Nodemailer (SMTP)', value: 'nodemailer' },
    { title: 'Resend', value: 'resend' },
    { title: 'Aucun (plus tard)', value: 'none' }
  ];
  let email;
  if (preset && typeof preset.email === 'string') {
    email = preset.email;
  } else {
    const prevEmail = prev?.last?.auth?.email || 'none';
    const emailAsk = await prompts(
      { type: 'select', name: 'email', message: 'Choisir un provider email', choices: emailChoices, initial: Math.max(0, emailChoices.findIndex(c => c.value === prevEmail)) },
      { onCancel }
    );
    email = emailAsk.email || 'none';
  }

  // install deps and generate util
  if (email === 'nodemailer') {
    const installMail = pm === 'pnpm' ? `pnpm add nodemailer` : `npm install nodemailer`;
    if (!dryRun) {
      runCmd('email (nodemailer)', installMail, projectPath);
      const installTypes = pm === 'pnpm' ? `pnpm add -D @types/nodemailer` : `npm install -D @types/nodemailer`;
      runCmd('types (nodemailer)', installTypes, projectPath);
    }
    const emailUtil = path.join(projectPath, 'src', 'lib', 'email.ts');
    if (!fs.existsSync(emailUtil)) {
      const src = `import nodemailer from \"nodemailer\";\n\nconst transporter = nodemailer.createTransport({\n  host: process.env.SMTP_HOST!,\n  port: Number(process.env.SMTP_PORT || 587),\n  secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',\n  auth: (process.env.SMTP_USER && process.env.SMTP_PASS) ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,\n});\n\nexport async function sendEmail({ to, subject, text, html }: { to: string; subject: string; text?: string; html?: string; }) {\n  await transporter.sendMail({ from: process.env.SMTP_FROM!, to, subject, text, html });\n}\n`;
      fs.mkdirSync(path.dirname(emailUtil), { recursive: true });
      fs.writeFileSync(emailUtil, src, 'utf8');
    }
  } else if (email === 'resend') {
    const installResend = pm === 'pnpm' ? `pnpm add resend` : `npm install resend`;
    if (!dryRun) runCmd('email (resend)', installResend, projectPath);
    const emailUtil = path.join(projectPath, 'src', 'lib', 'email.ts');
    if (!fs.existsSync(emailUtil)) {
      const src = `import { Resend } from \"resend\";\n\nconst resend = new Resend(process.env.RESEND_API_KEY);\n\nexport async function sendEmail({ to, subject, text, html }: { to: string; subject: string; text?: string; html?: string; }) {\n  await resend.emails.send({ from: process.env.RESEND_FROM!, to, subject, text, html });\n}\n`;
      fs.mkdirSync(path.dirname(emailUtil), { recursive: true });
      fs.writeFileSync(emailUtil, src, 'utf8');
    }
  }

  // Inject email verification into auth.ts only if we created it here and email selected
  if (!fs.existsSync(authFile) === false && email !== 'none') {
    // No-op: we didn't create auth.ts now; avoid risky in-place edit.
  }

  return { auth: { provider: 'better-auth', plugins: selected, email } };
}
