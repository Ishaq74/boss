import fs from 'node:fs';
import path from 'node:path';

export function ensureAliases(projectPath) {
  try {
    for (const dir of ['src/lib', 'src/components', 'src/layouts']) {
      fs.mkdirSync(path.join(projectPath, dir), { recursive: true });
    }

    const tsconfigPath = path.join(projectPath, 'tsconfig.json');
    const jsconfigPath = path.join(projectPath, 'jsconfig.json');
    const configPath = fs.existsSync(tsconfigPath) ? tsconfigPath : jsconfigPath;
    const ensureConfig = (p) => {
      let cfg = {};
      if (fs.existsSync(p)) {
        try { cfg = JSON.parse(fs.readFileSync(p, 'utf8')); } catch {}
      }
      cfg.compilerOptions = cfg.compilerOptions || {};
      cfg.compilerOptions.baseUrl = cfg.compilerOptions.baseUrl || '.';
      const paths = cfg.compilerOptions.paths || {};
      paths['@src/*'] = ['src/*'];
      paths['@lib/*'] = ['src/lib/*'];
      paths['@components/*'] = ['src/components/*'];
      paths['@layouts/*'] = ['src/layouts/*'];
      cfg.compilerOptions.paths = paths;
      fs.writeFileSync(p, JSON.stringify(cfg, null, 2), 'utf8');
    };
    if (configPath) ensureConfig(configPath); else ensureConfig(tsconfigPath);

    const astroFiles = ['astro.config.mjs', 'astro.config.ts', 'astro.config.js']
      .map((f) => path.join(projectPath, f))
      .filter((p) => fs.existsSync(p));
    if (astroFiles.length) {
      const af = astroFiles[0];
      let s = fs.readFileSync(af, 'utf8');
      if (!s.includes('alias:')) {
        s = s.replace(/defineConfig\(\{/, (m) => `${m}\n  alias: {\n    '@src': './src',\n    '@lib': './src/lib',\n    '@components': './src/components',\n    '@layouts': './src/layouts'\n  },`);
        fs.writeFileSync(af, s, 'utf8');
      }
    }
  } catch (e) {
    console.warn('Alias TS/Astro: configuration ignorée (non bloquant):', e?.message || e);
  }
}
