export const defaultDefinitionColumns = [
  {
    propertyName: 'sequence',
    translationKey: 'referenceNumber',
    sortable: true
  },
  {
    propertyName: 'createdBy',
    translationKey: 'createdBy',
    sortable: true
  },
  {
    propertyName: 'createdOn',
    translationKey: 'createdOn',
    sortable: true,
    viewType: 'date',
    default: true
  },
  {
    propertyName: 'modifiedOn',
    translationKey: 'lastModified',
    sortable: true,
    viewType: 'date'
  },
  {
    propertyName: 'assigneeFullName',
    translationKey: 'assigneeFullName',
    sortable: true,
  }
];
