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

export function createChoiceFieldTestData() {
  const id = generateId();
  return {
    keyName: `e2e_test_${id}`,
    title: `E2e Test Choice Field ${id}`,
    editedTitle: `E2e Edited Choice Field ${id}`,
  };
}

export function createChoiceFieldValueTestData() {
  const id = generateId();
  return {
    name: `e2e_value_${id}`,
    value: `E2e Test Value ${id}`,
    editedValue: `E2e Edited Value ${id}`,
    sortOrder: '1',
  };
}
