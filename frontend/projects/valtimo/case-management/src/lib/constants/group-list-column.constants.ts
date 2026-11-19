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

export const GROUP_COLUMN_DISPLAY_TYPE_ITEMS = [
  {content: 'text', value: 'text'},
  {content: 'date', value: 'date'},
  {content: 'boolean', value: 'boolean'},
  {content: 'enum', value: 'enum'},
  {content: 'tags', value: 'tags'},
];

export const GROUP_COLUMN_NO_DEFAULT_SORT = 'none';

export const GROUP_COLUMN_DEFAULT_SORT_ITEMS = [
  {content: 'listColumn.selectDefaultSort', value: GROUP_COLUMN_NO_DEFAULT_SORT},
  {content: 'listColumn.sortableAsc', value: 'ASC'},
  {content: 'listColumn.sortableDesc', value: 'DESC'},
];

export const GROUP_LIST_COLUMN_CASE_PREFIX = 'case:';

export const SORTABLE_CASE_FIELDS: readonly string[] = [
  'createdOn',
  'modifiedOn',
  'createdBy',
  'sequence',
  'retentionDate',
  'assigneeId',
  'assigneeFullName',
  'internalStatus',
  'documentDefinitionId.name',
];

export const canSortOnPaths = (paths: Array<string | null | undefined>): boolean => {
  const filledPaths = paths.map(path => (path ?? '').trim()).filter(path => path !== '');

  if (filledPaths.length === 0 || filledPaths.some(path => path !== filledPaths[0])) {
    return false;
  }

  return (
    filledPaths[0].startsWith(GROUP_LIST_COLUMN_CASE_PREFIX) &&
    SORTABLE_CASE_FIELDS.includes(filledPaths[0].substring(GROUP_LIST_COLUMN_CASE_PREFIX.length))
  );
};
