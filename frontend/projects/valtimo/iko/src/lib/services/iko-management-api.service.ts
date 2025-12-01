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
import {HttpClient, HttpParams, HttpResponse} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {BaseApiService, ConfigService, Page, InterceptorSkipHeader} from '@valtimo/shared';
import {Observable} from 'rxjs';
import {
  IkoViewCreateRequest,
  IkoViewListResponse,
  IkoViewResponse,
  IkoViewUpdateRequest,
  IkoSearchActionCreateRequest,
  IkoSearchActionResponse,
  IkoSearchActionUpdateRequest,
  IkoListColumnRequest,
  IkoRepositoryConfigCreateRequest,
  IkoRepositoryConfigListResponse,
  IkoRepositoryConfigResponse,
  IkoRepositoryConfigUpdateRequest,
  IkoSearchField,
  IkoSearchFieldCreateRequest,
  IkoTabCreateRequest,
  ListColumnDto,
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

  public getIkoViews(
    key?: string,
    title?: string,
    page: number = 0,
    size: number = 100,
    sort: string = 'title,asc'
  ): Observable<{content: IkoViewListResponse[]}> {
    let params = new HttpParams().set('page', page).set('size', size).set('sort', sort);
    if (key) params = params.set('key', key);
    if (title) params = params.set('title', title);
    return this.httpClient.get<{content: IkoViewListResponse[]}>(this.getApiUrl('/v1/iko-view'), {
      params,
    });
  }

  public getIkoView(key: string): Observable<IkoViewResponse> {
    return this.httpClient.get<IkoViewResponse>(this.getApiUrl(`/v1/iko-view/${key}`));
  }

  public createIkoView(key: string, body: IkoViewCreateRequest): Observable<IkoViewResponse> {
    return this.httpClient.post<IkoViewResponse>(
      this.getApiUrl(`management/v1/iko-view/${key}`),
      body
    );
  }

  public updateIkoView(key: string, body: IkoViewUpdateRequest): Observable<IkoViewResponse> {
    return this.httpClient.put<IkoViewResponse>(
      this.getApiUrl(`management/v1/iko-view/${key}`),
      body
    );
  }

  public deleteIkoView(key: string): Observable<void> {
    return this.httpClient.delete<void>(this.getApiUrl(`management/v1/iko-view/${key}`));
  }

  public exportIKOConfiguration(key: string): Observable<HttpResponse<Blob>> {
    return this.httpClient.get<Blob>(this.getApiUrl(`management/v1/iko-view/${key}/export`), {
      observe: 'response',
      responseType: 'blob' as 'json',
      headers: InterceptorSkipHeader,
    });
  }

  public importConfigurationZip(file: any): Observable<HttpResponse<Blob>> {
    return this.httpClient.post<HttpResponse<Blob>>(
      this.getApiUrl(`management/v1/iko-view/import`),
      file
    );
  }

  public getIkoRepositoryPropertyFields(type: string): Observable<PropertyField[]> {
    return this.httpClient.get<PropertyField[]>(
      this.getApiUrl(`management/v1/iko-property-fields/${type}/repository-config`)
    );
  }

  public getIkoViewPropertyFields(type: string): Observable<PropertyField[]> {
    return this.httpClient.get<PropertyField[]>(
      this.getApiUrl(`management/v1/iko-property-fields/${type}/iko-view`)
    );
  }

  public getIkoViewType(key: string): Observable<IkoRepositoryConfigResponse> {
    return this.httpClient.get<IkoRepositoryConfigResponse>(
      this.getApiUrl(`/management/v1/iko/${key}`)
    );
  }

  public getManagementIkoViews(
    key?: string,
    title?: string,
    ikoRepositoryConfigKey?: string,
    page: number = 0,
    size: number = 100,
    sort: string = 'title,asc'
  ): Observable<Page<IkoViewResponse>> {
    let params = new HttpParams().set('page', page).set('size', size).set('sort', sort);
    if (key) params = params.set('key', key);
    if (title) params = params.set('title', title);
    if (ikoRepositoryConfigKey)
      params = params.set('ikoRepositoryConfigKey', ikoRepositoryConfigKey);
    return this.httpClient.get<Page<IkoViewResponse>>(this.getApiUrl(`management/v1/iko-view`), {
      params,
    });
  }

  public getManagementIkoSearchActions(
    aggregateKey: string
  ): Observable<IkoSearchActionResponse[]> {
    return this.httpClient.get<IkoSearchActionResponse[]>(
      this.getApiUrl(`management/v1/iko-view/${aggregateKey}/iko-search-action`)
    );
  }

  public getIkoSearchAction(
    aggregateKey: string,
    key: string
  ): Observable<IkoSearchActionResponse> {
    return this.httpClient.get<IkoSearchActionResponse>(
      this.getApiUrl(`management/v1/iko-view/${aggregateKey}/search-action/${key}`)
    );
  }

  public createIkoSearchAction(
    aggregateKey: string,
    key: string,
    body: IkoSearchActionCreateRequest
  ): Observable<IkoSearchActionResponse> {
    return this.httpClient.post<IkoSearchActionResponse>(
      this.getApiUrl(`management/v1/iko-view/${aggregateKey}/search-action/${key}`),
      body
    );
  }

  public updateIkoSearchActions(
    aggregateKey: string,
    body: IkoSearchActionUpdateRequest[]
  ): Observable<IkoSearchActionResponse[]> {
    return this.httpClient.put<IkoSearchActionResponse[]>(
      this.getApiUrl(`management/v1/iko-view/${aggregateKey}/iko-search-action`),
      body
    );
  }

  public updateIkoSearchAction(
    aggregateKey: string,
    actionKey: string,
    body: IkoSearchActionUpdateRequest
  ): Observable<IkoSearchActionResponse> {
    return this.httpClient.put<IkoSearchActionResponse>(
      this.getApiUrl(`management/v1/iko-view/${aggregateKey}/search-action/${actionKey}`),
      body
    );
  }

  public deleteIkoSearchAction(aggregateKey: string, key: string): Observable<void> {
    return this.httpClient.delete<void>(
      this.getApiUrl(`management/v1/iko-view/${aggregateKey}/search-action/${key}`)
    );
  }

  public getIkoSearchActionPropertyFields(type: string): Observable<PropertyField[]> {
    return this.httpClient.get<PropertyField[]>(
      this.getApiUrl(`management/v1/iko-property-fields/${type}/iko-search-action`)
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
    return this.httpClient.put<IkoRepositoryConfigResponse>(
      this.getApiUrl(`/management/v1/iko/${key}`),
      body
    );
  }

  public deleteIkoRepositoryConfig(key: string): Observable<void> {
    return this.httpClient.delete<void>(this.getApiUrl(`/management/v1/iko/${key}`));
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
    return this.httpClient.get<TabDto[]>(this.getApiUrl(`/v1/iko-view/${aggregateKey}/tab`));
  }

  public getIkoTab(aggregateKey: string, tabKey: string): Observable<TabDto> {
    return this.httpClient.get<TabDto>(
      this.getApiUrl(`/management/v1/iko-view/${aggregateKey}/tab/${tabKey}`)
    );
  }

  public createIkoTab(
    aggregateKey: string,
    tabKey: string,
    body: IkoTabCreateRequest
  ): Observable<TabDto> {
    return this.httpClient.post<TabDto>(
      this.getApiUrl(`/management/v1/iko-view/${aggregateKey}/tab/${tabKey}`),
      body
    );
  }

  public updateIkoTabs(aggregateKey: string, body: TabDto[]): Observable<TabDto[]> {
    return this.httpClient.put<TabDto[]>(
      this.getApiUrl(`/management/v1/iko-view/${aggregateKey}/tab`),
      body
    );
  }

  public updateIkoTab(aggregateKey: string, tabKey: string, body: TabDto): Observable<TabDto> {
    return this.httpClient.put<TabDto>(
      this.getApiUrl(`/management/v1/iko-view/${aggregateKey}/tab/${tabKey}`),
      body
    );
  }

  public deleteIkoTab(aggregateKey: string, tabKey: string): Observable<void> {
    return this.httpClient.delete<void>(
      this.getApiUrl(`/management/v1/iko-view/${aggregateKey}/tab/${tabKey}`)
    );
  }

  public getIkoWidget(
    aggregateKey: string,
    tabKey: string,
    widgetKey: string
  ): Observable<WidgetDto> {
    return this.httpClient.get<WidgetDto>(
      this.getApiUrl(`/v1/iko-view/${aggregateKey}/tab/${tabKey}/widget/${widgetKey}`)
    );
  }

  public getIkoSearchFields(
    aggregateKey: string,
    requestKey: string
  ): Observable<IkoSearchField[]> {
    return this.httpClient.get<IkoSearchField[]>(
      this.getApiUrl(
        `management/v1/iko-view/${aggregateKey}/search-action/${requestKey}/search-field`
      )
    );
  }

  public getIkoSearchField(
    aggregateKey: string,
    requestKey: string,
    key: string
  ): Observable<IkoSearchField> {
    return this.httpClient.get<IkoSearchField>(
      this.getApiUrl(`/v1/iko-view/${aggregateKey}/search-action/${requestKey}/search-field/${key}`)
    );
  }

  public createIkoSearchField(
    aggregateKey: string,
    requestKey: string,
    key: string,
    body: IkoSearchFieldCreateRequest
  ): Observable<IkoSearchField> {
    return this.httpClient.post<IkoSearchField>(
      this.getApiUrl(
        `management/v1/iko-view/${aggregateKey}/search-action/${requestKey}/search-field/${key}`
      ),
      body
    );
  }

  public updateIkoSearchFields(
    aggregateKey: string,
    requestKey: string,
    body: IkoSearchField[]
  ): Observable<IkoSearchField[]> {
    return this.httpClient.put<IkoSearchField[]>(
      this.getApiUrl(
        `management/v1/iko-view/${aggregateKey}/search-action/${requestKey}/search-field`
      ),
      body
    );
  }

  public updateIkoSearchField(
    aggregateKey: string,
    requestKey: string,
    fieldKey: string,
    body: IkoSearchField
  ): Observable<IkoSearchField[]> {
    return this.httpClient.put<IkoSearchField[]>(
      this.getApiUrl(
        `management/v1/iko-view/${aggregateKey}/search-action/${requestKey}/search-field/${fieldKey}`
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
        `management/v1/iko-view/${aggregateKey}/search-action/${requestKey}/search-field/${key}`
      )
    );
  }

  public getIkoListColumns(aggregateKey: string): Observable<ListColumnDto[]> {
    return this.httpClient.get<ListColumnDto[]>(
      this.getApiUrl(`/management/v1/iko-view/${aggregateKey}/column`)
    );
  }

  public getIkoListColumn(aggregateKey: string, columnKey: string): Observable<ListColumnDto> {
    return this.httpClient.get<ListColumnDto>(
      this.getApiUrl(`/management/v1/iko-view/${aggregateKey}/column/${columnKey}`)
    );
  }

  public createIkoListColumn(
    aggregateKey: string,
    columnKey: string,
    body: IkoListColumnRequest
  ): Observable<ListColumnDto> {
    return this.httpClient.post<ListColumnDto>(
      this.getApiUrl(`/management/v1/iko-view/${aggregateKey}/column/${columnKey}`),
      body
    );
  }

  public updateListColumn(
    aggregateKey: string,
    columnKey: string,
    body: IkoListColumnRequest
  ): Observable<ListColumnDto> {
    return this.httpClient.put<ListColumnDto>(
      this.getApiUrl(`/management/v1/iko-view/${aggregateKey}/column/${columnKey}`),
      body
    );
  }

  public updateIkoListColumnOrder(
    aggregateKey: string,
    body: IkoListColumnRequest[]
  ): Observable<ListColumnDto[]> {
    return this.httpClient.put<ListColumnDto[]>(
      this.getApiUrl(`/management/v1/iko-view/${aggregateKey}/column`),
      body
    );
  }

  public deleteIkoListColumn(aggregateKey: string, columnKey: string): Observable<void> {
    return this.httpClient.delete<void>(
      this.getApiUrl(`/management/v1/iko-view/${aggregateKey}/column/${columnKey}`)
    );
  }
}
