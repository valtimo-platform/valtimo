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

export interface CaseManagementFieldMap {
  testId: string;
  type: 'input' | 'select';
  isAutoKey?: boolean;
  value: string;
}

export interface CaseManagementConfiguration {
  fields: CaseManagementFieldMap[];
  caseKey: string;
  caseVersion: string;
}

export const caseConfiguration: CaseManagementConfiguration = {
  fields: [
    {
      testId: 'caseDefinitionNameInput',
      type: 'input',
      value: 'Test Case',
    },
    {
      testId: 'caseDefinitionKeyInput',
      type: 'input',
      isAutoKey: true,
      value: 'test-case',
    },
    {
      testId: 'caseDefinitionVersionInput',
      type: 'input',
      value: '1.0.0',
    },
    {
      testId: 'caseDefinitionDescriptionInput',
      type: 'input',
      value: 'Testing a case definition...',
    },
  ],
  caseKey: 'test-case-import',
  caseVersion: '1.0.0',
};

export const caseExternalFormConfiguration = {
  url: 'http://www.google.com',
  description: 'Google link',
};

//Should probably come from the environment
export enum CASE_VERSIONS {
  STABLE = '1.0.0',
  DRAFT = '1.0.1',
}
