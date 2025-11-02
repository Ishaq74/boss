import { spawnSync } from 'node:child_process';

export function runCmd(title, cmd, cwd, opts = {}) {
  const globalSilent = String(process.env.ASTRO_BP_SILENT || '').toLowerCase() === '1' || String(process.env.ASTRO_BP_SILENT || '').toLowerCase() === 'true';
  const where = cwd ? ` (cd ${cwd})` : '';
  const lower = `${title} ${cmd}`.toLowerCase();
  const isInteractive = lower.includes('create astro@latest') || lower.includes('astro add ');
  let shouldEcho;
  if (typeof opts.echo === 'boolean') shouldEcho = opts.echo;
  else shouldEcho = !isInteractive; // auto: hide echo for interactive wizards
  if (globalSilent) shouldEcho = false; // global override if provided

  if (shouldEcho) {
    console.log(`\n> ${title}:${where}\n$ ${cmd}`);
  }
  const res = spawnSync(cmd, { stdio: 'inherit', shell: true, cwd });
  if (res.error) {
    console.error(`✖ ${title} — erreur:`, res.error.message);
  }
  return res;
}

export function hasPnpm() {
  const cmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const res = spawnSync(cmd, ['--version'], { stdio: 'ignore' });
  return res.status === 0;
}
