/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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
import {HttpClient, HttpParams} from '@angular/common/http';
import {BaseApiService, ConfigService} from '@valtimo/shared';
import {Observable} from 'rxjs';
import {
  IkoDataAggregateCreateRequest,
  IkoDataAggregateListResponse,
  IkoDataAggregateResponse,
  IkoDataAggregateUpdateRequest,
  IkoDataRequestCreateRequest,
  IkoDataRequestListResponse,
  IkoDataRequestResponse,
  IkoDataRequestUpdateRequest,
  IkoRepositoryConfigCreateRequest,
  IkoRepositoryConfigListResponse,
  IkoRepositoryConfigResponse,
  IkoRepositoryConfigUpdateRequest,
  IkoSearchFieldCreateRequest,
  IkoSearchFieldResponse,
  IkoSearchFieldUpdateRequest,
  IkoTabCreateRequest,
  IkoTabUpdateRequest,
  PropertyField,
  TabDto,
  WidgetDto,
} from '../models';

@Injectable({
  providedIn: 'root',
})
export class IkoManagementApiService extends BaseApiService {
  constructor(
    protected override httpClient: HttpClient,
    protected override configService: ConfigService
  ) {
    super(httpClient, configService);
  }

  public getIkoDataAggregates(
    key?: string,
    title?: string,
    page: number = 0,
    size: number = 100,
    sort: string = 'title,asc'
  ): Observable<{content: IkoDataAggregateListResponse[]}> {
    let params = new HttpParams().set('page', page).set('size', size).set('sort', sort);
    if (key) params = params.set('key', key);
    if (title) params = params.set('title', title);
    return this.httpClient.get<{content: IkoDataAggregateListResponse[]}>(
      this.getApiUrl('/v1/iko-data-aggregate'),
      {params}
    );
  }

  public getIkoDataAggregate(key: string): Observable<IkoDataAggregateResponse> {
    return this.httpClient.get<IkoDataAggregateResponse>(
      this.getApiUrl(`/v1/iko-data-aggregate/${key}`)
    );
  }

  public createIkoDataAggregate(
    key: string,
    body: IkoDataAggregateCreateRequest
  ): Observable<IkoDataAggregateResponse> {
    return this.httpClient.post<IkoDataAggregateResponse>(
      this.getApiUrl(`/v1/iko-data-aggregate/${key}`),
      body
    );
  }

  public updateIkoDataAggregate(
    key: string,
    body: IkoDataAggregateUpdateRequest
  ): Observable<IkoDataAggregateResponse> {
    return this.httpClient.put<IkoDataAggregateResponse>(
      this.getApiUrl(`/v1/iko-data-aggregate/${key}`),
      body
    );
  }

  public deleteIkoDataAggregate(key: string): Observable<void> {
    return this.httpClient.delete<void>(this.getApiUrl(`/v1/iko-data-aggregate/${key}`));
  }

  public getIkoDataAggregatePropertyFields(type: string): Observable<PropertyField[]> {
    return this.httpClient.get<PropertyField[]>(
      this.getApiUrl(`/v1/iko-property-fields/${type}/data-aggregate`)
    );
  }

  public getIkoDataRequests(aggregateKey: string): Observable<IkoDataRequestListResponse[]> {
    return this.httpClient.get<IkoDataRequestListResponse[]>(
      this.getApiUrl(`/v1/iko-data-aggregate/${aggregateKey}/data-request`)
    );
  }

  public getIkoDataRequest(aggregateKey: string, key: string): Observable<IkoDataRequestResponse> {
    return this.httpClient.get<IkoDataRequestResponse>(
      this.getApiUrl(`/v1/iko-data-aggregate/${aggregateKey}/data-request/${key}`)
    );
  }

  public createIkoDataRequest(
    aggregateKey: string,
    key: string,
    body: IkoDataRequestCreateRequest
  ): Observable<IkoDataRequestResponse> {
    return this.httpClient.post<IkoDataRequestResponse>(
      this.getApiUrl(`/v1/iko-data-aggregate/${aggregateKey}/data-request/${key}`),
      body
    );
  }

