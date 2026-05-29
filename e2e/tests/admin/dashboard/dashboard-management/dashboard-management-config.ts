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

import {generateId} from '../../../../utils/dataGenerator';

export function createDashboardTestData() {
  const id = generateId();
  return {
    title: `E2e Test Dashboard ${id}`,
    description: `E2e test dashboard description ${id}`,
  };
}

export function createWidgetTestData() {
  const id = generateId();
  return {
    widgetTitle: `E2e Test Widget ${id}`,
    editedWidgetTitle: `E2e Edited Widget ${id}`,
  };
}

export function createReorderTestData() {
  const id = generateId();
  return {
    titleA: `E2e Reorder Widget A ${id}`,
    titleB: `E2e Reorder Widget B ${id}`,
  };
}

/** Case definition key that exists in the GZAC test environment */
export const CASE_DEFINITION_KEY = 'bezwaar';
