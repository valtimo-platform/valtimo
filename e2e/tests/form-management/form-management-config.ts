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

export const FORM_IN_USE_PROCESS = {
  key: 'e2e-plugin-steps-process',
  name: 'E2E Plugin Steps Process',
  assetFileName: 'e2e-plugin-steps-process.bpmn',
  userTaskId: 'UserTask_1',
} as const;

export const FORM_IN_USE_TEXTS = {
  inUse: (usages: string) =>
    `This form cannot be deleted because it is used by process links: ${usages}. Remove these references first.`,
  unexpectedError: 'An unexpected error occurred',
} as const;

export const FORM_IN_USE_API = {
  form: '/api/management/v1/form',
  processLink: '/api/v1/process-link',
  processDefinition: '/api/management/v1/process-definition',
  processDefinitionByKey: (key: string) => `/api/management/v1/process-definition/key/${key}`,
} as const;
