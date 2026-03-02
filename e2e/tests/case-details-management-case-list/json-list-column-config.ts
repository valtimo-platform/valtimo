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

export const LIST_COLUMNS = [
  {
    key: 'testColumn1',
    path: 'case:createdBy',
    displayType: {
      type: 'text',
      displayTypeParameters: {},
    },
    sortable: true,
    order: 0,
    exportable: false,
  },
  {
    key: 'testColumn2',
    path: 'case:createdOn',
    displayType: {
      type: 'date',
      displayTypeParameters: {
        dateFormat: null,
      },
    },
    sortable: true,
    order: 1,
    exportable: false,
  },
];

export const LIST_COLUMNS_2 = [
  {
    key: 'testTestColumn1',
    path: 'case:createdBy',
    displayType: {
      type: 'text',
      displayTypeParameters: {},
    },
    sortable: true,
    order: 0,
    exportable: false,
  },
  {
    key: 'testTestColumn2',
    path: 'case:createdOn',
    displayType: {
      type: 'date',
      displayTypeParameters: {
        dateFormat: null,
      },
    },
    sortable: true,
    order: 1,
    exportable: false,
  },
];

export const REVERT_LIST_COLUMNS = [
  {test: 'This is a random test'},
  {test2: 'This is a random second test'},
];

export const UI_COLUMN_1 = {
  title: 'Created By',
  key: 'uiTestColumn1',
  path: 'case:createdBy',
  displayType: 'Text',
};

export const UI_COLUMN_2 = {
  title: 'Created On',
  key: 'uiTestColumn2',
  path: 'case:createdOn',
  displayType: 'Date',
  sortable: true,
};

export const UI_COLUMN_DATE = {
  title: 'Date Column',
  key: 'uiTestDate',
  path: 'case:createdOn',
  displayType: 'Date',
  sortable: true,
  dateFormat: 'dd-MM-yyyy',
};

export const UI_COLUMN_ENUM = {
  title: 'Enum Column',
  key: 'uiTestEnum',
  path: 'case:createdBy',
  displayType: 'Enumeration',
  enumValues: [
    {key: 'active', value: 'Active'},
    {key: 'inactive', value: 'Inactive'},
  ],
};

export const UI_COLUMN_TAGS = {
  title: 'Tags Column',
  key: 'uiTestTags',
  path: 'case:createdBy',
  displayType: 'Tags',
  tagAmount: 3,
};

export const UI_COLUMN_DEFAULT_SORT = {
  title: 'Default Sort Column',
  key: 'uiTestDefaultSort',
  path: 'case:createdOn',
  displayType: 'Text',
  sortable: true,
  defaultSort: 'Descending',
};

export const UI_COLUMN_EXPORTABLE = {
  title: 'Exportable Column',
  key: 'uiTestExportable',
  path: 'case:createdBy',
  displayType: 'Text',
  exportable: true,
};

//Should probably come from the environment
export enum CASE_VERSIONS {
  STABLE = '1.0.0',
  DRAFT = '1.0.1',
}