  public updateIkoDataRequests(
    aggregateKey: string,
    body: IkoDataRequestUpdateRequest[]
  ): Observable<IkoDataRequestResponse[]> {
    return this.httpClient.put<IkoDataRequestResponse[]>(
      this.getApiUrl(`/v1/iko-data-aggregate/${aggregateKey}/data-request`),
      body
    );
  }

  public deleteIkoDataRequest(aggregateKey: string, key: string): Observable<void> {
    return this.httpClient.delete<void>(
      this.getApiUrl(`/v1/iko-data-aggregate/${aggregateKey}/data-request/${key}`)
    );
  }

  public getIkoDataRequestPropertyFields(type: string): Observable<PropertyField[]> {
    return this.httpClient.get<PropertyField[]>(
      this.getApiUrl(`/v1/iko-property-fields/${type}/data-request`)
    );
  }

  public getIkoRepositoryConfigs(): Observable<{content: IkoRepositoryConfigListResponse[]}> {
    return this.httpClient.get<{content: IkoRepositoryConfigListResponse[]}>(
      this.getApiUrl(`/management/v1/iko`)
    );
  }

  public getIkoRepositoryConfig(key: string): Observable<IkoRepositoryConfigResponse> {
    return this.httpClient.get<IkoRepositoryConfigResponse>(
      this.getApiUrl(`/management/v1/iko/${key}`)
    );
  }

  public createIkoRepositoryConfig(
    key: string,
    body: IkoRepositoryConfigCreateRequest
  ): Observable<IkoRepositoryConfigResponse> {
    return this.httpClient.post<IkoRepositoryConfigResponse>(
      this.getApiUrl(`management/v1/iko/${key}`),
      body
    );
  }

  public updateIkoRepositoryConfig(
    key: string,
    body: IkoRepositoryConfigUpdateRequest
  ): Observable<IkoRepositoryConfigResponse> {
    return this.httpClient.put<IkoRepositoryConfigResponse>(this.getApiUrl(`/v1/iko/${key}`), body);
  }

  public deleteIkoRepositoryConfig(key: string): Observable<void> {
    return this.httpClient.delete<void>(this.getApiUrl(`/v1/iko/${key}`));
  }

  public getIkoRepositoryConfigPropertyFields(type: string): Observable<PropertyField[]> {
    return this.httpClient.get<PropertyField[]>(
      this.getApiUrl(`/management/v1/iko-property-fields/${type}/repository-config`)
    );
  }

  public getIkoRepositoryTypes(): Observable<{[key: string]: string}> {
    return this.httpClient.get<{[key: string]: string}>(this.getApiUrl(`/management/v1/iko-types`));
  }

  public getIkoTabs(aggregateKey: string): Observable<TabDto[]> {
    return this.httpClient.get<TabDto[]>(
      this.getApiUrl(`/v1/iko-data-aggregate/${aggregateKey}/tab`)
    );
  }

  public getIkoTab(aggregateKey: string, tabKey: string): Observable<TabDto> {
    return this.httpClient.get<TabDto>(
      this.getApiUrl(`/v1/iko-data-aggregate/${aggregateKey}/tab/${tabKey}`)
    );
  }

  public createIkoTab(
    aggregateKey: string,
    tabKey: string,
    body: IkoTabCreateRequest
  ): Observable<TabDto> {
    return this.httpClient.post<TabDto>(
      this.getApiUrl(`/v1/iko-data-aggregate/${aggregateKey}/tab/${tabKey}`),
      body
    );
  }

  public updateIkoTabs(aggregateKey: string, body: IkoTabUpdateRequest[]): Observable<TabDto[]> {
    return this.httpClient.put<TabDto[]>(
      this.getApiUrl(`/v1/iko-data-aggregate/${aggregateKey}/tab`),
      body
    );
  }

