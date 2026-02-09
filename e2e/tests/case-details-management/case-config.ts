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
