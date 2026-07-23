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
 * The plugin remotes are built in separate sibling repositories and are NOT
 * part of this monorepo's build graph, so their bundles are copied in here as
 * generated output (the target folders are git-ignored).
 *
 * Source repos are resolved relative to this repo's parent directory by
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

/** name = folder served under /assets/plugins/<name>; dist = built remote path. */
const PLUGINS = [
  {name: 'freemarker', dist: 'freemarker-plugin/frontend/dist/freemarker-extension'},
  {name: 'smtpmail', dist: 'smtpmail-plugin/frontend/dist/smtpmail-remote'},
];

const APPS = ['dev', 'gzac', 'valtimo', 'evenementenvergunning'];

let copied = 0;
let missing = 0;

for (const plugin of PLUGINS) {
  const source = path.resolve(pluginsRoot, plugin.dist);
  if (!fs.existsSync(path.join(source, 'remoteEntry.json'))) {
    console.warn(
      `⚠ Skipping '${plugin.name}': no remoteEntry.json at ${source}\n` +
        `  Build the plugin frontend first (npm run build in the plugin repo), ` +
        `or set PLUGINS_ROOT to its checkout location.`
    );
    missing++;
    continue;
  }

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
