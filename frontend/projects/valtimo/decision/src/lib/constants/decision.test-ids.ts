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

export const DECISION_LIST_TEST_IDS = {
  uploadButton: 'decisionListUploadButton',
  createButton: 'decisionListCreateButton',
} as const;

export const DECISION_UPLOAD_TEST_IDS = {
  submitButton: 'decisionUploadModalSubmitButton',
} as const;

export const DECISION_FORM_TEST_IDS = {
  nameInput: 'decisionFormModalNameInput',
  inputVariables: 'decisionFormModalInputVariables',
  submitButton: 'decisionFormModalSubmitButton',
} as const;

export const DECISION_MODELER_TEST_IDS = {
  deployButton: 'decisionModelerDeployButton',
  backButton: 'decisionModelerBackButton',
  readOnlyTag: 'decisionModelerReadOnlyTag',
} as const;
