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
import {IQuickSearchService, QuickSearchItem} from '@valtimo/components';
import {BaseApiService, ConfigService} from '@valtimo/shared';
import {BehaviorSubject, Observable, filter, of, switchMap, take, tap} from 'rxjs';
import {CaseListQuickSearchParams} from '../models';

@Injectable()
export class CaseListQuickSearchService
  extends BaseApiService
  implements IQuickSearchService<CaseListQuickSearchParams>
{
  private readonly _params$ = new BehaviorSubject<CaseListQuickSearchParams | null>(null);
  private get _params(): CaseListQuickSearchParams {
    return this._params$.getValue() ?? {};
  }
  public get params$(): Observable<CaseListQuickSearchParams | null> {
    return this._params$.pipe(filter(params => !!params));
  }

  constructor(
    protected readonly httpClient: HttpClient,
    protected readonly configService: ConfigService
  ) {
    super(httpClient, configService);
  }

  public initParams(params: CaseListQuickSearchParams): void {
    const current = this._params;
    if (
      params.caseDefinitionKey === current.caseDefinitionKey &&
      params.groupKey === current.groupKey
    ) {
      return;
    }
    this._params$.next(params);
  }

  private getStoredQuickSearchUrl(params: CaseListQuickSearchParams | null): string {
    if (params?.groupKey) {
      return this.getApiUrl(`v1/case-definition-group/${params.groupKey}/stored-quick-search`);
    }
    return this.getApiUrl(`v1/case/${params?.caseDefinitionKey}/stored-quick-search`);
  }

  public getQuickSearchItems(): Observable<QuickSearchItem[]> {
    return this.params$.pipe(
      take(1),
      switchMap((params: CaseListQuickSearchParams | null) =>
        this.httpClient.get<QuickSearchItem[]>(this.getStoredQuickSearchUrl(params))
      )
    );
  }

  public createQuickSearchItem(quickSearchItem: QuickSearchItem): Observable<QuickSearchItem> {
    return this.params$.pipe(
      take(1),
      switchMap((params: CaseListQuickSearchParams | null) =>
        this.httpClient.post<QuickSearchItem>(
          this.getStoredQuickSearchUrl(params),
          quickSearchItem
        )
      )
    );
  }

  public updateQuickSearchItems(
    quickSearchItems: QuickSearchItem[]
  ): Observable<QuickSearchItem[]> {
    throw new Error('Method not implemented.');
  }

  public editQuickSearchItem(quickSearchItem: QuickSearchItem): Observable<QuickSearchItem> {
    return this.params$.pipe(
      take(1),
      switchMap((params: CaseListQuickSearchParams | null) =>
        this.httpClient.put<QuickSearchItem>(this.getStoredQuickSearchUrl(params), quickSearchItem)
      )
    );
  }

  public deleteQuickSearchItem(quickSearchItem: QuickSearchItem): Observable<void> {
    return this.params$.pipe(
      take(1),
      switchMap((params: CaseListQuickSearchParams | null) =>
        this.httpClient.delete<void>(
          `${this.getStoredQuickSearchUrl(params)}/${quickSearchItem.title}`
        )
      )
    );
  }
}
