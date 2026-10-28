// The service packages (../packages/*) and the apps built on them (../apps/*) sit outside this folder, so their imports
// (react, react-native, expo, ...) would not find this app's node_modules. Give each one a node_modules link to ours; it is
// git-ignored and made on every install. shortcut: the Tala app runs on the mobile app's node_modules until the repo
// moves to real workspaces (needed before an EAS build of apps/tala).
import { existsSync, readdirSync, symlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const modules = resolve(here, '../node_modules');

for (const folder of ['../../packages', '../../apps']) {
  const root = resolve(here, folder);
  if (!existsSync(root)) continue;
  for (const { name } of readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const link = join(root, name, 'node_modules');
    if (!existsSync(link)) symlinkSync(modules, link, 'dir');
  }
}
