interface DocumentDefinitionVersion {
  id: string;
  versionNumber: string;
  message: string;
  createdBy: string;
  lastEdited: string;
  type: DocumentDefinitionVersionType;
}

type DocumentDefinitionVersionType = 'final' | 'draft';

export {DocumentDefinitionVersion, DocumentDefinitionVersionType};
