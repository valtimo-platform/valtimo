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

export const roleTestData = {
  key: 'e2e-test-role',
  updatedKey: 'e2e-updated-role',
};

/**
 * A permission written straight through the JSON editor (11.10). Stored permissions have the
 * shape `{resourceType, actions[], conditions[]}`.
 */
export const jsonPermission = {
  resourceType: 'com.ritense.dashboard.domain.Dashboard',
  actions: ['view'],
  conditions: [],
};

/**
 * Data for the form editor (11.11–11.13).
 *
 * `resourceType` is the dropdown label ("Name (fully.qualified.Name)"), `resourceTypeFqn` is what
 * gets stored. Operator labels are words in the UI and symbols in the payload ("equals" → `==`).
 */
export const permissionTestData = {
  resourceType: 'CaseDefinition (com.ritense.case_.domain.definition.CaseDefinition)',
  resourceTypeFqn: 'com.ritense.case_.domain.definition.CaseDefinition',
  actionLabel: 'View list',
  action: 'view_list',
  conditionField: 'id.key',
  conditionOperator: 'equals',
  conditionOperatorSymbol: '==',
  conditionValue: 'bezwaar',
};
