import path from 'node:path';
import { writeJSONSafe } from '../utils/json.js';

export function persist(cacheDir, runData) {
  const prefsPath = path.join(cacheDir, 'prefs.json');
  writeJSONSafe(path.join(cacheDir, 'answers.json'), runData);
  writeJSONSafe(prefsPath, { last: { packageManager: runData.packageManager, extras: runData.extras, iconSets: runData.iconSets, db: runData.db, auth: runData.auth } });
}
