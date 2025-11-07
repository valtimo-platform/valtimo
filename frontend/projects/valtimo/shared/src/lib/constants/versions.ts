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

import {Versions} from '../models';

async function getLibVersion() {
  let version = 'unknown';
  try {
    const VERSION_ASSET_URL = '/valtimo-translation/version.json';
    const versionRes = await fetch(VERSION_ASSET_URL);
    const versionJson = await versionRes.json();
    version = versionJson.appVersion;
  } catch (err) {
    console.error(err);
  }
  return version;
}

const VERSIONS: Versions = {
  frontendLibraries: 'unknown',
} as Versions;

getLibVersion().then(version => (VERSIONS.frontendLibraries = version));

export {VERSIONS};
