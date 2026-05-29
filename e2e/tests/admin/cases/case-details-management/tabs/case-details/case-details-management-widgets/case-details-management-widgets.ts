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

import {generateId} from '../../../../../../../utils/dataGenerator';

export const CASE_IDENTIFIER = 'bezwaar';

export function createWidgetTestData() {
  const id = generateId();
  return {
    tabName: `E2e Widget Tab ${id}`,
    tabKey: `e2e-widget-tab-${id}`,
    widgetTitle: `E2e Test Widget ${id}`,
    fieldTitle: 'Test Field',
    valuePath: 'case:definitionId.name',
  };
}

export function createDividerTestData() {
  const id = generateId();
  return {
    dividerTitle: `E2e Test Divider ${id}`,
  };
}

export function createJsonEditorDividerData() {
  const id = generateId();
  return {
    dividerTitle: `E2e JSON Divider ${id}`,
    dividerKey: `e2e-json-divider-${id}`,
  };
}

export function createReorderTestData() {
  const idA = generateId();
  const idB = generateId();
  return {
    titleA: `E2e Reorder Widget A ${idA}`,
    titleB: `E2e Reorder Widget B ${idB}`,
  };
}
