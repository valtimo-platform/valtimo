/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

interface SortResult {
  sorted: boolean;
  unsorted: boolean;
}

interface Pageable {
  sort: SortResult;
  pageSize: number;
  pageNumber: number;
  offset: number;
  unpaged: boolean;
  paged: boolean;
}

interface Page<T> {
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

interface DocumentDefinitions {
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

interface DocumentDefinition {
  id: DefinitionId;
  schema: any;
  createdOn: string;
  readOnly: boolean;
}

interface DefinitionId {
  name: string;
  version: number;
}

interface CreateDocumentDefinitionResponse {
  documentDefinition: DocumentDefinition;
  errors: string[];
}

interface Documents {
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
  locked?: boolean;
}

type SpecifiedDocuments = Omit<Documents, 'content'> & {
  content: Array<{id: string; items: Array<{key: string; value: string}>; locked?: boolean}>;
};

interface RelatedFile {
  fileId: string;
  fileName: string;
  sizeInBytes: number;
  createdOn: Date;
  createdBy: string;
  pluginConfigurationId?: string;
}

type RelatedFileListItem = Omit<RelatedFile, 'createdOn'> & {createdOn: string};

interface Document {
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
  internalStatus?: string;
}

interface DocumentDefinitionId {
  name: string;
  version: number;
}

interface ProcessDocumentDefinitionId {
  processDefinitionKey: string;
  documentDefinitionId: DefinitionId;
}

interface ProcessDocumentDefinition {
  id: ProcessDocumentDefinitionId;
  processName: string;
  canInitializeDocument: boolean;
  startableByUser: boolean;
  latestVersionId: string;
}

interface ProcessDocumentInstanceId {
  processInstanceId: string;
  documentId: string;
}

interface ProcessDocumentInstance {
  id: ProcessDocumentInstanceId;
  processName: string;
  active: boolean;
  version: number;
  latestVersion: number;
  startedBy: string;
  startedOn: Date;
}

interface AssignHandlerToDocumentResult {
  assigneeId: string;
}

interface NewDocumentAndStartProcessResult {
  document: Document;
  processInstanceId: string;
  errors: string[];
}

interface ModifyDocumentAndCompleteTaskResult {
  document: Document;
  errors: string[];
}

interface ModifyDocumentAndStartProcessResult {
  document: Document;
  processInstanceId: string;
  errors: string[];
}

interface DocumentResult {
  document: Document;
  errors: string[];
}

interface ModifyDocumentRequest {
  documentId: string;
  content: object;
  versionBasedOn: string;
}

class ModifyDocumentRequestImpl implements ModifyDocumentRequest {
  documentId: string;
  content: object;
  versionBasedOn: string;

  constructor(documentId: string, content: object, versionBasedOn: string) {
    this.documentId = documentId;
    this.content = content;
    this.versionBasedOn = versionBasedOn;
  }
}

interface ModifyDocumentAndCompleteTaskRequest<
  T_MODIFY_DOCUMENT_REQUEST extends ModifyDocumentRequest,
> {
  taskId: string;
  request: T_MODIFY_DOCUMENT_REQUEST;
}

class ModifyDocumentAndCompleteTaskRequestImpl
  implements ModifyDocumentAndCompleteTaskRequest<ModifyDocumentRequestImpl>
{
  taskId: string;
  request: ModifyDocumentRequestImpl;

  constructor(taskId: string, request: ModifyDocumentRequestImpl) {
    this.taskId = taskId;
    this.request = request;
  }
}

interface NewDocumentRequest {
  definition: string;
  content: object;
}

class NewDocumentRequestImpl implements NewDocumentRequest {
  definition: string;
  content: object;

