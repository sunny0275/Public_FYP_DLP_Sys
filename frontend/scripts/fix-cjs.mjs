// Fix: Add package.json with type=module to dist-electron
// Both main.mjs and preload.mjs will be ES modules
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgJson = { type: 'module' };

try {
  mkdirSync(join(__dirname, 'dist-electron'), { recursive: true });
  writeFileSync(
    join(__dirname, 'dist-electron', 'package.json'),
    JSON.stringify(pkgJson, null, 2)
  );
  console.log('Created dist-electron/package.json with type=module');
} catch (e) {
  console.error('Failed to create dist-electron/package.json:', e.message);
}
