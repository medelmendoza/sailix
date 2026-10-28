// The service packages (../packages/*) sit outside this folder, so their imports (react, react-native, ...) would not
// find this app's node_modules. Give each one a node_modules link to ours; it is git-ignored and made on every install.
import { existsSync, readdirSync, symlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const modules = resolve(here, '../node_modules');
const packages = resolve(here, '../../packages');

if (existsSync(packages)) {
  for (const name of readdirSync(packages)) {
    const link = join(packages, name, 'node_modules');
    if (!existsSync(link)) symlinkSync(modules, link, 'dir');
  }
}
