import fs from 'node:fs';
import path from 'node:path';
import prompts from 'prompts';
import { upsertEnvBlock, removeEnvBlock } from '../utils/env.js';

export async function writeEnvFiles(projectPath, devDb, localDb, auth, onCancel, opts = {}) {
  const envPath = path.join(projectPath, '.env');
  const envExamplePath = path.join(projectPath, '.env.example');
  if (!fs.existsSync(envPath)) fs.writeFileSync(envPath, '', 'utf8');
  if (!fs.existsSync(envExamplePath)) fs.writeFileSync(envExamplePath, '', 'utf8');

  const anyDbSelected = devDb.provider !== 'none' || localDb.provider !== 'none';
  if (anyDbSelected) {
    let enteredNow = false;
    if (!opts.nonInteractive) {
      const enterDbNow = await prompts(
        {
          type: 'toggle',
          name: 'enterNow',
          message: 'Saisir maintenant les URLs de base de données ?',
          initial: false,
          active: 'Oui',
          inactive: 'Plus tard'
        },
        { onCancel }
      );
      enteredNow = !!enterDbNow.enterNow;
    }

    const placeholderFor = (provider, isLocal) => {
      switch (provider) {
        case 'sqlite':
          return isLocal ? 'file:./local.db' : 'file:./dev.db';
        case 'mysql':
        case 'planetscale':
          return 'mysql://user:pass@host:3306/dbname';
        case 'neon':
        case 'postgres':
        case 'supabase':
          return 'postgres://user:pass@host:5432/dbname';
        default:
          return '';
      }
    };

    let devUrl = placeholderFor(devDb.provider, false) || '';
    let localUrl = placeholderFor(localDb.provider, true) || '';

    if (enteredNow) {
      const fields = [];
      if (devDb.provider !== 'none') {
        fields.push({ type: 'text', name: 'dev', message: `DATABASE_URL_DEV (${devDb.provider})`, initial: devUrl || undefined });
      }
      if (localDb.provider !== 'none') {
        fields.push({ type: 'text', name: 'local', message: `DATABASE_URL_LOCAL (${localDb.provider})`, initial: localUrl || undefined });
      }
      const resp = await prompts(fields, { onCancel });
      if (resp && typeof resp.dev === 'string') devUrl = resp.dev;
      if (resp && typeof resp.local === 'string') localUrl = resp.local;
    }

    const dbLines = [];
    const dbExampleLines = [];
    if (devDb.provider !== 'none') {
      dbLines.push(`# Provider (dev): ${devDb.provider} — Adapter: ${devDb.adapter}`);
      dbLines.push(`DATABASE_URL_DEV=${(enteredNow && devUrl) ? devUrl : '__REPLACE_ME__'}`);
      dbExampleLines.push(`# Provider (dev): ${devDb.provider} — Adapter: ${devDb.adapter}`);
      dbExampleLines.push('DATABASE_URL_DEV=__REPLACE_ME__');
    }
    if (localDb.provider !== 'none') {
      dbLines.push(`# Provider (local): ${localDb.provider} — Adapter: ${localDb.adapter}`);
      dbLines.push(`DATABASE_URL_LOCAL=${(enteredNow && localUrl) ? localUrl : '__REPLACE_ME__'}`);
      dbExampleLines.push(`# Provider (local): ${localDb.provider} — Adapter: ${localDb.adapter}`);
      dbExampleLines.push('DATABASE_URL_LOCAL=__REPLACE_ME__');
    }

    if (dbLines.length) {
      const preferDev = devDb.provider !== 'none';
      const effectiveUrl = preferDev ? (devUrl || '__REPLACE_ME__') : (localUrl || '__REPLACE_ME__');
      dbLines.push(`DATABASE_URL=${effectiveUrl}`);
      dbExampleLines.push('DATABASE_URL=__REPLACE_ME__');

      upsertEnvBlock(envPath, 'DB', dbLines);
      upsertEnvBlock(envExamplePath, 'DB', dbExampleLines);
    } else {
      removeEnvBlock(envPath, 'DB');
      removeEnvBlock(envExamplePath, 'DB');
    }
  } else {
    removeEnvBlock(envPath, 'DB');
    removeEnvBlock(envExamplePath, 'DB');
  }

  if (auth.provider === 'better-auth') {
    removeEnvBlock(envPath, 'AUTH');
    removeEnvBlock(envExamplePath, 'AUTH');
    let secret = '';
    if (!opts.nonInteractive) {
      const enterNow = await prompts(
        {
          type: 'toggle',
          name: 'enterNow',
          message: 'Saisir maintenant le secret Better Auth ?',
          initial: false,
          active: 'Oui',
          inactive: 'Plus tard'
        },
        { onCancel }
      );
      if (enterNow.enterNow) {
        const s = await prompts({ type: 'password', name: 'secret', message: 'BETTER_AUTH_SECRET' }, { onCancel });
        if (s?.secret) secret = s.secret;
      }
    }
    const pluginsCsv = (auth.plugins || []).join(',');
    const oauthEnvLinesExample = [];
    const oauthEnvLinesActual = [];
    if (auth.plugins?.includes('oauth-github')) {
      oauthEnvLinesExample.push('GITHUB_CLIENT_ID=__REPLACE_ME__', 'GITHUB_CLIENT_SECRET=__REPLACE_ME__');
      oauthEnvLinesActual.push('GITHUB_CLIENT_ID=__REPLACE_ME__', 'GITHUB_CLIENT_SECRET=__REPLACE_ME__');
    }
    if (auth.plugins?.includes('oauth-google')) {
      oauthEnvLinesExample.push('GOOGLE_CLIENT_ID=__REPLACE_ME__', 'GOOGLE_CLIENT_SECRET=__REPLACE_ME__');
      oauthEnvLinesActual.push('GOOGLE_CLIENT_ID=__REPLACE_ME__', 'GOOGLE_CLIENT_SECRET=__REPLACE_ME__');
    }
    if (auth.plugins?.includes('stripe')) {
      oauthEnvLinesExample.push('STRIPE_SECRET_KEY=__REPLACE_ME__', 'STRIPE_WEBHOOK_SECRET=__REPLACE_ME__');
      oauthEnvLinesActual.push('STRIPE_SECRET_KEY=__REPLACE_ME__', 'STRIPE_WEBHOOK_SECRET=__REPLACE_ME__');
    }
    if (auth.plugins?.includes('polar')) {
      oauthEnvLinesExample.push('POLAR_ACCESS_TOKEN=__REPLACE_ME__');
      oauthEnvLinesActual.push('POLAR_ACCESS_TOKEN=__REPLACE_ME__');
    }
    const betterAuthUrl = 'http://localhost:4321';

    const emailEnvExample = [];
    const emailEnvActual = [];
    if (auth.email === 'nodemailer') {
      let SMTP_HOST = '', SMTP_PORT = '', SMTP_SECURE = '', SMTP_USER = '', SMTP_PASS = '', SMTP_FROM = '';
      if (!opts.nonInteractive) {
        const enterSmtpNow = await prompts(
          {
            type: 'toggle',
            name: 'enterNow',
            message: 'Saisir maintenant la configuration SMTP (Nodemailer) ?',
            initial: false,
            active: 'Oui',
            inactive: 'Plus tard'
          },
          { onCancel }
        );
        if (enterSmtpNow.enterNow) {
          const smtp = await prompts([
            { type: 'text', name: 'host', message: 'SMTP_HOST' },
            { type: 'text', name: 'port', message: 'SMTP_PORT', initial: '587' },
            { type: 'toggle', name: 'secure', message: 'SMTP_SECURE (TLS/SSL) ?', initial: false, active: 'true', inactive: 'false' },
            { type: 'text', name: 'user', message: 'SMTP_USER' },
            { type: 'password', name: 'pass', message: 'SMTP_PASS' },
            { type: 'text', name: 'from', message: 'SMTP_FROM (ex: "App <no-reply@example.com>")' }
          ], { onCancel });
          SMTP_HOST = smtp?.host || '';
          SMTP_PORT = smtp?.port || '';
          SMTP_SECURE = String(smtp?.secure ?? '').toLowerCase() === 'true' ? 'true' : (smtp?.secure === 'true' ? 'true' : (smtp?.secure === true ? 'true' : 'false'));
          SMTP_USER = smtp?.user || '';
          SMTP_PASS = smtp?.pass || '';
          SMTP_FROM = smtp?.from || '';
        }
      }
      emailEnvExample.push('SMTP_HOST=__REPLACE_ME__','SMTP_PORT=__REPLACE_ME__','SMTP_SECURE=false','SMTP_USER=__REPLACE_ME__','SMTP_PASS=__REPLACE_ME__','SMTP_FROM=__REPLACE_ME__');
      emailEnvActual.push(
        `SMTP_HOST=${SMTP_HOST || '__REPLACE_ME__'}`,
        `SMTP_PORT=${SMTP_PORT || '__REPLACE_ME__'}`,
        `SMTP_SECURE=${SMTP_SECURE || 'false'}`,
        `SMTP_USER=${SMTP_USER || '__REPLACE_ME__'}`,
        `SMTP_PASS=${SMTP_PASS || '__REPLACE_ME__'}`,
        `SMTP_FROM=${SMTP_FROM || '__REPLACE_ME__'}`
      );
    } else if (auth.email === 'resend') {
      let RESEND_API_KEY = '', RESEND_FROM = '';
      if (!opts.nonInteractive) {
        const enterResendNow = await prompts(
          {
            type: 'toggle',
            name: 'enterNow',
            message: 'Saisir maintenant la clé API Resend ?',
            initial: false,
            active: 'Oui',
            inactive: 'Plus tard'
          },
          { onCancel }
        );
        if (enterResendNow.enterNow) {
          const r = await prompts([
            { type: 'password', name: 'key', message: 'RESEND_API_KEY' },
            { type: 'text', name: 'from', message: 'RESEND_FROM (ex: "App <no-reply@example.com>")' }
          ], { onCancel });
          RESEND_API_KEY = r?.key || '';
          RESEND_FROM = r?.from || '';
        }
      }
      emailEnvExample.push('RESEND_API_KEY=__REPLACE_ME__','RESEND_FROM=__REPLACE_ME__');
      emailEnvActual.push(
        `RESEND_API_KEY=${RESEND_API_KEY || '__REPLACE_ME__'}`,
        `RESEND_FROM=${RESEND_FROM || '__REPLACE_ME__'}`
      );
    }

    upsertEnvBlock(envExamplePath, 'AUTH_BETTER', [
      'BETTER_AUTH_ENABLED=true',
      'BETTER_AUTH_PLUGINS=admin,organization',
      'BETTER_AUTH_SECRET=__REPLACE_ME__',
      `BETTER_AUTH_URL=${betterAuthUrl}`,
      ...oauthEnvLinesExample,
      ...emailEnvExample
    ]);
    upsertEnvBlock(envPath, 'AUTH_BETTER', [
      'BETTER_AUTH_ENABLED=true',
      `BETTER_AUTH_PLUGINS=${pluginsCsv}`,
      `BETTER_AUTH_SECRET=${secret ? secret : '__REPLACE_ME__'}`,
      `BETTER_AUTH_URL=${betterAuthUrl}`,
      ...oauthEnvLinesActual,
      ...emailEnvActual
    ]);
  }

  if (auth.provider === 'supabase') {
    removeEnvBlock(envPath, 'AUTH_BETTER');
    removeEnvBlock(envExamplePath, 'AUTH_BETTER');
    let authEntered = false;
    let supabaseUrl = '';
    let supabaseAnon = '';
    let supabaseService = '';
    if (!opts.nonInteractive) {
      const enterAuthNow = await prompts(
        {
          type: 'toggle',
          name: 'enterAuthNow',
          message: 'Saisir maintenant les secrets Supabase (URL, ANON KEY, SERVICE ROLE) ?',
          initial: false,
          active: 'Oui',
          inactive: 'Plus tard'
        },
        { onCancel }
      );
      authEntered = !!enterAuthNow.enterAuthNow;
    }
    if (authEntered) {
      const a = await prompts(
        [
          { type: 'text', name: 'url', message: 'SUPABASE_URL', initial: undefined },
          { type: 'password', name: 'anon', message: 'SUPABASE_ANON_KEY', initial: undefined },
          { type: 'password', name: 'service', message: 'SUPABASE_SERVICE_ROLE_KEY', initial: undefined }
        ],
        { onCancel }
      );
      if (a?.url) supabaseUrl = a.url;
      if (a?.anon) supabaseAnon = a.anon;
      if (a?.service) supabaseService = a.service;
    }

    upsertEnvBlock(envExamplePath, 'AUTH', [
      'SUPABASE_URL=__REPLACE_ME__',
      'SUPABASE_ANON_KEY=__REPLACE_ME__',
      'SUPABASE_SERVICE_ROLE_KEY=__REPLACE_ME__'
    ]);
    upsertEnvBlock(envPath, 'AUTH', [
      `SUPABASE_URL=${authEntered && supabaseUrl ? supabaseUrl : '__REPLACE_ME__'}`,
      `SUPABASE_ANON_KEY=${authEntered && supabaseAnon ? supabaseAnon : '__REPLACE_ME__'}`,
      `SUPABASE_SERVICE_ROLE_KEY=${authEntered && supabaseService ? supabaseService : '__REPLACE_ME__'}`
    ]);
  }
}
