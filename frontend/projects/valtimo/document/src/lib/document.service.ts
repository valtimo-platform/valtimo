/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
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

import {Injectable} from '@angular/core';
import {HttpClient, HttpHeaders, HttpParams} from '@angular/common/http';
import {Observable} from 'rxjs';
import {
  AssignHandlerToDocumentResult,
  AuditRecord,
  Document,
  DocumentDefinition,
  DocumentDefinitionCreateRequest,
  DocumentDefinitions,
  DocumentResult,
  Documents,
  DocumentSendMessageRequest,
  DocumentType,
  ModifyDocumentAndCompleteTaskRequestImpl,
  ModifyDocumentAndCompleteTaskResult,
  ModifyDocumentAndStartProcessRequestImpl,
  ModifyDocumentAndStartProcessResult,
  NewDocumentAndStartProcessRequestImpl,
  NewDocumentAndStartProcessResult,
  Page,
  ProcessDocumentDefinition,
  ProcessDocumentDefinitionRequest,
  ProcessDocumentInstance,
  UndeployDocumentDefinitionResult,
  UploadProcessLink,
} from './models';
import {DocumentSearchRequest} from './document-search-request';
import {
  ConfigService,
  SearchField,
  SearchFilter,
  SearchFilterRange,
  SearchOperator,
  User,
} from '@valtimo/config';
import {AdvancedDocumentSearchRequest} from './advanced-document-search-request';

@Injectable({
  providedIn: 'root',
})
export class DocumentService {
  private valtimoEndpointUri: string;

  constructor(private http: HttpClient, configService: ConfigService) {
    this.valtimoEndpointUri = configService.config.valtimoApi.endpointUri;
  }

  // Document-calls
  public getAllDefinitions(): Observable<DocumentDefinitions> {
    return this.http.get<DocumentDefinitions>(`${this.valtimoEndpointUri}v1/document-definition`);
  }

  queryDefinitions(params?: any): Observable<Page<DocumentDefinition>> {
    return this.http.get<Page<DocumentDefinition>>(
      `${this.valtimoEndpointUri}v1/document-definition`,
      {params}
    );
  }

  getDocumentDefinition(documentDefinitionName: string): Observable<DocumentDefinition> {
    return this.http.get<DocumentDefinition>(
      `${this.valtimoEndpointUri}v1/document-definition/${documentDefinitionName}`
    );
  }

  getDocuments(documentSearchRequest: DocumentSearchRequest): Observable<Documents> {
    return this.http.post<Documents>(
      `${this.valtimoEndpointUri}v1/document-search`,
      documentSearchRequest.asHttpBody(),
      {
        params: documentSearchRequest.asHttpParams(),
      }
    );
  }

  getDocumentsSearch(
    documentSearchRequest: AdvancedDocumentSearchRequest,
    searchOperator?: SearchOperator,
    otherFilters?: Array<SearchFilter | SearchFilterRange>
  ): Observable<Documents> {
    const body = documentSearchRequest.asHttpBody();

    if (searchOperator) {
      body.searchOperator = searchOperator;
    }

    if (otherFilters) {
      body.otherFilters = otherFilters;
    }

    return this.http.post<Documents>(
      `${this.valtimoEndpointUri}v1/document-definition/${documentSearchRequest.definitionName}/search`,
      body,
      {params: documentSearchRequest.asHttpParams()}
    );
  }

  getDocumentSearchFields(documentDefinitionName: string): Observable<Array<SearchField>> {
    return this.http.get<Array<SearchField>>(
      `${this.valtimoEndpointUri}v1/document-search/${documentDefinitionName}/fields`
    );
  }

  putDocumentSearch(documentDefinitionName: string, request: Array<SearchField>): Observable<void> {
    return this.http.put<void>(
      `${this.valtimoEndpointUri}v1/document-search/${documentDefinitionName}/fields`,
      [...request]
    );
  }

  postDocumentSearch(documentDefinitionName: string, request: SearchField): Observable<void> {
    return this.http.post<void>(
      `${this.valtimoEndpointUri}v1/document-search/${documentDefinitionName}/fields`,
      {...request}
    );
  }

