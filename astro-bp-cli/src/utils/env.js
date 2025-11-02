import fs from 'node:fs';
import path from 'node:path';

export function upsertEnvBlock(filePath, blockName, lines) {
  const begin = `# BEGIN astro-bp-cli ${blockName}`;
  const end = `# END astro-bp-cli ${blockName}`;
  const block = [begin, ...lines, end].join('\n') + '\n';
  let content = '';
  if (fs.existsSync(filePath)) {
    content = fs.readFileSync(filePath, 'utf8');
    const re = new RegExp(`# BEGIN astro-bp-cli ${blockName}[\\s\\S]*?# END astro-bp-cli ${blockName}\n?`, 'g');
    content = content.replace(re, '');
    if (content.length && !content.endsWith('\n')) content += '\n';
  } else {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }
  content += block;
  fs.writeFileSync(filePath, content, 'utf8');
}

export function removeEnvBlock(filePath, blockName) {
  if (!fs.existsSync(filePath)) return;
  const begin = `# BEGIN astro-bp-cli ${blockName}`;
  const end = `# END astro-bp-cli ${blockName}`;
  const re = new RegExp(`${begin}[\n\r\s\S]*?${end}\n?`, 'g');
  const content = fs.readFileSync(filePath, 'utf8');
  const next = content.replace(re, '').replace(/\n+$/, '\n');
  fs.writeFileSync(filePath, next, 'utf8');
}
