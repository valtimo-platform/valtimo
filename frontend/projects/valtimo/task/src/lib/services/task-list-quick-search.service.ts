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
import {BehaviorSubject, Observable, filter, switchMap, take} from 'rxjs';
import {TaskListQuickSearchParams} from '../models';

@Injectable()
export class TaskListQuickSearchService
  extends BaseApiService
  implements IQuickSearchService<TaskListQuickSearchParams>
{
  private readonly _params$ = new BehaviorSubject<TaskListQuickSearchParams | null>(null);
  private get _params(): TaskListQuickSearchParams {
    return this._params$.getValue() ?? {caseDefinitionKey: ''};
  }
  public get params$(): Observable<TaskListQuickSearchParams | null> {
    return this._params$.pipe(filter(params => !!params));
  }

  constructor(
    protected readonly httpClient: HttpClient,
    protected readonly configService: ConfigService
  ) {
    super(httpClient, configService);
  }

  public initParams(caseDefinitionKey: string): void {
    if (caseDefinitionKey === this._params.caseDefinitionKey) return;
    this._params$.next({caseDefinitionKey});
  }

  public getQuickSearchItems(): Observable<QuickSearchItem[]> {
    return this.params$.pipe(
      take(1),
      switchMap((params: TaskListQuickSearchParams | null) =>
        this.httpClient.get<QuickSearchItem[]>(
          this.getApiUrl(`v1/task/${params?.caseDefinitionKey}/stored-quick-search`)
        )
      )
    );
  }

  public createQuickSearchItem(quickSearchItem: QuickSearchItem): Observable<QuickSearchItem> {
    return this.params$.pipe(
      take(1),
      switchMap((params: TaskListQuickSearchParams | null) =>
        this.httpClient.post<QuickSearchItem>(
          this.getApiUrl(`v1/task/${params?.caseDefinitionKey}/stored-quick-search`),
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
      switchMap((params: TaskListQuickSearchParams | null) =>
        this.httpClient.put<QuickSearchItem>(
          this.getApiUrl(`v1/task/${params?.caseDefinitionKey}/stored-quick-search`),
          quickSearchItem
        )
      )
    );
  }

  public deleteQuickSearchItem(quickSearchItem: QuickSearchItem): Observable<void> {
    return this.params$.pipe(
      take(1),
      switchMap((params: TaskListQuickSearchParams | null) =>
        this.httpClient.delete<void>(
          this.getApiUrl(
            `v1/task/${params?.caseDefinitionKey}/stored-quick-search/${quickSearchItem.title}`
          )
        )
      )
    );
  }
}
