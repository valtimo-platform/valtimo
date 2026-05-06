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

export const USER_CASES_CONFIG = {
  /** Case definition used for all user-case flows. */
  caseDefinitionKey: 'bezwaar',
  caseDefinitionVersionTag: '1.0.1',
  /** Process definition key shared with the case definition key for bezwaar. */
  processDefinitionKey: 'bezwaar',
  /** API endpoint that creates a new case and starts its root process in one call. */
  processDocumentEndpoint: '/api/v1/process-document/operation/new-document-and-start-process',
  /** API endpoint to delete a case created during the test. */
  documentEndpoint: '/api/v1/document',
  /** Sub-process started from case detail via the "Start" overflow button. */
  changeNameProcess: 'Change name',
  /** Expected tab headings on the user case detail page. */
  detailTabs: {
    summary: 'Summary',
    progress: 'Progress',
    audit: 'Audit',
    documents: 'Documents',
  },
} as const;
