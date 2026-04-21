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

import {generateId} from '../../utils/dataGenerator';

export const CASE_IDENTIFIER = 'bezwaar';

export function createTaskColumnTestData() {
  const id = generateId();
  return {
    title: `E2e Task Column ${id}`,
    key: `e2e-task-column-${id}`,
    path: 'e2eTestField',
    displayType: 'Text',
  };
}

export function createTaskColumnReorderTestData() {
  const idA = generateId();
  const idB = generateId();
  return {
    titleA: `E2e Task Col A ${idA}`,
    keyA: `e2e-task-col-a-${idA}`,
    pathA: 'e2eFieldA',
    titleB: `E2e Task Col B ${idB}`,
    keyB: `e2e-task-col-b-${idB}`,
    pathB: 'e2eFieldB',
  };
}

export function createTaskSearchFieldTestData() {
  const id = generateId();
  return {
    title: `E2e Task Search ${id}`,
    key: `e2e-task-search-${id}`,
    path: 'e2eSearchField',
    dataType: 'Text',
    matchType: 'Contains',
    fieldType: 'Single',
  };
}
