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

/**
 * Fixture for the widget process button access spec (gzac-issues#854).
 *
 * The archive holds one case definition with two internal statuses, a case process that sets the
 * status named in the case data (`/status`), and a supporting process linked both under Start and
 * as the process button of the "E2E status" widget.
 */
export const WIDGET_PROCESS_ACCESS_CONFIG = {
  archive: 'e2e-widget-process-pbac_1.0.0.case.zip',
  caseDefinitionKey: 'e2e-widget-process-pbac',
  caseDefinitionVersionTag: '1.0.0',
  caseProcessKey: 'e2e-wpp-case',
  supportingProcessKey: 'e2e-wpp-supporting',
  supportingProcessName: 'E2E supporting process',
  widgetTabKey: 'widgets',
  widgetTitle: 'E2E status',
  widgetButtonName: 'Start supporting process',
  allowedStatus: 'e2e-allowed',
  otherStatus: 'e2e-other',
  /** The role whose right to start processes is narrowed to the issue's rule while the spec runs. */
  roleKey: 'ROLE_ADMIN',
  newCaseEndpoint: '/api/v1/process-document/operation/new-document-and-start-process',
  modifyCaseEndpoint: '/api/v1/process-document/operation/modify-document-and-start-process',
  documentEndpoint: '/api/v1/document',
  importEndpoint: '/api/management/v1/case/import',
  rolePermissionsEndpoint: (roleKey: string) => `/api/management/v1/roles/${roleKey}/permissions`,
  startableItemsEndpoint: '/api/v1/case/startable-item',
} as const;

const OPERATON_EXECUTION = 'com.ritense.valtimo.operaton.domain.OperatonExecution';
const OPERATON_PROCESS_DEFINITION = 'com.ritense.valtimo.operaton.domain.OperatonProcessDefinition';

function startableOnlyForKeys(keys: string[]) {
  return [
    {
      type: 'container',
      resourceType: OPERATON_PROCESS_DEFINITION,
      conditions: [{type: 'field', field: 'key', operator: 'in', value: keys}],
    },
  ];
}

/**
 * The rule from the issue: the supporting process may only be started while the case has the
 * allowed internal status. The case process stays startable so the spec can change the case.
 */
export const RESTRICTED_PROCESS_START_PERMISSIONS = [
  {
    resourceType: OPERATON_EXECUTION,
    actions: ['create'],
    conditions: startableOnlyForKeys([WIDGET_PROCESS_ACCESS_CONFIG.supportingProcessKey]),
    contextResourceType: 'com.ritense.document.domain.impl.JsonSchemaDocument',
    contextConditions: [
      {
        type: 'field',
        field: 'internalStatus.id.key',
        operator: 'in',
        value: [WIDGET_PROCESS_ACCESS_CONFIG.allowedStatus],
      },
    ],
  },
  {
    resourceType: OPERATON_EXECUTION,
    actions: ['create'],
    conditions: startableOnlyForKeys([WIDGET_PROCESS_ACCESS_CONFIG.caseProcessKey]),
  },
];

export function isProcessStartPermission(permission: {resourceType: string; actions: string[]}) {
  return permission.resourceType === OPERATON_EXECUTION && permission.actions.includes('create');
}
