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

export const CASE_LIST_NAVIGATION_CONFIG = {
  /** A case definition that starts without any external system. */
  caseDefinitionKey: 'layout-test',
  caseDefinitionVersionTag: '1.0.0',
  caseDefinitionTitle: 'Layout Test',
  processDefinitionKey: 'layout-test',
  processDocumentEndpoint: '/api/v1/process-document/operation/new-document-and-start-process',
  documentEndpoint: '/api/v1/document',
  searchFieldEndpoint: '/api/v1/document-search/layout-test/fields',
  userSettingsEndpoint: '/api/v1/user/settings',
  /** Enough cases with this marker to fill more than one page of ten. */
  caseCount: 12,
  marker: 'Navigatie218',
  searchField: {
    key: 'e2eNavigationFirstName',
    title: 'First name (navigation e2e)',
    path: 'doc:firstName',
  },
  excludedStatus: 'Afgehandeld',
  assigneeTab: 'All cases',
  sortColumn: 'First name',
  otherDetailTab: 'Audit',
} as const;