  constructor(definition: string, content: object) {
    this.definition = definition;
    this.content = content;
  }
}

interface NewDocumentAndStartProcessRequest<T_NEW_DOCUMENT_REQUEST extends NewDocumentRequest> {
  processDefinitionKey: string;
  request: T_NEW_DOCUMENT_REQUEST;
}

class NewDocumentAndStartProcessRequestImpl
  implements NewDocumentAndStartProcessRequest<NewDocumentRequestImpl>
{
  processDefinitionKey: string;
  request: NewDocumentRequestImpl;

  constructor(processDefinitionKey: string, request: NewDocumentRequestImpl) {
    this.processDefinitionKey = processDefinitionKey;
    this.request = request;
  }
}

interface ModifyDocumentAndStartProcessRequest<
  T_MODIFY_DOCUMENT_REQUEST extends ModifyDocumentRequest,
> {
  processDefinitionKey: string;
  request: T_MODIFY_DOCUMENT_REQUEST;
}

class ModifyDocumentAndStartProcessRequestImpl
  implements ModifyDocumentAndStartProcessRequest<ModifyDocumentRequestImpl>
{
  processDefinitionKey: string;
  request: ModifyDocumentRequestImpl;

  constructor(processDefinitionKey: string, request: ModifyDocumentRequestImpl) {
    this.processDefinitionKey = processDefinitionKey;
    this.request = request;
  }
}

interface ProcessDocumentDefinitionRequest {
  processDefinitionKey: string;
  documentDefinitionName: string;
  documentDefinitionVersion: number;
  canInitializeDocument: boolean;
  startableByUser: boolean;
}

class DocumentDefinitionCreateRequest {
  definition: string;

  constructor(definition: string) {
    this.definition = definition;
  }
}

interface UndeployDocumentDefinitionResult {
  documentDefinitionName: string;
  errors: string[];
}

interface DocumentSendMessageRequest {
  subject: string;
  bodyText: string;
}

interface DocumentRoles {
  content: DocumentRole[];
}

interface DocumentRole {
  name: string;
}

interface DocumentType {
  url: string;
  name: string;
}

interface CaseSettings {
  name?: string;
  canHaveAssignee: boolean;
  autoAssignTasks: boolean;
}

interface OpenDocumentCount {
  documentDefinitionName: string;
  openDocumentCount: number;
}

interface CaseListColumn {
  title: string;
  key: string;
  path: string;
  displayType: DisplayType;
  sortable: boolean;
  defaultSort: string;
}

interface CaseListColumnView {
  title: string;
  key: string;
  path: string;
  displayType: string;
  displayTypeParameters: string;
  sortable: boolean;
  defaultSort: string;
}

interface DisplayType {
  type: string;
  displayTypeParameters: DisplayTypeParameters;
}

interface DisplayTypeParameters {
  enum?: {
    [key: string]: string;
  };
  dateFormat?: string;
}

interface DocumentDefinitionVersionsResult {
  name: string;
  versions: Array<number>;
}

interface LoadedValue<T> {
  isLoading: boolean;
  value?: T;
}

interface TemplatePayload {
  documentDefinitionId: string;
  documentDefinitionTitle: string;
}

interface TemplateResponse {
  $id: string;
  $schema: string;
  additionalProperties: boolean;
  properties: {[key: string]: {[key: string]: string}};
  title: string;
  type: string;
}

export {
  AssignHandlerToDocumentResult,
  CaseListColumn,
  CaseListColumnView,
  CaseSettings,
  CreateDocumentDefinitionResponse,
  DefinitionId,
  DisplayType,
  DisplayTypeParameters,
  Document,
  DocumentDefinition,
  DocumentDefinitionCreateRequest,
  DocumentDefinitionId,
  DocumentDefinitions,
  DocumentDefinitionVersionsResult,
  DocumentResult,
  DocumentRole,
  DocumentRoles,
  Documents,
  DocumentSendMessageRequest,
  DocumentType,
  LoadedValue,
  ModifyDocumentAndCompleteTaskRequest,
  ModifyDocumentAndCompleteTaskRequestImpl,
  ModifyDocumentAndCompleteTaskResult,
  ModifyDocumentAndStartProcessRequest,
  ModifyDocumentAndStartProcessRequestImpl,
  ModifyDocumentAndStartProcessResult,
  ModifyDocumentRequest,
  ModifyDocumentRequestImpl,
  NewDocumentAndStartProcessRequest,
  NewDocumentAndStartProcessRequestImpl,
  NewDocumentAndStartProcessResult,
  NewDocumentRequest,
  NewDocumentRequestImpl,
  OpenDocumentCount,
  Page,
  Pageable,
  ProcessDocumentDefinition,
  ProcessDocumentDefinitionId,
  ProcessDocumentDefinitionRequest,
  ProcessDocumentInstance,
  ProcessDocumentInstanceId,
  RelatedFile,
  RelatedFileListItem,
  SortResult,
  SpecifiedDocuments,
  TemplatePayload,
  TemplateResponse,
  UndeployDocumentDefinitionResult,
};
