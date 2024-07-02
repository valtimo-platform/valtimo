/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

const http = require('https');
const fs = require('fs');
const implPackageJsonPath = './package.json';
const libsPackageJsonPath = './tmp/libs-package.json';
const file = fs.createWriteStream(libsPackageJsonPath);
const parseLibsPackageJson = () => {
  fs.readFile(libsPackageJsonPath, 'utf8', (err, data) => {
    if (err) {
      console.error(err);
      return;
    }

    const parsedPackageJson = JSON.parse(data);
    const dependencies = parsedPackageJson?.dependencies;
    const devDependencies = parsedPackageJson?.devDependencies;
    let combinedDependencies = [];

    Object.keys(dependencies).forEach(name => {
      combinedDependencies.push({name, version: dependencies[name]});
    });

    Object.keys(devDependencies).forEach(name => {
      combinedDependencies.push({name, version: devDependencies[name]});
    });

    combinedDependencies = combinedDependencies.filter(
      dep => !!dep.name && !!dep.version && !dep.name.includes('valtimo')
    );

    parseImplPackageJson(combinedDependencies);
  });
};

const parseImplPackageJson = combinedDependencies => {
  fs.readFile(implPackageJsonPath, 'utf-8', (err, data) => {
    if (err) {
      console.error(err);
      return;
    }

    const parsedPackageJson = JSON.parse(data);
    const dependencies = parsedPackageJson?.dependencies;
    const devDependencies = parsedPackageJson?.devDependencies;

    combinedDependencies.forEach(dependency => {
      const depName = dependency.name;
      if (dependencies && dependencies[depName]) {
        dependencies[depName] = dependency.version;
      }
      if (devDependencies && devDependencies[depName]) {
        devDependencies[depName] = dependency.version;
      }
    });

    writeImplPackageJson(JSON.stringify(parsedPackageJson, null, 2));
  });
};

const writeImplPackageJson = data => {
  fs.writeFile(implPackageJsonPath, data, err => {
    if (err) console.log(err);
    console.log('Successfully updated dependencies in package.json.');
    cleanUp();
  });
};

const cleanUp = () => {
  fs.rmSync('tmp', {recursive: true, force: true}, () => {
    console.log('Removed temporary files');
  });
};

const fetchDeps = () =>
  http.get(
    // update link to raw Github content of latest major package.json
    'https://raw.githubusercontent.com/valtimo-platform/valtimo-frontend-libraries/12.0.0/package.json',
    function (response) {
      response.pipe(file);

      // after download completed close filestream
      file.on('finish', () => {
        console.log('finished downloading valtimo-frontend-libraries package.json');
        file.close();
        parseLibsPackageJson();
      });

      file.on('error', () => {
        console.log('error downloading valtimo-frontend-libraries package.json');
      });
    }
  );

fetchDeps();