  public deleteIkoTab(aggregateKey: string, tabKey: string): Observable<void> {
    return this.httpClient.delete<void>(
      this.getApiUrl(`/v1/iko-data-aggregate/${aggregateKey}/tab/${tabKey}`)
    );
  }

  public getIkoWidgets(aggregateKey: string, tabKey: string): Observable<WidgetDto[]> {
    return this.httpClient.get<WidgetDto[]>(
      this.getApiUrl(`/v1/iko-data-aggregate/${aggregateKey}/tab/${tabKey}/widget`)
    );
  }

  public getIkoWidget(
    aggregateKey: string,
    tabKey: string,
    widgetKey: string
  ): Observable<WidgetDto> {
    return this.httpClient.get<WidgetDto>(
      this.getApiUrl(`/v1/iko-data-aggregate/${aggregateKey}/tab/${tabKey}/widget/${widgetKey}`)
    );
  }

  public createIkoWidget(
    aggregateKey: string,
    tabKey: string,
    widgetKey: string,
    body: WidgetDto
  ): Observable<WidgetDto> {
    return this.httpClient.post<WidgetDto>(
      this.getApiUrl(`/v1/iko-data-aggregate/${aggregateKey}/tab/${tabKey}/widget/${widgetKey}`),
      body
    );
  }

  public updateIkoWidgets(
    aggregateKey: string,
    tabKey: string,
    body: WidgetDto[]
  ): Observable<WidgetDto[]> {
    return this.httpClient.put<WidgetDto[]>(
      this.getApiUrl(`/v1/iko-data-aggregate/${aggregateKey}/tab/${tabKey}/widget`),
      body
    );
  }

  public deleteIkoWidget(
    aggregateKey: string,
    tabKey: string,
    widgetKey: string
  ): Observable<void> {
    return this.httpClient.delete<void>(
      this.getApiUrl(`/v1/iko-data-aggregate/${aggregateKey}/tab/${tabKey}/widget/${widgetKey}`)
    );
  }

  public getIkoSearchFields(
    aggregateKey: string,
    requestKey: string
  ): Observable<IkoSearchFieldResponse[]> {
    return this.httpClient.get<IkoSearchFieldResponse[]>(
      this.getApiUrl(
        `/v1/iko-data-aggregate/${aggregateKey}/data-request/${requestKey}/search-field`
      )
    );
  }

  public getIkoSearchField(
    aggregateKey: string,
    requestKey: string,
    key: string
  ): Observable<IkoSearchFieldResponse> {
    return this.httpClient.get<IkoSearchFieldResponse>(
      this.getApiUrl(
        `/v1/iko-data-aggregate/${aggregateKey}/data-request/${requestKey}/search-field/${key}`
      )
    );
  }

  public createIkoSearchField(
    aggregateKey: string,
    requestKey: string,
    key: string,
    body: IkoSearchFieldCreateRequest
  ): Observable<IkoSearchFieldResponse> {
    return this.httpClient.post<IkoSearchFieldResponse>(
      this.getApiUrl(
        `/v1/iko-data-aggregate/${aggregateKey}/data-request/${requestKey}/search-field/${key}`
      ),
      body
    );
  }

  public updateIkoSearchFields(
    aggregateKey: string,
    requestKey: string,
    body: IkoSearchFieldUpdateRequest[]
  ): Observable<IkoSearchFieldResponse[]> {
    return this.httpClient.put<IkoSearchFieldResponse[]>(
      this.getApiUrl(
        `/v1/iko-data-aggregate/${aggregateKey}/data-request/${requestKey}/search-field`
      ),
      body
    );
  }

  public deleteIkoSearchField(
    aggregateKey: string,
    requestKey: string,
    key: string
  ): Observable<void> {
    return this.httpClient.delete<void>(
      this.getApiUrl(
        `/v1/iko-data-aggregate/${aggregateKey}/data-request/${requestKey}/search-field/${key}`
      )
    );
  }
}
