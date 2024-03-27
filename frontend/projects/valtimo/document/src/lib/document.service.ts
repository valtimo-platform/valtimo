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

import {Injectable} from '@angular/core';
import {HttpClient, HttpHeaders, HttpParams} from '@angular/common/http';
import {catchError, Observable, of} from 'rxjs';
import {
  AssignHandlerToDocumentResult,
  AuditRecord,
  CaseListColumn,
  CaseSettings,
  Document,
  DocumentDefinition,
  DocumentDefinitionCreateRequest,
  DocumentDefinitions,
  DocumentDefinitionVersionsResult,
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
  OpenDocumentCount,
  Page,
  ProcessDocumentDefinition,
  ProcessDocumentDefinitionRequest,
  ProcessDocumentInstance,
  RelatedFile,
  SpecifiedDocuments,
  UndeployDocumentDefinitionResult,
  UploadProcessLink,
} from './models';
import {DocumentSearchRequest} from './document-search-request';
import {
  AssigneeFilter,
  ConfigService,
  NamedUser,
  SearchField,
  SearchFilter,
  SearchFilterRange,
  SearchOperator,
} from '@valtimo/config';
import {AdvancedDocumentSearchRequest} from './advanced-document-search-request';

@Injectable({
  providedIn: 'root',
})
export class DocumentService {
  private readonly valtimoEndpointUri!: string;

  private readonly EMPTY_DOCUMENTS_RESPONSE: Documents | SpecifiedDocuments = {
    content: [],
    empty: true,
    first: false,
    last: false,
    number: 0,
    numberOfElements: 0,
    size: 0,
    sort: false,
    totalElements: 0,
    totalPages: 0,
  };

  constructor(
    private http: HttpClient,
    configService: ConfigService
  ) {
    this.valtimoEndpointUri = configService.config.valtimoApi.endpointUri;
  }

  // Document-calls
  public getAllDefinitions(): Observable<DocumentDefinitions> {
    return this.http.get<DocumentDefinitions>(`${this.valtimoEndpointUri}v1/document-definition?size=1000`);
  }

  public queryDefinitions(params?: any): Observable<Page<DocumentDefinition>> {
    return this.http.get<Page<DocumentDefinition>>(
      `${this.valtimoEndpointUri}v1/document-definition`,
      {params}
    );
  }

  public queryDefinitionsForManagement(params?: any): Observable<Page<DocumentDefinition>> {
    return this.http.get<Page<DocumentDefinition>>(
      `${this.valtimoEndpointUri}management/v1/document-definition`,
      {params}
    );
  }

  public getDocumentDefinition(documentDefinitionName: string): Observable<DocumentDefinition> {
    return this.http.get<DocumentDefinition>(
      `${this.valtimoEndpointUri}v1/document-definition/${documentDefinitionName}`
    );
  }

  public getDocumentDefinitionForManagement(
    documentDefinitionName: string
  ): Observable<DocumentDefinition> {
    return this.http.get<DocumentDefinition>(
      `${this.valtimoEndpointUri}management/v1/document-definition/${documentDefinitionName}`
    );
  }

  public getDocuments(documentSearchRequest: DocumentSearchRequest): Observable<Documents> {
    return this.http.post<Documents>(
      `${this.valtimoEndpointUri}v1/document-search`,
      documentSearchRequest.asHttpBody(),
      {
        params: documentSearchRequest.asHttpParams(),
      }
    );
  }

  public getDocumentsSearch(
    documentSearchRequest: AdvancedDocumentSearchRequest,
    searchOperator?: SearchOperator,
    assigneeFilter?: AssigneeFilter,
    otherFilters?: Array<SearchFilter | SearchFilterRange>
  ): Observable<Documents> {
    const body = {
      ...documentSearchRequest.asHttpBody(),
      ...(searchOperator && {searchOperator}),
      ...(assigneeFilter && {assigneeFilter}),
      ...(otherFilters && {otherFilters}),
    };

    return this.http
      .post<Documents>(
        `${this.valtimoEndpointUri}v1/document-definition/${documentSearchRequest.definitionName}/search`,
        body,
        {params: documentSearchRequest.asHttpParams()}
      )
      .pipe(catchError(() => of(this.EMPTY_DOCUMENTS_RESPONSE as Documents)));
  }

