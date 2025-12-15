export interface CaseManagementFieldMap {
    testId: string;
    type: 'input' | 'select';
    value: string;
}

export const caseConfiguration = [
    {
        testId: 'caseDefinitionName',
        type: 'input',
        value: 'Test Case',
    },
    {
        testId: 'caseDefinitionVersion',
        type: 'input',
        value: '1.0.0',
    },
    {
        testId: 'caseDefinitionDescription',
        type: 'input',
        value: 'Testing a case definition...',
    },
];