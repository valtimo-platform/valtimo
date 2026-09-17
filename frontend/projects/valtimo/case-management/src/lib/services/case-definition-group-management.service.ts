/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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

import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {BaseApiService, ConfigService} from '@valtimo/shared';
import {GroupListColumn, GroupSearchField} from '@valtimo/document';
import {Observable} from 'rxjs';
import {
  AddGroupMemberRequest,
  CaseDefinitionGroupCreateRequest,
  CaseDefinitionGroupResponse,
  CaseDefinitionGroupUpdateRequest,
  CaseDefinitionGroupWithMembersResponse,
  GroupListColumnRequest,
  GroupMember,
  GroupMemberOrderRequest,
  GroupPathMapping,
  GroupSearchFieldRequest,
} from '../models';

@Injectable({
  providedIn: 'root',
})
export class CaseDefinitionGroupManagementService extends BaseApiService {
  private readonly _basePath = 'management/v1/case-definition-group';

  constructor(
    protected readonly httpClient: HttpClient,
    protected readonly configService: ConfigService
  ) {
    super(httpClient, configService);
  }

  public getGroups(): Observable<CaseDefinitionGroupResponse[]> {
    return this.httpClient.get<CaseDefinitionGroupResponse[]>(this.getApiUrl(this._basePath));
  }

  public getGroup(groupKey: string): Observable<CaseDefinitionGroupWithMembersResponse> {
    return this.httpClient.get<CaseDefinitionGroupWithMembersResponse>(
      this.getApiUrl(`${this._basePath}/${groupKey}`)
    );
  }

  public createGroup(
    request: CaseDefinitionGroupCreateRequest
  ): Observable<CaseDefinitionGroupResponse> {
    return this.httpClient.post<CaseDefinitionGroupResponse>(this.getApiUrl(this._basePath), request);
  }

  public updateGroup(
    groupKey: string,
    request: CaseDefinitionGroupUpdateRequest
  ): Observable<CaseDefinitionGroupResponse> {
    return this.httpClient.put<CaseDefinitionGroupResponse>(
      this.getApiUrl(`${this._basePath}/${groupKey}`),
      request
    );
  }

  public deleteGroup(groupKey: string): Observable<void> {
    return this.httpClient.delete<void>(this.getApiUrl(`${this._basePath}/${groupKey}`));
  }

  public getMembers(groupKey: string): Observable<GroupMember[]> {
    return this.httpClient.get<GroupMember[]>(
      this.getApiUrl(`${this._basePath}/${groupKey}/member`)
    );
  }

  public addMember(groupKey: string, request: AddGroupMemberRequest): Observable<GroupMember> {
    return this.httpClient.post<GroupMember>(
      this.getApiUrl(`${this._basePath}/${groupKey}/member`),
      request
    );
  }

  public removeMember(groupKey: string, caseDefinitionKey: string): Observable<void> {
    return this.httpClient.delete<void>(
      this.getApiUrl(`${this._basePath}/${groupKey}/member/${caseDefinitionKey}`)
    );
  }

  public updateMemberOrder(
    groupKey: string,
    request: GroupMemberOrderRequest
  ): Observable<GroupMember[]> {
    return this.httpClient.put<GroupMember[]>(
      this.getApiUrl(`${this._basePath}/${groupKey}/member/order`),
      request
    );
  }

  public getListColumns(groupKey: string): Observable<GroupListColumn[]> {
    return this.httpClient.get<GroupListColumn[]>(
      this.getApiUrl(`${this._basePath}/${groupKey}/list-column`)
    );
  }

  public updateListColumns(
    groupKey: string,
    columns: GroupListColumnRequest[]
  ): Observable<GroupListColumn[]> {
    return this.httpClient.put<GroupListColumn[]>(
      this.getApiUrl(`${this._basePath}/${groupKey}/list-column`),
      columns
    );
  }

  public getListColumnPathMappings(
    groupKey: string,
    columnKey: string
  ): Observable<GroupPathMapping[]> {
    return this.httpClient.get<GroupPathMapping[]>(
      this.getApiUrl(`${this._basePath}/${groupKey}/list-column/${columnKey}/path-mapping`)
    );
  }

  public updateListColumnPathMappings(
    groupKey: string,
    columnKey: string,
    mappings: GroupPathMapping[]
  ): Observable<GroupPathMapping[]> {
    return this.httpClient.put<GroupPathMapping[]>(
      this.getApiUrl(`${this._basePath}/${groupKey}/list-column/${columnKey}/path-mapping`),
      mappings
    );
  }

  public getSearchFields(groupKey: string): Observable<GroupSearchField[]> {
    return this.httpClient.get<GroupSearchField[]>(
      this.getApiUrl(`${this._basePath}/${groupKey}/search-field`)
    );
  }

  public updateSearchFields(
    groupKey: string,
    fields: GroupSearchFieldRequest[]
  ): Observable<GroupSearchField[]> {
    return this.httpClient.put<GroupSearchField[]>(
      this.getApiUrl(`${this._basePath}/${groupKey}/search-field`),
      fields
    );
  }

  public getSearchFieldPathMappings(
    groupKey: string,
    fieldKey: string
  ): Observable<GroupPathMapping[]> {
    return this.httpClient.get<GroupPathMapping[]>(
      this.getApiUrl(`${this._basePath}/${groupKey}/search-field/${fieldKey}/path-mapping`)
    );
  }

  public updateSearchFieldPathMappings(
    groupKey: string,
    fieldKey: string,
    mappings: GroupPathMapping[]
  ): Observable<GroupPathMapping[]> {
    return this.httpClient.put<GroupPathMapping[]>(
      this.getApiUrl(`${this._basePath}/${groupKey}/search-field/${fieldKey}/path-mapping`),
      mappings
    );
  }
}
