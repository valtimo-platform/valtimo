export const SEARCH_FIELDS = [
  {
    key: 'testSearchField1',
    title: 'Test Search Field 1',
    path: 'case:createdBy',
    dataType: 'text',
    fieldType: 'single',
    matchType: 'like',
  },
  {
    key: 'testSearchField2',
    title: 'Test Search Field 2',
    path: 'case:createdOn',
    dataType: 'date',
    fieldType: 'range',
    matchType: 'exact',
  },
];

export const SEARCH_FIELDS_2 = [
  {
    key: 'testTestSearchField1',
    title: 'Test Test Search Field 1',
    path: 'case:createdBy',
    dataType: 'text',
    fieldType: 'single',
    matchType: 'like',
  },
  {
    key: 'testTestSearchField2',
    title: 'Test Test Search Field 2',
    path: 'case:createdOn',
    dataType: 'date',
    fieldType: 'range',
    matchType: 'exact',
  },
];

export const UI_SEARCH_FIELD_1 = {
  key: 'uiSearchField1',
  title: 'UI Search Field 1',
  path: 'case:createdBy',
  dataType: 'Text',
  fieldType: 'Single',
  matchType: 'Contains',
};

export const UI_SEARCH_FIELD_2 = {
  key: 'uiSearchField2',
  title: 'UI Search Field 2',
  path: 'case:createdOn',
  dataType: 'Date',
  fieldType: 'Range',
};

export enum CASE_VERSIONS {
  STABLE = '1.0.0',
  DRAFT = '1.0.1',
}