  deleteDocumentSearch(documentDefinitionName: string, key: string): Observable<any> {
    const options = {
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
      }),
    };
    return this.http.delete(
      `${this.valtimoEndpointUri}v1/document-search/${documentDefinitionName}/fields?key=${key}`,
      options
    );
  }

  public getDocumentRoles(documentDefinitionName: string): Observable<Array<string>> {
    return this.http.get<Array<string>>(
      `${this.valtimoEndpointUri}v1/document-definition/${documentDefinitionName}/roles`
    );
  }

  public modifyDocumentRoles(documentDefinitionName: string, roles: any): Observable<void> {
    return this.http.put<void>(
      `${this.valtimoEndpointUri}v1/document-definition/${documentDefinitionName}/roles`,
      roles
    );
  }

  getDocument(documentId: string): Observable<Document> {
    return this.http.get<Document>(`${this.valtimoEndpointUri}v1/document/${documentId}`);
  }

  modifyDocument(document: any): Observable<DocumentResult> {
    return this.http.put<DocumentResult>(`${this.valtimoEndpointUri}v1/document`, document);
  }

  // ProcessDocument-calls
  getProcessDocumentDefinitions(): Observable<ProcessDocumentDefinition> {
    return this.http.get<ProcessDocumentDefinition>(
      `${this.valtimoEndpointUri}v1/process-document/definition`
    );
  }

  findProcessDocumentDefinitions(
    documentDefinitionName: string
  ): Observable<ProcessDocumentDefinition[]> {
    return this.http.get<ProcessDocumentDefinition[]>(
      `${this.valtimoEndpointUri}v1/process-document/definition/document/${documentDefinitionName}`
    );
  }

  findProcessDocumentInstances(documentId: string): Observable<ProcessDocumentInstance[]> {
    return this.http.get<ProcessDocumentInstance[]>(
      `${this.valtimoEndpointUri}v1/process-document/instance/document/${documentId}`
    );
  }

  newDocumentAndStartProcess(
    request: NewDocumentAndStartProcessRequestImpl
  ): Observable<NewDocumentAndStartProcessResult> {
    return this.http.post<NewDocumentAndStartProcessResult>(
      `${this.valtimoEndpointUri}v1/process-document/operation/new-document-and-start-process`,
      request
    );
  }

  modifyDocumentAndCompleteTask(
    request: ModifyDocumentAndCompleteTaskRequestImpl
  ): Observable<ModifyDocumentAndCompleteTaskResult> {
    return this.http.post<ModifyDocumentAndCompleteTaskResult>(
      `${this.valtimoEndpointUri}v1/process-document/operation/modify-document-and-complete-task`,
      request
    );
  }

  modifyDocumentAndStartProcess(
    request: ModifyDocumentAndStartProcessRequestImpl
  ): Observable<ModifyDocumentAndStartProcessResult> {
    return this.http.post<ModifyDocumentAndStartProcessResult>(
      `${this.valtimoEndpointUri}v1/process-document/operation/modify-document-and-start-process`,
      request
    );
  }

  createProcessDocumentDefinition(
    request: ProcessDocumentDefinitionRequest
  ): Observable<ProcessDocumentDefinition> {
    return this.http.post<ProcessDocumentDefinition>(
      `${this.valtimoEndpointUri}v1/process-document/definition`,
      request
    );
  }

  createDocumentDefinition(
    documentDefinitionCreateRequest: DocumentDefinitionCreateRequest
  ): Observable<void> {
    const options = {
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
      }),
    };
    return this.http.post<void>(
      `${this.valtimoEndpointUri}v1/document-definition`,
      documentDefinitionCreateRequest,
      options
    );
  }

  deleteProcessDocumentDefinition(request: ProcessDocumentDefinitionRequest): Observable<any> {
    const options = {
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
      }),
      body: request,
    };
    return this.http.delete(`${this.valtimoEndpointUri}v1/process-document/definition`, options);
  }

  getAuditLog(documentId: string, page: number = 0): Observable<Page<AuditRecord>> {
    let params = new HttpParams();
    params = params.set('page', page.toString());
    return this.http.get<Page<AuditRecord>>(
      `${this.valtimoEndpointUri}v1/process-document/instance/document/${documentId}/audit`,
      {params}
    );
  }

  assignResource(documentId: string, resourceId: string): Observable<void> {
    return this.http.post<void>(
      `${this.valtimoEndpointUri}v1/document/${documentId}/resource/${resourceId}`,
      {}
    );
  }

  removeResource(documentId: string, resourceId: string): Observable<void> {
    const options = {
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
      }),
    };
    return this.http.delete<void>(
      `${this.valtimoEndpointUri}v1/document/${documentId}/resource/${resourceId}`,
      options
    );
  }

  removeDocumentDefinition(name: string): Observable<UndeployDocumentDefinitionResult> {
    return this.http.delete<UndeployDocumentDefinitionResult>(
      `${this.valtimoEndpointUri}v1/document-definition/${name}`
    );
  }

  sendMessage(documentId: string, request: DocumentSendMessageRequest): Observable<any> {
    return this.http.post(`${this.valtimoEndpointUri}v1/document/${documentId}/message`, request);
  }

  getDocumentTypes(documentDefinitionName: string): Observable<Array<DocumentType>> {
    return this.http.get<Array<DocumentType>>(
      `${this.valtimoEndpointUri}v1/documentdefinition/${documentDefinitionName}/zaaktype/documenttype`
    );
  }

  getLinkedUploadProcess(documentDefinitionName: string): Observable<UploadProcessLink> {
    return this.http.get<UploadProcessLink>(
      `${this.valtimoEndpointUri}v1/process-document/demo/${documentDefinitionName}/process`
    );
  }

  updateLinkedUploadProcess(
    documentDefinitionName: string,
    processDefinitionKey: string
  ): Observable<UploadProcessLink> {
    return this.http.put<UploadProcessLink>(
      `${this.valtimoEndpointUri}v1/process-document/demo/${documentDefinitionName}/process`,
      {
        processDefinitionKey,
        linkType: 'DOCUMENT_UPLOAD',
      }
    );
  }

  deleteLinkedUploadProcess(documentDefinitionName: string): Observable<void> {
    return this.http.delete<void>(
      `${this.valtimoEndpointUri}v1/process-document/demo/${documentDefinitionName}/process`
    );
  }

  getProcessDocumentDefinitionFromProcessInstanceId(
    processInstanceId: string
  ): Observable<ProcessDocumentDefinition> {
    return this.http.get<ProcessDocumentDefinition>(
      `${this.valtimoEndpointUri}v1/process-document/definition/processinstance/${processInstanceId}`
    );
  }

  assignHandlerToDocument(
    documentId: string,
    assigneeId: string
  ): Observable<AssignHandlerToDocumentResult> {
    return this.http.post<AssignHandlerToDocumentResult>(
      `${this.valtimoEndpointUri}v1/document/${documentId}/assign`,
      {assigneeId}
    );
  }

  unassignHandlerFromDocument(documentId: string): Observable<void> {
    return this.http.post<void>(`${this.valtimoEndpointUri}v1/document/${documentId}/unassign`, {});
  }

  getCandidateUsers(documentId: string): Observable<Array<User>> {
    return this.http.get<Array<User>>(
      `${this.valtimoEndpointUri}v1/document/${documentId}/candidate-user`
    );
  }
}
