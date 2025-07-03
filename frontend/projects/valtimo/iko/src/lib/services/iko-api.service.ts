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
import {HttpClient} from '@angular/common/http';
import {BaseApiService, ConfigService} from '@valtimo/shared';
import {BehaviorSubject, Observable} from 'rxjs';
import {IkoDataAggregate, IkoDataRequestUser, IkoListResponse} from '../models';

@Injectable({
  providedIn: 'root',
})
export class IkoApiService extends BaseApiService {
  private readonly _cachedMenuItems$ = new BehaviorSubject<IkoDataAggregate[]>([]);

  public get cachedMenuItems$(): Observable<IkoDataAggregate[]> {
    return this._cachedMenuItems$.asObservable();
  }

  public setCachedMenuItems(items: IkoDataAggregate[]): void {
    this._cachedMenuItems$.next(items);
  }

  constructor(
    protected readonly httpClient: HttpClient,
    protected readonly configService: ConfigService
  ) {
    super(httpClient, configService);
  }

  public getIkoDataAggregates(
    key?: string,
    title?: string,
    page: number = 0,
    size: number = 10000,
    sort: string = 'title,asc'
  ): Observable<{content: IkoDataAggregate[]}> {
    const params = new URLSearchParams();
    if (key) params.append('key', key);
    if (title) params.append('title', title);
    params.append('page', page.toString());
    params.append('size', size.toString());
    params.append('sort', sort);

    return this.httpClient.get<{
      content: IkoDataAggregate[];
    }>(this.getApiUrl(`/v1/iko-data-aggregate?${params.toString()}`));
  }

  public getIkoDataRequests(ikoDataAggregateKey: string): Observable<IkoDataRequestUser[]> {
    return this.httpClient.get<IkoDataRequestUser[]>(
      this.getApiUrl(`/v1/iko-data-aggregate/${ikoDataAggregateKey}/data-request`)
    );
  }

  public searchIkoDataRequest(
    ikoKey: string,
    paramKey: string,
    filters: {filters: {[key: string]: string}}
  ): Observable<IkoListResponse> {
    return this.httpClient.post<IkoListResponse>(
      this.getApiUrl(`/v1/iko-data-aggregate/${ikoKey}/data-request/${paramKey}/search`),
      filters
    );
  }
}
