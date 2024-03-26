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

import {Injectable} from '@angular/core';
import {Observable} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {ConfigService, SearchField} from '@valtimo/config';
import {Objecttype, SearchListColumn} from '../models/object-management.model';

@Injectable({
  providedIn: 'root',
})
export class ObjectManagementService {
  private valtimoEndpointUri: string;

  constructor(
    private http: HttpClient,
    configService: ConfigService
  ) {
    this.valtimoEndpointUri = configService.config.valtimoApi.endpointUri;
  }

  public getAllObjects(): Observable<Objecttype[]> {
    return this.http.get<Objecttype[]>(
      `${this.valtimoEndpointUri}v1/object/management/configuration`
    );
  }

  public getObjectById(id: string): Observable<Objecttype> {
    return this.http.get<Objecttype>(
      `${this.valtimoEndpointUri}v1/object/management/configuration/${id}`
    );
  }

  public createObject(payload: Objecttype): Observable<Objecttype> {
    return this.http.post<Objecttype>(
      `${this.valtimoEndpointUri}v1/object/management/configuration`,
      payload
    );
  }

  public editObject(payload: Objecttype): Observable<Objecttype> {
    return this.http.put<Objecttype>(
      `${this.valtimoEndpointUri}v1/object/management/configuration`,
      payload
    );
  }

  getSearchList(ownerId: string): Observable<Array<SearchListColumn>> {
    return this.http.get<Array<SearchListColumn>>(
      `${this.valtimoEndpointUri}v1/search/list-column/${ownerId}`
    );
  }

  postSearchList(ownerId: string, request: SearchListColumn): Observable<SearchListColumn> {
    return this.http.post<SearchListColumn>(
      `${this.valtimoEndpointUri}v1/search/list-column/${ownerId}`,
      {...request, ownerId}
    );
  }

  putSearchList(
    ownerId: string,
    columnKey: string,
    request: SearchListColumn
  ): Observable<Array<SearchListColumn>> {
    return this.http.put<Array<SearchListColumn>>(
      `${this.valtimoEndpointUri}v1/search/list-column/${ownerId}/${columnKey}`,
      {...request, ownerId}
    );
  }

  putSearchListColumns(
    ownerId: string,
    request: Array<SearchListColumn>
  ): Observable<Array<SearchListColumn>> {
    return this.http.put<Array<SearchListColumn>>(
      `${this.valtimoEndpointUri}v1/search/list-column/${ownerId}/search-list-columns`,
      [...request]
    );
  }

  deleteSearchList(ownerId: string, columnKey: string): Observable<SearchListColumn> {
    return this.http.delete<SearchListColumn>(
      `${this.valtimoEndpointUri}v1/search/list-column/${ownerId}/${columnKey}`
    );
  }

  getSearchField(ownerId: string): Observable<Array<SearchField>> {
    return this.http.get<Array<SearchField>>(
      `${this.valtimoEndpointUri}v1/search/field/${ownerId}`
    );
  }

  postSearchField(ownerId: string, request: SearchField): Observable<SearchField> {
    return this.http.post<SearchField>(`${this.valtimoEndpointUri}v1/search/field/${ownerId}`, {
      ...request,
      ownerId,
    });
  }

  putSearchField(
    ownerId: string,
    key: string,
    request: SearchField
  ): Observable<Array<SearchField>> {
    return this.http.put<Array<SearchField>>(
      `${this.valtimoEndpointUri}v1/search/field/${ownerId}/${key}`,
      {...request, ownerId}
    );
  }

  putSearchFields(ownerId: string, request: Array<SearchField>): Observable<Array<SearchField>> {
    return this.http.put<Array<SearchField>>(
      `${this.valtimoEndpointUri}v1/search/field/${ownerId}/fields`,
      [...request]
    );
  }

  deleteSearchField(ownerId: string, key: string): Observable<SearchField> {
    return this.http.delete<SearchField>(
      `${this.valtimoEndpointUri}v1/search/field/${ownerId}/${key}`
    );
  }
}
