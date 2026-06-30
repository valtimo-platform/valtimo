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

/** Shared prefix used for every search field title created by this suite. */
export const IKO_SEARCH_FIELD_TITLE_PREFIX = 'E2E IKO Search Field';

/**
 * Visible labels of the relevant dataType / matchType / fieldType dropdown
 * items, as rendered by the search field modal (from the `searchFields.*`
 * and `searchFieldsOverview.*` translation keys).
 */
export const DATA_TYPE_LABELS = {
  text: {label: 'Text', id: 'text'},
  bsn: {label: 'BSN', id: 'bsn'},
} as const;

export const MATCH_TYPE_LABELS = {
  exact: {label: 'Exact', id: 'exact'},
  like: {label: 'Contains', id: 'like'},
} as const;

export const FIELD_TYPE_LABELS = {
  single: {label: 'Single', id: 'single'},
  range: {label: 'Range', id: 'range'},
} as const;

/** Column headers shown on the search fields list table. */
export const SEARCH_FIELD_HEADERS = ['Key', 'Title', 'Path', 'Data type', 'Field type'] as const;

export const ikoSearchFieldConfig = {
  titlePrefix: IKO_SEARCH_FIELD_TITLE_PREFIX,
  path: 'doc:/example/path',
} as const;

/** Build a unique search field title for a single test. */
export function uniqueSearchFieldTitle(label: string): string {
  return `${IKO_SEARCH_FIELD_TITLE_PREFIX} ${label} ${generateId()}`;
}
