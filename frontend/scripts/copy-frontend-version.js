/*
 * Copyright 2015-2023 Ritense BV, the Netherlands.
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

const fsPromises = require('fs').promises;

let version;

fsPromises
  .readFile('./dist/valtimo/config/package.json', 'utf8')
  .then(packageJsonString => {
    const packageJson = JSON.parse(packageJsonString);

    if (packageJson.version) {
      version = packageJson.version;
      return fsPromises.readFile('./projects/valtimo/config/src/lib/constants/versions.ts', 'utf8');
    }
  })
  .then(versionsConstantJsonString => {
    if (versionsConstantJsonString) {
      const keyIndex = versionsConstantJsonString.indexOf('frontendLibraries');
      const openQuote = versionsConstantJsonString.indexOf("'", keyIndex);
      const closeQuote = versionsConstantJsonString.indexOf("'", openQuote + 1);
      const toReplace = versionsConstantJsonString.substring(openQuote + 1, closeQuote);
      const newString = versionsConstantJsonString.replace(toReplace, version);
      return fsPromises.writeFile(
        './projects/valtimo/config/src/lib/constants/versions.ts',
        newString,
        'utf-8'
      );
    }
  })
  .then(() => {
    console.log(
      `success: copy version from @valtimo/config package.json to versions.ts: ${version}`
    );
  })
  .catch(() => {
    console.log('error: reading/writing version');
  });
