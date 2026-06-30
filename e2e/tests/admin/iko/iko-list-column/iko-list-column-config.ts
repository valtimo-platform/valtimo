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

export const IKO_LIST_COLUMN_TITLE_PREFIX = 'E2E IKO Column';

export const COLUMN_DISPLAY_TYPES = {
  text: {id: 'text', label: 'Text'},
  hidden: {id: 'hidden', label: 'hidden'},
} as const;

export const COLUMN_SORT_LABELS = {
  asc: 'Ascending',
  desc: 'Descending',
} as const;

export const COLUMN_HEADERS = ['Title', 'Key', 'Path', 'Display Type'] as const;

export const ikoListColumnConfig = {
  path: '/basisgegevens/bsn',
} as const;

export function uniqueColumnTitle(label: string): string {
  return `${IKO_LIST_COLUMN_TITLE_PREFIX} ${label} ${generateId()}`;
}
