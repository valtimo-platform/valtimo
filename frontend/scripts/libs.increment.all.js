/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
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
const exec = require('child_process');
const path = require('path');

const projectVersion = process.argv.slice(2)[0];
if (!projectVersion) throw 'Not a valid project version';

const libDir = './projects/valtimo';
fs.readdirSync(libDir).forEach(dir => {
  let cwd = process.cwd();
  process.chdir(path.resolve(`${libDir}/${dir}`));
  exec.execSync(`npm --no-git-tag-version --allow-same-version version ${projectVersion}`);
  process.chdir(cwd);
});

updateGradleProperties();

const distDir = './dist/valtimo';
fs.readdirSync(distDir).forEach(dir => {
  let cwd = process.cwd();
  process.chdir(path.resolve(`${distDir}/${dir}`));
  copyPackageJson();
  process.chdir(cwd);
});

console.log('Updated all versions');

function updateGradleProperties() {
  const gradleProperties = fs.readFileSync('./gradle.properties', 'utf-8');
  const replacedProperties = gradleProperties.replace(/(?<=projectVersion=).*/, projectVersion);
  fs.writeFileSync('./gradle.properties', replacedProperties, 'utf-8');
}

function copyPackageJson() {
  const packageJson = fs.readFileSync('./package.json', 'utf-8');
  const replacedPackageJson = packageJson.replace(/(?<="version": ).*/, `"${projectVersion}",`);
  fs.writeFileSync('./package.json', replacedPackageJson, 'utf-8');
}
