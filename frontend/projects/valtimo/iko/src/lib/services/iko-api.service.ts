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
import {BaseApiService, ConfigService, GlobalNotificationService} from '@valtimo/shared';
import {BehaviorSubject, Observable} from 'rxjs';
import {IkoView, IkoSearchActionUser, IkoListResponse, IkoTab} from '../models';
import {WidgetAction} from '@valtimo/layout';

@Injectable({
  providedIn: 'root',
})
export class IkoApiService extends BaseApiService {
  private readonly _cachedMenuItems$ = new BehaviorSubject<IkoView[]>([]);

  public get cachedMenuItems$(): Observable<IkoView[]> {
    return this._cachedMenuItems$.asObservable();
  }

  public setCachedMenuItems(items: IkoView[]): void {
    this._cachedMenuItems$.next(items);
  }

  constructor(
    protected readonly httpClient: HttpClient,
    protected readonly configService: ConfigService,
    protected readonly globalNotificationService: GlobalNotificationService
  ) {
    super(httpClient, configService);
  }

  public getIkoViews(
    key?: string,
    title?: string,
    page: number = 0,
    size: number = 10000,
    sort: string = 'title,asc'
  ): Observable<{content: IkoView[]}> {
    const params = new URLSearchParams();
    if (key) params.append('key', key);
    if (title) params.append('title', title);
    params.append('page', page.toString());
    params.append('size', size.toString());
    params.append('sort', sort);

    return this.httpClient.get<{
      content: IkoView[];
    }>(this.getApiUrl(`/v1/iko-view?${params.toString()}`));
  }

  public getIkoDetailTabs(ikoViewKey: string): Observable<IkoTab[]> {
    return this.httpClient.get<IkoTab[]>(this.getApiUrl(`/v1/iko-view/${ikoViewKey}/tab`));
  }

  public getIkoSearchActions(ikoViewKey: string): Observable<IkoSearchActionUser[]> {
    return this.httpClient.get<IkoSearchActionUser[]>(
      this.getApiUrl(`/v1/iko-view/${ikoViewKey}/search-action`)
    );
  }

  public getIkoWidget(ikoViewKey: string, tabKey: string): any {
    return this.httpClient.get(this.getApiUrl(`/v1/iko-view/${ikoViewKey}/tab/${tabKey}/widget`));
  }

  public getIkoWidgetData(
    ikoViewKey: string,
    tabKey: string,
    widgetId: string,
    id: string,
    queryParams?: HttpParams
  ): any {
    return this.httpClient.get(
      this.getApiUrl(
        `/v1/iko-view/${ikoViewKey}/tab/${tabKey}/widget/${widgetId}/data?id=${id}${!queryParams ? '' : '&' + queryParams.toString()}`
      )
    );
  }

  public searchIkoSearchAction(
    ikoKey: string,
    paramKey: string,
    filters: {filters: {[key: string]: string}}
  ): Observable<IkoListResponse> {
    return this.httpClient.post<IkoListResponse>(
      this.getApiUrl(`/v1/iko-view/${ikoKey}/search-action/${paramKey}/search`),
      filters
    );
  }

  public getDropdownData(
    provider: string,
    ikoViewKey: string,
    ikoSearchActionKey: string,
    searchFieldKey: string
  ): Observable<object> {
    const dropdownListKey = encodeURI(ikoViewKey + '_' + ikoSearchActionKey + '_' + searchFieldKey);
    return this.httpClient.get<object>(
      this.getApiUrl(`/v1/data/dropdown-list?provider=${provider}&key=${dropdownListKey}`)
    );
  }

  public handleAction(action: WidgetAction, resolved: {[key: string]: string} = null) {
    if (!action) return;

    const navigateTo = this.resolveProperty(action?.navigateTo, resolved);
    if (navigateTo) {
      this.navigateTo(navigateTo);
      return;
    }

    const caseDefinitionKey = this.resolveProperty(action?.caseDefinitionKey, resolved);

    if (caseDefinitionKey) this.startCase(caseDefinitionKey);

    const processDefinitionKey = this.resolveProperty(action?.processDefinitionKey, resolved);

    if (processDefinitionKey) {
      this.globalNotificationService.showToast({
        title: 'An unexpected error occurred',
        caption: `Unsupported action: Start process ${processDefinitionKey}`,
        type: 'error',
      });
    }
  }

  private navigateTo(navigateTo: string) {
    if (navigateTo.startsWith(window.location.origin) || navigateTo.startsWith('/')) {
      window.open(navigateTo, '_self');
    } else if (navigateTo.startsWith('http')) {
      window.open(navigateTo, '_blank');
    } else {
      this.globalNotificationService.showToast({
        title: 'An unexpected error occurred',
        caption: `Unable to navigate to ${navigateTo}`,
        type: 'error',
      });
    }
  }

  private startCase(caseDefinitionKey: string) {
    this.globalNotificationService.showToast({
      title: 'Test',
      caption: `Start case ${caseDefinitionKey}`,
      type: 'info',
    });
  }

  private resolveProperty(property: string, resolved: {[key: string]: any}): string {
    return property ? (resolved ? String(resolved[property]) : property) : null;
  }
}
