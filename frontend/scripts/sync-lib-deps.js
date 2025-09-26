/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

const fs = require('fs');
const path = require('path');

const rootPackageJsonPath = path.resolve(__dirname, '../package.json');
const libsRoot = path.resolve(__dirname, '../projects/valtimo');

const rootPkg = JSON.parse(fs.readFileSync(rootPackageJsonPath, 'utf8'));
const rootDeps = {...rootPkg.dependencies, ...rootPkg.devDependencies};

function syncSection(section, libPkg) {
  if (!libPkg[section]) return false;
  let updated = false;

  Object.entries(libPkg[section]).forEach(([dep, version]) => {
    if (rootDeps[dep]) {
      if (libPkg[section][dep] !== rootDeps[dep]) {
        console.log(`Updating ${dep} in ${section} to version ${rootDeps[dep]}`);
        libPkg[section][dep] = rootDeps[dep];
        updated = true;
      }
    } else {
      console.log(`Adding missing ${dep}@${version} to root`);
      rootPkg.dependencies = rootPkg.dependencies || {};
      rootPkg.dependencies[dep] = version;
      rootDeps[dep] = version;
      updated = true;
    }
  });

  return updated;
}

fs.readdirSync(libsRoot).forEach(libFolder => {
  const libPath = path.join(libsRoot, libFolder);
  const libPkgPath = path.join(libPath, 'package.json');

  if (fs.existsSync(libPkgPath)) {
    const libPkg = JSON.parse(fs.readFileSync(libPkgPath, 'utf8'));

    let changed = false;
    changed |= syncSection('dependencies', libPkg);
    changed |= syncSection('peerDependencies', libPkg);

    if (changed) {
      fs.writeFileSync(libPkgPath, JSON.stringify(libPkg, null, 2));
      console.log(`Updated ${libPkg.name}`);
    }
  }
});

fs.writeFileSync(rootPackageJsonPath, JSON.stringify(rootPkg, null, 2));
console.log('Root package.json synced');
