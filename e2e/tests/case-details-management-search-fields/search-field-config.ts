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

export const SEARCH_FIELDS = [
  {
    key: 'testSearchField1',
    title: 'Test Search Field 1',
    path: 'case:createdBy',
    dataType: 'text',
    fieldType: 'single',
    matchType: 'like',
  },
  {
    key: 'testSearchField2',
    title: 'Test Search Field 2',
    path: 'case:createdOn',
    dataType: 'date',
    fieldType: 'range',
    matchType: 'exact',
  },
];

export const SEARCH_FIELDS_2 = [
  {
    key: 'testTestSearchField1',
    title: 'Test Test Search Field 1',
    path: 'case:createdBy',
    dataType: 'text',
    fieldType: 'single',
    matchType: 'like',
  },
  {
    key: 'testTestSearchField2',
    title: 'Test Test Search Field 2',
    path: 'case:createdOn',
    dataType: 'date',
    fieldType: 'range',
    matchType: 'exact',
  },
];

export const UI_SEARCH_FIELD_1 = {
  key: 'uiSearchField1',
  title: 'UI Search Field 1',
  path: 'case:createdBy',
  dataType: 'Text',
  fieldType: 'Single',
  matchType: 'Contains',
};

export const UI_SEARCH_FIELD_2 = {
  key: 'uiSearchField2',
  title: 'UI Search Field 2',
  path: 'case:createdOn',
  dataType: 'Date',
  fieldType: 'Range',
};

export const UI_SEARCH_FIELD_3 = {
  key: 'uiSearchField3',
  title: 'UI Search Field 3',
  path: 'case:createdBy',
  dataType: 'Text',
  fieldType: 'Single',
  matchType: 'Contains',
};

export const UI_SEARCH_FIELD_NUMBER = {
  key: 'uiSearchFieldNumber',
  title: 'Number Field',
  path: 'case:createdBy',
  dataType: 'Number',
  fieldType: 'Single',
};

export const UI_SEARCH_FIELD_NUMBER_RANGE = {
  key: 'uiSearchFieldNumberRange',
  title: 'Number Range Field',
  path: 'case:createdBy',
  dataType: 'Number',
  fieldType: 'Range',
};

export const UI_SEARCH_FIELD_DATETIME = {
  key: 'uiSearchFieldDatetime',
  title: 'Datetime Field',
  path: 'case:createdOn',
  dataType: 'Date and time',
  fieldType: 'Range',
};

export const UI_SEARCH_FIELD_BOOLEAN = {
  key: 'uiSearchFieldBoolean',
  title: 'Boolean Field',
  path: 'case:createdBy',
  dataType: 'Yes / no',
  fieldType: 'Single',
};

export const UI_SEARCH_FIELD_TEXT_EXACT = {
  key: 'uiSearchFieldTextExact',
  title: 'Text Exact Field',
  path: 'case:createdBy',
  dataType: 'Text',
  fieldType: 'Single',
  matchType: 'Exact',
};

export const UI_SEARCH_FIELD_SINGLE_SELECT_DROPDOWN = {
  key: 'uiSearchFieldSingleSelect',
  title: 'Single Select Dropdown Field',
  path: 'case:createdBy',
  dataType: 'Text',
  fieldType: 'Single select dropdown',
};

export const UI_SEARCH_FIELD_MULTI_SELECT_DROPDOWN = {
  key: 'uiSearchFieldMultiSelect',
  title: 'Multi Select Dropdown Field',
  path: 'case:createdBy',
  dataType: 'Text',
  fieldType: 'Multi select dropdown',
};

