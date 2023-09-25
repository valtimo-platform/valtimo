/*
 * Copyright 2015-2023 Ritense BV, the Netherlands.
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

export interface SortResult {
  sorted: boolean;
  unsorted: boolean;
}

export interface Pageable {
  sort: SortResult;
  pageSize: number;
  pageNumber: number;
  offset: number;
  unpaged: boolean;
  paged: boolean;
}

export interface Page<T> {
  content: Array<T>;
  pageable: Pageable;
  last: boolean;
  totalPages: number;
  totalElements: number;
  first: boolean;
  sort: SortResult;
  numberOfElements: number;
  size: number;
  number: number;
}

export interface DocumentDefinitions {
  content: DocumentDefinition[];
  empty: boolean;
  first: boolean;
  last: boolean;
  number: number;
  numberOfElements: number;
  size: number;
  sort: any;
  totalElements: number;
  totalPages: number;
}

export interface DocumentDefinition {
  id: DefinitionId;
  schema: any;
  createdOn: string;
  readOnly: boolean;
}

export interface DefinitionId {
  name: string;
  version: number;
}

export interface Documents {
  content: Document[];
  empty: boolean;
  first: boolean;
  last: boolean;
  number: number;
  numberOfElements: number;
  size: number;
  sort: any;
  totalElements: number;
  totalPages: number;
}

export type SpecifiedDocuments = Omit<Documents, 'content'> & {
  content: Array<{id: string; items: Array<{key: string; value: string}>}>;
};

export interface RelatedFile {
  fileId: string;
  fileName: string;
  sizeInBytes: number;
  createdOn: Date;
  createdBy: string;
  pluginConfigurationId?: string;
}

export type RelatedFileListItem = Omit<RelatedFile, 'createdOn'> & {createdOn: string};

export interface Document {
  id: string;
  content: object;
  version: string;
  createdOn: Date;
  modifiedOn: Date;
  createdBy: string;
  sequence: number;
  definitionName: string;
  definitionId: DocumentDefinitionId | null;
  relations: string[];
  relatedFiles: RelatedFile[];
  assigneeFullName: string;
  assigneeId: string;
}

export interface DocumentDefinitionId {
  name: string;
  version: number;
}

export interface ProcessDocumentDefinitionId {
  processDefinitionKey: string;
  documentDefinitionId: DefinitionId;
}

export interface ProcessDocumentDefinition {
  id: ProcessDocumentDefinitionId;
  processName: string;
  canInitializeDocument: boolean;
  startableByUser: boolean;
  latestVersionId: string;
}

export interface ProcessDocumentInstanceId {
  processInstanceId: string;
  documentId: string;
}

export interface ProcessDocumentInstance {
  id: ProcessDocumentInstanceId;
  processName: string;
  isActive: boolean;
}

export interface AssignHandlerToDocumentResult {
  assigneeId: string;
}

export interface NewDocumentAndStartProcessResult {
  document: Document;
  processInstanceId: string;
  errors: string[];
}

export interface ModifyDocumentAndCompleteTaskResult {
  document: Document;
  errors: string[];
}

export interface ModifyDocumentAndStartProcessResult {
  document: Document;
  processInstanceId: string;
  errors: string[];
}

export interface DocumentResult {
  document: Document;
  errors: string[];
}

export interface ModifyDocumentRequest {
  documentId: string;
  content: object;
  versionBasedOn: string;
}

export class ModifyDocumentRequestImpl implements ModifyDocumentRequest {
  documentId: string;
  content: object;
  versionBasedOn: string;

  constructor(documentId: string, content: object, versionBasedOn: string) {
    this.documentId = documentId;
    this.content = content;
    this.versionBasedOn = versionBasedOn;
  }
}

export interface ModifyDocumentAndCompleteTaskRequest<
  T_MODIFY_DOCUMENT_REQUEST extends ModifyDocumentRequest,
> {
  taskId: string;
  request: T_MODIFY_DOCUMENT_REQUEST;
}

export class ModifyDocumentAndCompleteTaskRequestImpl
  implements ModifyDocumentAndCompleteTaskRequest<ModifyDocumentRequestImpl>
{
  taskId: string;
  request: ModifyDocumentRequestImpl;

  constructor(taskId: string, request: ModifyDocumentRequestImpl) {
    this.taskId = taskId;
    this.request = request;
  }
}

export interface NewDocumentRequest {
  definition: string;
  content: object;
}

export class NewDocumentRequestImpl implements NewDocumentRequest {
  definition: string;
  content: object;

  constructor(definition: string, content: object) {
    this.definition = definition;
    this.content = content;
  }
}

export interface NewDocumentAndStartProcessRequest<
  T_NEW_DOCUMENT_REQUEST extends NewDocumentRequest,
> {
  processDefinitionKey: string;
  request: T_NEW_DOCUMENT_REQUEST;
}

export class NewDocumentAndStartProcessRequestImpl
  implements NewDocumentAndStartProcessRequest<NewDocumentRequestImpl>
{
  processDefinitionKey: string;
  request: NewDocumentRequestImpl;

  constructor(processDefinitionKey: string, request: NewDocumentRequestImpl) {
    this.processDefinitionKey = processDefinitionKey;
    this.request = request;
  }
}

export interface ModifyDocumentAndStartProcessRequest<
  T_MODIFY_DOCUMENT_REQUEST extends ModifyDocumentRequest,
> {
  processDefinitionKey: string;
  request: T_MODIFY_DOCUMENT_REQUEST;
}

export class ModifyDocumentAndStartProcessRequestImpl
  implements ModifyDocumentAndStartProcessRequest<ModifyDocumentRequestImpl>
{
  processDefinitionKey: string;
  request: ModifyDocumentRequestImpl;

  constructor(processDefinitionKey: string, request: ModifyDocumentRequestImpl) {
    this.processDefinitionKey = processDefinitionKey;
    this.request = request;
  }
}

export interface ProcessDocumentDefinitionRequest {
  processDefinitionKey: string;
  documentDefinitionName: string;
  canInitializeDocument: boolean;
  startableByUser: boolean;
}

export class DocumentDefinitionCreateRequest {
  definition: string;

  constructor(definition: string) {
    this.definition = definition;
  }
}

export interface UndeployDocumentDefinitionResult {
  documentDefinitionName: string;
  errors: string[];
}

export interface DocumentSendMessageRequest {
  subject: string;
  bodyText: string;
}

export interface DocumentRoles {
  content: DocumentRole[];
}

export interface DocumentRole {
  name: string;
}

export interface DocumentType {
  url: string;
  name: string;
}

export interface UploadProcessLink {
  processDefinitionKey: string;
  processName: string;
}

export interface UpdateUploadProcessLinkRequest {
  processDefinitionKey: string;
}

export interface CaseSettings {
  name?: string;
  canHaveAssignee: boolean;
  autoAssignTasks: boolean;
}

export interface OpenDocumentCount {
  documentDefinitionName: string;
  openDocumentCount: number;
}

export interface CaseListColumn {
  title: string;
  key: string;
  path: string;
  displayType: DisplayType;
  sortable: boolean;
  defaultSort: string;
}

export interface CaseListColumnView {
  title: string;
  key: string;
  path: string;
  displayType: string;
  displayTypeParameters: string;
  sortable: boolean;
  defaultSort: string;
}

export interface DisplayType {
  type: string;
  displayTypeParameters: DisplayTypeParameters;
}

export interface DisplayTypeParameters {
  enum?: {
    [key: string]: string;
  };
  dateFormat?: string;
}
