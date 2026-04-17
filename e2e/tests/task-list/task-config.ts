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

export const TASK_CONFIG = {
  /** Case definition with simple user tasks (empty-form) for ROLE_ADMIN and ROLE_USER */
  autoAssignProcess: 'auto-assign-test',
  /** Case definition with user tasks that have real form fields (textfield, number, checkbox, etc.) */
  formioTestProcess: 'formio-test',
  /** API endpoint to create a new case and start its process */
  processDocumentEndpoint: '/api/v1/process-document/operation/new-document-and-start-process',
  /** Task name from formio-test that has a required text field */
  textFieldTaskName: 'Test Text Field',
};
