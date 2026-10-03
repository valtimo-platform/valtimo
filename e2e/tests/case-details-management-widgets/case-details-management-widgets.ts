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

export function createWidgetTestData() {
  const id = generateId();
  return {
    tabName: `E2e Widget Tab ${id}`,
    tabKey: `e2e-widget-tab-${id}`,
    widgetTitle: `E2e Test Widget ${id}`,
    fieldTitle: 'Test Field',
    // `case:definitionId.name` no longer exists: the case definition id is exposed as
    // key + versionTag since case definition versioning was introduced.
    valuePath: 'case:definitionId.key',
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

/**
 * Data for the display-conditions test (6.94).
 *
 * `operatorLabel` is what the dropdown shows; `operator` is what the backend stores for it —
 * the test asserts the stored value, so both are needed.
 */
export function createConditionWidgetTestData() {
  const id = generateId();
  return {
    widgetTitle: `E2e Condition Widget ${id}`,
    fieldTitle: 'Condition Field',
    valuePath: 'case:definitionId.key',
    conditionPath: 'case:createdBy',
    operatorLabel: 'Equal to',
    operator: '==',
    conditionValue: 'admin',
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

/**
 * Data for a Fields widget field whose value combines several document values (gzac-issues#79).
 *
 * Uses `layout-test`, whose cases start without the ZGW stack. `houseNumberAddition` is left out
 * of the document: an empty placeholder must leave nothing behind.
 */
export function createValueTemplateTestData() {
  const id = generateId();
  return {
    caseDefinitionKey: 'layout-test',
    widgetTabName: 'Adres & Contact',
    widgetTitle: `E2e Template Widget ${id}`,
    fieldTitle: 'Adres',
    template:
      '${doc:/street} ${doc:/houseNumber}${doc:/houseNumberAddition}, ${doc:/postalCode} ${doc:/city}',
    document: {
      street: 'Kerkstraat',
      houseNumber: '12',
      postalCode: '1234 AB',
      city: 'Utrecht',
    },
    expectedValue: 'Kerkstraat 12, 1234 AB Utrecht',
  };
}