  public getSpecifiedDocumentsSearch(
    documentSearchRequest: AdvancedDocumentSearchRequest,
    searchOperator?: SearchOperator,
    assigneeFilter?: AssigneeFilter,
    otherFilters?: Array<SearchFilter | SearchFilterRange>
  ): Observable<SpecifiedDocuments> {
    const body = {
      ...documentSearchRequest.asHttpBody(),
      ...(searchOperator && {searchOperator}),
      ...(assigneeFilter && {assigneeFilter}),
      ...(otherFilters && {otherFilters}),
    };

    return this.http
      .post<SpecifiedDocuments>(
        `${this.valtimoEndpointUri}v1/case/${documentSearchRequest.definitionName}/search`,
        body,
        {params: documentSearchRequest.asHttpParams()}
      )
      .pipe(catchError(() => of(this.EMPTY_DOCUMENTS_RESPONSE as SpecifiedDocuments)));
  }

  public getDocumentSearchFields(documentDefinitionName: string): Observable<Array<SearchField>> {
    return this.http.get<Array<SearchField>>(
      `${this.valtimoEndpointUri}v1/document-search/${documentDefinitionName}/fields`
    );
  }

  public putDocumentSearch(
    documentDefinitionName: string,
    request: Array<SearchField>
  ): Observable<void> {
    return this.http.put<void>(
      `${this.valtimoEndpointUri}v1/document-search/${documentDefinitionName}/fields`,
      [...request]
    );
  }

  public postDocumentSearch(
    documentDefinitionName: string,
    request: SearchField
  ): Observable<void> {
    return this.http.post<void>(
      `${this.valtimoEndpointUri}v1/document-search/${documentDefinitionName}/fields`,
      {...request}
    );
  }

