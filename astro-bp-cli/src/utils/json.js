import fs from 'node:fs';
import path from 'node:path';

export function readJSONSafe(file) {
  try {
    if (fs.existsSync(file)) {
      const txt = fs.readFileSync(file, 'utf8');
      return JSON.parse(txt);
    }
  } catch {}
  return null;
}

export function writeJSONSafe(file, data) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch {}
}
