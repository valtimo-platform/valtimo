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

import {ValuePathSelectorPrefix} from '@valtimo/components';

export const GROUP_SEARCH_FIELD_DATA_TYPES = ['text', 'number', 'date', 'datetime', 'boolean'];
export const GROUP_SEARCH_FIELD_FIELD_TYPES = [
  'single',
  'range',
  'multi-select-dropdown',
  'single-select-dropdown',
];
// Same rules as a single case type: dropdowns only for text, booleans only single
export const GROUP_SEARCH_FIELD_TYPES_BY_DATA_TYPE: Record<string, string[]> = {
  text: GROUP_SEARCH_FIELD_FIELD_TYPES,
  boolean: ['single'],
};
export const GROUP_SEARCH_FIELD_DEFAULT_FIELD_TYPES = ['single', 'range'];
export const GROUP_SEARCH_FIELD_DROPDOWN_FIELD_TYPES = [
  'single-select-dropdown',
  'multi-select-dropdown',
];
// Only this provider stores editable lists
export const EDITABLE_DROPDOWN_DATA_PROVIDER = 'dropdownDatabaseDataProvider';
export const GROUP_SEARCH_FIELD_MATCH_TYPES = ['exact', 'like'];

export const GROUP_SEARCH_FIELD_DATA_TYPE_ITEMS = GROUP_SEARCH_FIELD_DATA_TYPES.map(t => ({
  content: t,
  value: t,
}));
export const GROUP_SEARCH_FIELD_MATCH_TYPE_ITEMS = GROUP_SEARCH_FIELD_MATCH_TYPES.map(t => ({
  content: t,
  value: t,
}));

// Group search only supports document and case properties
export const GROUP_SEARCH_FIELD_SEARCHABLE_PATH_PREFIXES = [
  ValuePathSelectorPrefix.DOC,
  ValuePathSelectorPrefix.CASE,
];
