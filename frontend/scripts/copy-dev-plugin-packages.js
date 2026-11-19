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

// Makes npm plugin packages usable in local dev (npm start), where the
// @valtimo/* libraries are path-mapped to their sources in projects/valtimo/*.
//
// A published plugin package imports '@valtimo/plugin' (and other libs) as bare
// specifiers. From inside node_modules those resolve to the workspace links in
// node_modules/@valtimo/*, which point at source folders without an entry
// point, because the bundler does not apply tsconfig paths to node_modules.
// A copy outside node_modules does get the path mappings, so the plugin binds
// to the same library sources as the app: one instance of each library.
// tsconfig.json maps each package below to its copy in dev-plugin-packages/;
// release builds (tsconfig.app.prod.json) resolve them from node_modules.

const fs = require('fs');
const path = require('path');

const DEV_PLUGIN_PACKAGES = ['@epistola.app/valtimo-plugin'];

const frontendRoot = path.resolve(__dirname, '..');
const targetRoot = path.join(frontendRoot, 'dev-plugin-packages');

DEV_PLUGIN_PACKAGES.forEach(name => {
  const source = path.join(frontendRoot, 'node_modules', name);
  const target = path.join(targetRoot, name);

  if (!fs.existsSync(source)) {
    console.warn(`copy-dev-plugin-packages: ${name} is not installed, skipping`);
    return;
  }

  fs.rmSync(target, {recursive: true, force: true});
  fs.cpSync(source, target, {recursive: true});
  console.log(`copy-dev-plugin-packages: ${name} -> dev-plugin-packages/${name}`);
});