  public deleteDocumentSearch(documentDefinitionName: string, key: string): Observable<any> {
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

  public getDropdownDataProviders(): Observable<Array<string>> {
    return this.http.get<Array<string>>(`${this.valtimoEndpointUri}v1/data/dropdown-list/provider`);
  }

  public getDropdownData(
    provider: string,
    documentDefinitionName: string,
    fieldKey: string
  ): Observable<object> {
    const dropdownListKey = encodeURI(documentDefinitionName + '_' + fieldKey);
    return this.http.get<object>(
      `${this.valtimoEndpointUri}v1/data/dropdown-list?provider=${provider}&key=${dropdownListKey}`
    );
  }

  public postDropdownData(
    provider: string,
    documentDefinitionName: string,
    fieldKey: string,
    dropdownData: object
  ): Observable<object> {
    const dropdownListKey = encodeURI(documentDefinitionName + '_' + fieldKey);
    return this.http.post<object>(
      `${this.valtimoEndpointUri}v1/data/dropdown-list?provider=${provider}&key=${dropdownListKey}`,
      dropdownData
    );
  }

  public deleteDropdownData(
    provider: string,
    documentDefinitionName: string,
    fieldKey: string
  ): Observable<object> {
    const dropdownListKey = encodeURI(documentDefinitionName + '_' + fieldKey);
    return this.http.delete<object>(
      `${this.valtimoEndpointUri}v1/data/dropdown-list?provider=${provider}&key=${dropdownListKey}`
    );
  }

  public getDocument(documentId: string): Observable<Document> {
    return this.http.get<Document>(`${this.valtimoEndpointUri}v1/document/${documentId}`);
  }

  public modifyDocument(document: any): Observable<DocumentResult> {
    return this.http.put<DocumentResult>(`${this.valtimoEndpointUri}v1/document`, document);
  }

  // ProcessDocument-calls
  public getProcessDocumentDefinitions(): Observable<ProcessDocumentDefinition> {
    return this.http.get<ProcessDocumentDefinition>(
      `${this.valtimoEndpointUri}v1/process-document/definition`
    );
  }

  public findProcessDocumentDefinitions(
    documentDefinitionName: string
  ): Observable<ProcessDocumentDefinition[]> {
    return this.http.get<ProcessDocumentDefinition[]>(
      `${this.valtimoEndpointUri}v1/process-document/definition/document/${documentDefinitionName}`
    );
  }

  public findProcessDocumentDefinitionsByStartableByUser(
    documentDefinitionName: string,
    startableByUser: boolean
  ): Observable<ProcessDocumentDefinition[]> {
    return this.http.get<ProcessDocumentDefinition[]>(
      `${this.valtimoEndpointUri}v1/process-document/definition/document/${documentDefinitionName}?startableByUser=${startableByUser}`
    );
  }

  public findProcessDocumentDefinitionsByVersion(
    documentDefinitionName: string,
    version: number
  ): Observable<ProcessDocumentDefinition[]> {
    return this.http.get<ProcessDocumentDefinition[]>(
      `${this.valtimoEndpointUri}v1/process-document/definition/document/${documentDefinitionName}/version/${version}`
    );
  }

  public findProcessDocumentDefinitionsByProcessDefinitionKey(
    processDefinitionKey: string
  ): Observable<ProcessDocumentDefinition[]> {
    return this.http.get<ProcessDocumentDefinition[]>(
      `${this.valtimoEndpointUri}v1/process-document/definition/process/${processDefinitionKey}`
    );
  }

  public findProcessDocumentInstances(documentId: string): Observable<ProcessDocumentInstance[]> {
    return this.http.get<ProcessDocumentInstance[]>(
      `${this.valtimoEndpointUri}v1/process-document/instance/document/${documentId}`
    );
  }

  public newDocumentAndStartProcess(
    request: NewDocumentAndStartProcessRequestImpl
  ): Observable<NewDocumentAndStartProcessResult> {
    return this.http.post<NewDocumentAndStartProcessResult>(
      `${this.valtimoEndpointUri}v1/process-document/operation/new-document-and-start-process`,
      request
    );
  }

  public modifyDocumentAndCompleteTask(
    request: ModifyDocumentAndCompleteTaskRequestImpl
  ): Observable<ModifyDocumentAndCompleteTaskResult> {
    return this.http.post<ModifyDocumentAndCompleteTaskResult>(
      `${this.valtimoEndpointUri}v1/process-document/operation/modify-document-and-complete-task`,
      request
    );
  }

  public modifyDocumentAndStartProcess(
    request: ModifyDocumentAndStartProcessRequestImpl
  ): Observable<ModifyDocumentAndStartProcessResult> {
    return this.http.post<ModifyDocumentAndStartProcessResult>(
      `${this.valtimoEndpointUri}v1/process-document/operation/modify-document-and-start-process`,
      request
    );
  }

  public createProcessDocumentDefinition(
    request: ProcessDocumentDefinitionRequest
  ): Observable<ProcessDocumentDefinition> {
    return this.http.post<ProcessDocumentDefinition>(
      `${this.valtimoEndpointUri}v1/process-document/definition`,
      request
    );
  }

  public createDocumentDefinitionForManagement(
    documentDefinitionCreateRequest: DocumentDefinitionCreateRequest
  ): Observable<void> {
    const options = {
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
      }),
    };
    return this.http.post<void>(
      `${this.valtimoEndpointUri}management/v1/document-definition`,
      documentDefinitionCreateRequest,
      options
    );
  }

  public deleteProcessDocumentDefinition(
    request: ProcessDocumentDefinitionRequest
  ): Observable<any> {
    const options = {
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
      }),
      body: request,
    };
    return this.http.delete(`${this.valtimoEndpointUri}v1/process-document/definition`, options);
  }

  public getAuditLog(documentId: string, page: number = 0): Observable<Page<AuditRecord>> {
    let params = new HttpParams();
    params = params.set('page', page.toString());
    return this.http.get<Page<AuditRecord>>(
      `${this.valtimoEndpointUri}v1/process-document/instance/document/${documentId}/audit`,
      {params}
    );
  }

  public assignResource(documentId: string, resourceId: string): Observable<void> {
    return this.http.post<void>(
      `${this.valtimoEndpointUri}v1/document/${documentId}/resource/${resourceId}`,
      {}
    );
  }

  public removeResource(documentId: string, resourceId: string): Observable<void> {
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

  public removeDocumentDefinitionForManagement(
    name: string
  ): Observable<UndeployDocumentDefinitionResult> {
    return this.http.delete<UndeployDocumentDefinitionResult>(
      `${this.valtimoEndpointUri}management/v1/document-definition/${name}`
    );
  }

  public sendMessage(documentId: string, request: DocumentSendMessageRequest): Observable<any> {
    return this.http.post(`${this.valtimoEndpointUri}v1/document/${documentId}/message`, request);
  }

  public getDocumentTypes(documentDefinitionName: string): Observable<Array<DocumentType>> {
    return this.http.get<Array<DocumentType>>(
      `${this.valtimoEndpointUri}v1/documentdefinition/${documentDefinitionName}/zaaktype/documenttype`
    );
  }

  public getLinkedUploadProcess(documentDefinitionName: string): Observable<UploadProcessLink> {
    return this.http.get<UploadProcessLink>(
      `${this.valtimoEndpointUri}v1/process-document/demo/${documentDefinitionName}/process`
    );
  }

  public updateLinkedUploadProcess(
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

  public deleteLinkedUploadProcess(documentDefinitionName: string): Observable<void> {
    return this.http.delete<void>(
      `${this.valtimoEndpointUri}v1/process-document/demo/${documentDefinitionName}/process`
    );
  }

  public getProcessDocumentDefinitionFromProcessInstanceId(
    processInstanceId: string
  ): Observable<ProcessDocumentDefinition> {
    return this.http.get<ProcessDocumentDefinition>(
      `${this.valtimoEndpointUri}v1/process-document/definition/processinstance/${processInstanceId}`
    );
  }

  public assignHandlerToDocument(
    documentId: string,
    assigneeId: string
  ): Observable<AssignHandlerToDocumentResult> {
    return this.http.post<AssignHandlerToDocumentResult>(
      `${this.valtimoEndpointUri}v1/document/${documentId}/assign`,
      {assigneeId}
    );
  }

  public unassignHandlerFromDocument(documentId: string): Observable<void> {
    return this.http.post<void>(`${this.valtimoEndpointUri}v1/document/${documentId}/unassign`, {});
  }

  public getCandidateUsers(documentId: string): Observable<Array<NamedUser>> {
    return this.http.get<Array<NamedUser>>(
      `${this.valtimoEndpointUri}v1/document/${documentId}/candidate-user`
    );
  }

  public getOpenDocumentCount(): Observable<Array<OpenDocumentCount>> {
    return this.http.get<Array<OpenDocumentCount>>(
      `${this.valtimoEndpointUri}v1/document-definition/open/count`
    );
  }

  public patchCaseSettingsForManagement(
    documentDefinitionName: string,
    request: CaseSettings
  ): Observable<CaseSettings> {
    return this.http.patch<CaseSettings>(
      `${this.valtimoEndpointUri}management/v1/case/${documentDefinitionName}/settings`,
      {...request}
    );
  }

  public getCaseSettings(documentDefinitionName: string): Observable<CaseSettings> {
    return this.http.get<CaseSettings>(
      `${this.valtimoEndpointUri}v1/case/${documentDefinitionName}/settings`
    );
  }

  public getCaseSettingsForManagement(documentDefinitionName: string): Observable<CaseSettings> {
    return this.http.get<CaseSettings>(
      `${this.valtimoEndpointUri}management/v1/case/${documentDefinitionName}/settings`
    );
  }

  public getCaseList(documentDefinitionName: string): Observable<Array<CaseListColumn>> {
    return this.http.get<Array<CaseListColumn>>(
      `${this.valtimoEndpointUri}v1/case/${documentDefinitionName}/list-column`
    );
  }

  public getCaseListForManagement(
    documentDefinitionName: string
  ): Observable<Array<CaseListColumn>> {
    return this.http.get<Array<CaseListColumn>>(
      `${this.valtimoEndpointUri}management/v1/case/${documentDefinitionName}/list-column`
    );
  }

  public postCaseListForManagement(
    documentDefinitionName: string,
    request: CaseListColumn
  ): Observable<CaseListColumn> {
    return this.http.post<CaseListColumn>(
      `${this.valtimoEndpointUri}management/v1/case/${documentDefinitionName}/list-column`,
      {...request}
    );
  }

  public putCaseListForManagement(
    documentDefinitionName: string,
    request: Array<CaseListColumn>
  ): Observable<Array<CaseListColumn>> {
    return this.http.put<Array<CaseListColumn>>(
      `${this.valtimoEndpointUri}management/v1/case/${documentDefinitionName}/list-column`,
      [...request]
    );
  }

  public deleteCaseListForManagement(
    documentDefinitionName: string,
    columnKey: string
  ): Observable<CaseListColumn> {
    return this.http.delete<CaseListColumn>(
      `${this.valtimoEndpointUri}management/v1/case/${documentDefinitionName}/list-column/${columnKey}`
    );
  }

  public getZakenApiDocuments(documentId: string): Observable<Array<RelatedFile>> {
    return this.http.get<Array<RelatedFile>>(
      `${this.valtimoEndpointUri}v1/zaken-api/document/${documentId}/files`
    );
  }

  public getDocumentDefinitionVersions(
    documentDefinitionName: string
  ): Observable<DocumentDefinitionVersionsResult> {
    return this.http.get<DocumentDefinitionVersionsResult>(
      `${this.valtimoEndpointUri}management/v1/document-definition/${documentDefinitionName}/version`
    );
  }

  public getDocumentDefinitionByVersion(
    documentDefinitionName: string,
    version: number
  ): Observable<DocumentDefinition> {
    return this.http.get<DocumentDefinition>(
      `${this.valtimoEndpointUri}management/v1/document-definition/${documentDefinitionName}/version/${version}`
    );
  }
}
