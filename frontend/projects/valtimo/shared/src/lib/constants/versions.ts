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

const FALLBACK_VERSION = 'unknown';
const VERSION_ASSET_URL = new URL('../../assets/core/version.json', import.meta.url);

const versionRef: {current: string} = {
  current: FALLBACK_VERSION,
};

if (typeof window !== 'undefined' && typeof fetch === 'function') {
  fetch(VERSION_ASSET_URL.href)
    .then((response) => (response.ok ? response.json() : undefined))
    .then((payload: {appVersion?: string} | undefined) => {
      const version = payload?.appVersion?.trim();

      if (version) {
        versionRef.current = version;
      }
    })
    .catch(() => {
      // ignore and retain fallback
    });
}

const VERSIONS: Versions = {
  get frontendLibraries() {
    return versionRef.current;
  },
} as Versions;

export {VERSIONS};
