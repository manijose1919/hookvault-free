import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Read the package version once at module load so every layer can report a
// consistent build identifier without re-reading the file.

const pkgPath = fileURLToPath(new URL('../../package.json', import.meta.url));
export const VERSION = JSON.parse(readFileSync(pkgPath, 'utf8')).version;
