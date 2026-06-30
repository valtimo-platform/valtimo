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

import {generateId} from '../../../../utils/dataGenerator';

/**
 * Shared prefix for every server title created by this suite. Used both to
 * build readable, unique titles and to find leftover servers during cleanup.
 */
export const IKO_SERVER_TITLE_PREFIX = 'E2E IKO Server';

export const ikoServerConfig = {
  titlePrefix: IKO_SERVER_TITLE_PREFIX,
  serverUrl: 'https://example.com/iko',
  // The server URL property field key as defined by the backend IkoServerRepository.
  serverUrlPropertyKey: 'ikoServerUrl',
  // Relative path (from the e2e root) to a dummy .zip used only to exercise the
  // file-selection UI of the import modal — it is never actually uploaded.
  importZipPath: 'assets/iko/iko-definition.zip',
} as const;

/** Build a unique server title for a single test. */
export function uniqueServerTitle(label: string): string {
  return `${IKO_SERVER_TITLE_PREFIX} ${label} ${generateId()}`;
}
