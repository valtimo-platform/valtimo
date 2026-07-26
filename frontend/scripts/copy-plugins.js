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
 * A plugin lives in a sibling checkout (`repo`) and publishes an npm package
 * (`pkg`). Most repos are named `<pkg-last-segment>-plugin`, but not all
 * (e.g. berichten-api → @valtimo-plugins/open-vtb), and a few packages already
 * end in `-plugin`, so the repo dir and package are listed explicitly rather
 * than derived. From each pair:
 *   name         = pkg's last segment without a trailing '-plugin'
 *                  → served at /assets/plugins/<name>/ (must match BUILT_IN_PLUGINS)
 *   remoteSubdir = 'remote'  (the remote bundle folder inside the published package)
 *   dist         = '<repo>/frontend/dist/remote'  (sibling checkout, dev)
 */
const PLUGIN_REPOS = [
  // [sibling checkout dir, published npm package]
  ['freemarker-plugin', '@valtimo-plugins/freemarker'],
  ['smtpmail-plugin', '@valtimo-plugins/smtpmail'],
  ['archief-plugin', '@valtimo-plugins/archief'],
  ['berichten-api', '@valtimo-plugins/open-vtb'],
  ['cloud-event-plugin', '@valtimo-plugins/cloud-event'],
  ['externe-klanttaak-plugin', '@valtimo-plugins/externe-klanttaak'],
  ['graph-mail-plugin', '@valtimo-plugins/graph-mail'],
  ['haal-centraal-plugin', '@valtimo-plugins/haal-centraal'],
  ['haal-centraal-auth-plugin', '@valtimo-plugins/haal-centraal-auth'],
  ['hasura-plugin', '@valtimo-plugins/hasura-plugin'],
  ['kvk-handelsregister-plugin', '@valtimo-plugins/kvk-handelsregister'],
  ['lrk-import-plugin', '@valtimo-plugins/lrk-import-plugin'],
  ['mtls-sslcontext-plugin', '@valtimo-plugins/mtls-sslcontext'],
  ['notify-nl-plugin', '@valtimo-plugins/notify-nl'],
  ['open-product-plugin', '@valtimo-plugins/open-product'],
  ['openklant-plugin', '@valtimo-plugins/openklant'],
  ['publictask-plugin', '@valtimo-plugins/publictask'],
  ['samenwerkfunctionaliteit-plugin', '@valtimo-plugins/samenwerkfunctionaliteit-plugin'],
  ['slack-plugin', '@valtimo-plugins/slack'],
  ['socrates-plugin', '@valtimo-plugins/socrates'],
  ['spotler-plugin', '@valtimo-plugins/spotler'],
  ['suwinet-plugin', '@valtimo-plugins/suwinet'],
  ['suwinet-auth-plugin', '@valtimo-plugins/suwinet-auth'],
  ['token-authentication-plugin', '@valtimo-plugins/token-authentication'],
  ['valtimo-llm-plugin', '@valtimo-plugins/valtimo-llm'],
  ['valtimo-ocr-plugin', '@valtimo-plugins/valtimo-ocr'],
  ['value-mapper-plugin', '@valtimo-plugins/value-mapper'],
  ['xential-plugin', '@valtimo-plugins/xential'],
];

const PLUGINS = PLUGIN_REPOS.map(([repo, pkg]) => {
  const name = pkg.split('/').pop().replace(/-plugin$/, '');
  return {name, pkg, remoteSubdir: 'remote', dist: `${repo}/frontend/dist/remote`};
});

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
