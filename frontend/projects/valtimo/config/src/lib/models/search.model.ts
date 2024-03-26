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

type SearchFieldDataType = 'text' | 'number' | 'date' | 'datetime' | 'boolean';

type SearchFieldFieldType =
  | 'single'
  | 'multiple'
  | 'range'
  | 'single-select-dropdown'
  | 'multi-select-dropdown';

type SearchFieldMatchType = 'exact' | 'like';

type SearchFieldBoolean = 'booleanPositive' | 'booleanNegative';

type BooleanValueSingle = boolean;

type TextValueSingle = string;
type ValueMultiple = Array<
  BooleanValueSingle | TextValueSingle | NumberValueSingle | NumberValueRange
>;

type NumberValueSingle = number;

interface NumberValueRange {
  start: NumberValueSingle;
  end: NumberValueSingle;
}

type SearchFieldValue =
  | BooleanValueSingle
  | TextValueSingle
  | ValueMultiple
  | NumberValueSingle
  | NumberValueRange;

interface SearchField {
  ownerId?: string;
  title?: string;
  key: string;
  path?: string;
  order?: number;
  dataType: SearchFieldDataType;
  fieldType: SearchFieldFieldType;
  matchType?: SearchFieldMatchType;
  dropdownDataProvider?: string;
}

interface SearchFieldWithValue extends SearchField {
  value: SearchFieldValue;
}

interface SearchFieldValues {
  [searchFieldKey: string]: SearchFieldValue;
}

interface SearchFieldColumnView {
  title: string;
  key: string;
  path: string;
  dataType: string;
  fieldType: string;
}

type SearchOperator = 'AND' | 'OR';

type AssigneeFilter = 'OPEN' | 'MINE' | 'ALL';

interface SearchFilter {
  key: string;
  values: Array<string>;
}

interface SearchFilterRange {
  key: string;
  rangeFrom: string;
  rangeTo: string;
}

export {
  SearchFieldDataType,
  SearchFieldFieldType,
  SearchFieldMatchType,
  SearchFieldBoolean,
  SearchField,
  SearchFieldValue,
  SearchFieldWithValue,
  SearchFieldValues,
  SearchFieldColumnView,
  SearchOperator,
  SearchFilter,
  SearchFilterRange,
  AssigneeFilter,
};
