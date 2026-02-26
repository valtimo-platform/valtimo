export const LIST_COLUMNS = [
  {
    key: 'testColumn1',
    path: 'case:createdBy',
    displayType: {
      type: 'text',
      displayTypeParameters: {},
    },
    sortable: true,
    order: 0,
    exportable: false,
  },
  {
    key: 'testColumn2',
    path: 'case:createdOn',
    displayType: {
      type: 'date',
      displayTypeParameters: {
        dateFormat: null,
      },
    },
    sortable: true,
    defaultSort: 'DESC',
    order: 1,
    exportable: false,
  },
];

export const LIST_COLUMNS_2 = [
  {
    key: 'testTestColumn1',
    path: 'case:createdBy',
    displayType: {
      type: 'text',
      displayTypeParameters: {},
    },
    sortable: true,
    order: 0,
    exportable: false,
  },
  {
    key: 'testTestColumn2',
    path: 'case:createdOn',
    displayType: {
      type: 'date',
      displayTypeParameters: {
        dateFormat: null,
      },
    },
    sortable: true,
    defaultSort: 'DESC',
    order: 1,
    exportable: false,
  },
];

export const REVERT_LIST_COLUMNS = [
  {test: 'This is a random test'},
  {test2: 'This is a random second test'},
];

//Should probably come from the environment
export enum CASE_VERSIONS {
  STABLE = '1.0.0',
  DRAFT = '1.0.1',
}
