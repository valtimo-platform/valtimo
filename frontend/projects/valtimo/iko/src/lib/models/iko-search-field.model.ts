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

enum SearchFieldDataType {
  TEXT = 'text',
  NUMBER = 'number',
  DATE = 'date',
  DATETIME = 'datetime',
  TIME = 'time',
  BOOLEAN = 'boolean',
}

enum SearchFieldFieldType {
  SINGLE = 'single',
  RANGE = 'range',
  SINGLE_SELECT_DROPDOWN = 'single_select_dropdown',
  MULTI_SELECT_DROPDOWN = 'multi_select_dropdown',
}

enum SearchFieldMatchType {
  LIKE = 'like',
  EXACT = 'exact',
}

enum SearchDropdownDataProvider {
  DATABASE = 'dropdownDatabaseDataProvider',
  JSON = 'dropdownJsonFileDataProvider',
}

interface SearchField {
  id: string;
  ownerId: string;
  dataType: SearchFieldDataType;
  fieldType: SearchFieldFieldType;
  key: string;
  title?: string;
  path: string;
  order: number;
  matchType: SearchFieldMatchType;
  dropdownDataProvider?: string;
  dropdownValues?: SearchDropdownValue;
}

interface SearchDropdownValue {
  [key: string]: string;
}

export {
  SearchDropdownDataProvider,
  SearchFieldDataType,
  SearchFieldFieldType,
  SearchFieldMatchType,
  SearchField,
  SearchDropdownValue,
};
