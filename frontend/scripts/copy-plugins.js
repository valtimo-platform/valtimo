/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Provisions the Native Federation plugin remotes into each app's
 * `src/assets/plugins/<name>/` folder so the dev server / build serves their
 * `remoteEntry.json` as a static asset (see BUILT_IN_PLUGINS in each app).
 *
 * Each remote is resolved from the first source that has a `remoteEntry.json`:
 *   1. a sibling plugin checkout (`dist`) — for plugin developers building locally;
 *   2. the plugin's published npm package (`pkg`/`remoteSubdir`) in node_modules —
 *      for consumers who have no access to the plugin source and cannot build it,
 *      but always have the published package available.
 * The published `@valtimo-plugins/*` package ships the prebuilt remote under a
 * subfolder (see the plugin repo's bundle-remote-into-lib step), so the same
 * package serves both compile-time imports and this runtime remote.
 *
 * The target folders are git-ignored (generated output).
 *
 * Sibling checkouts are resolved relative to this repo's parent directory by
 * default; override with the PLUGINS_ROOT environment variable, e.g.
 *   PLUGINS_ROOT=/path/to/checkouts node scripts/copy-plugins.js
 */
const fs = require('fs');
const path = require('path');

const frontendDir = path.resolve(__dirname, '..');
const repoDir = path.resolve(frontendDir, '..');
// Sibling checkouts live next to this repo by default (…/Projects/valtimo2 →
// …/Projects). Override the search root with PLUGINS_ROOT.
const pluginsRoot = process.env.PLUGINS_ROOT
  ? path.resolve(process.env.PLUGINS_ROOT)
  : path.resolve(repoDir, '..');

/**
 * name        = folder served under /assets/plugins/<name>;
 * dist        = built remote path in a sibling checkout (preferred when present);
 * pkg         = published npm package name (fallback when no sibling checkout);
 * remoteSubdir= subfolder inside that package holding the remote (default 'remote').
 */
const PLUGINS = [
  {
    name: 'freemarker',
    dist: 'freemarker-plugin/frontend/dist/freemarker-remote',
    pkg: '@valtimo-plugins/freemarker',
    remoteSubdir: 'remote',
  },
  {
    name: 'smtpmail',
    dist: 'smtpmail-plugin/frontend/dist/smtpmail-remote',
    pkg: '@valtimo-plugins/smtpmail',
    remoteSubdir: 'remote',
  },
];

const APPS = ['dev', 'gzac', 'valtimo', 'evenementenvergunning'];

const hasRemoteEntry = dir => !!dir && fs.existsSync(path.join(dir, 'remoteEntry.json'));

/** Resolve a plugin's remote directory: sibling checkout first, then node_modules. */
function resolveSource(plugin) {
  if (plugin.dist) {
    const sibling = path.resolve(pluginsRoot, plugin.dist);
    if (hasRemoteEntry(sibling)) return {dir: sibling, origin: 'sibling checkout'};
  }
  if (plugin.pkg) {
    const nm = path.join(frontendDir, 'node_modules', plugin.pkg, plugin.remoteSubdir || 'remote');
    if (hasRemoteEntry(nm)) return {dir: nm, origin: `node_modules/${plugin.pkg}`};
  }
  return null;
}

let copied = 0;
let missing = 0;

for (const plugin of PLUGINS) {
  const resolved = resolveSource(plugin);
  if (!resolved) {
    const from = [
      plugin.dist && path.resolve(pluginsRoot, plugin.dist),
      plugin.pkg && `node_modules/${plugin.pkg}/${plugin.remoteSubdir || 'remote'}`,
    ]
      .filter(Boolean)
      .join('\n    or ');
    console.warn(
      `⚠ Skipping '${plugin.name}': no remoteEntry.json found.\n    Looked in: ${from}\n` +
        `  Build the plugin (npm run build in its repo) or install its npm package.`
    );
    missing++;
    continue;
  }

  const source = resolved.dir;
  console.log(`• ${plugin.name}: using ${resolved.origin}`);

  for (const app of APPS) {
    const appDir = path.resolve(frontendDir, 'apps', app);
    if (!fs.existsSync(appDir)) continue;
    const target = path.resolve(appDir, 'src/assets/plugins', plugin.name);
    fs.rmSync(target, {recursive: true, force: true});
    fs.cpSync(source, target, {recursive: true});
    console.log(`✔ ${plugin.name} → apps/${app}/src/assets/plugins/${plugin.name}`);
    copied++;
  }
}

if (copied === 0) {
  console.error('No plugin bundles were copied. See warnings above.');
  process.exitCode = missing > 0 ? 1 : 0;
}
