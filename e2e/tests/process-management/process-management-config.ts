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
 * The BPMN file uploaded by the deploy tests. It is the same asset the
 * case-scoped processes test uses, but here it is deployed through the
 * standalone Process management page, so it becomes an *unlinked* process
 * definition (not tied to any case definition).
 */
export const UPLOADED_PROCESS = {
  fileName: 'e2e-test-process.bpmn',
  key: 'e2e-test-process',
  name: 'E2E Test Process',
  /** `<bpmn:startEvent id="StartEvent_1">` in the asset. */
  startEventId: 'StartEvent_1',
} as const;

/**
 * A process created from scratch via "Create process".
 *
 * The builder seeds a brand-new diagram with `EMPTY_BPMN`
 * (`process-management/src/lib/constants/bpmn.constants.ts`), which declares a
 * fixed `<bpmn:process id="Process_1">` and no name. The key of a process
 * created without renaming it in the properties panel is therefore always
 * `Process_1`, and its Name cell renders empty — so rows for it have to be
 * located by key, never by name.
 */
export const CREATED_PROCESS = {
  key: 'Process_1',
  startEventId: 'StartEvent_1',
} as const;

export const PROCESS_MANAGEMENT_TEXTS = {
  /** Standalone context omits the two case-link columns, so only these remain. */
  listColumns: ['Name', 'Key', 'Status'],
  draftTag: 'Draft',
  deleteModalTitle: 'Delete process',
  replaceModalTitle: 'Replace existing process?',
  uploadSuccess: 'Deployment successful',
  deploySuccess: 'Process deployed successfully',
  deleteSuccess: 'Process deleted successfully',
  validationSuccess: 'Process definition is valid',
  /** Prefix of the version dropdown items, from `processManagement.version`. */
  versionPrefix: 'Version: ',
} as const;

export const PROCESS_MANAGEMENT_API = {
  /** Collection endpoint: GET lists, POST deploys new, PUT saves changes. */
  processDefinition: '/api/management/v1/process-definition',
  byKey: (key: string) => `/api/management/v1/process-definition/key/${key}`,
  validate: '/api/management/v1/process-definition/validate',
} as const;
