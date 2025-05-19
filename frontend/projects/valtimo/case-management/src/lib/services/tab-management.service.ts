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

import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {ConfigService} from '@valtimo/shared';
import {ApiTabItem} from '@valtimo/case';
import {BehaviorSubject, Observable, of} from 'rxjs';
import {catchError, switchMap, take, tap} from 'rxjs/operators';
import {CaseManagementParams} from '../models';

@Injectable()
export class TabManagementService {
  private _valtimoEndpointBase: string;
  private _params!: CaseManagementParams;

  public readonly tabs$ = new BehaviorSubject<ApiTabItem[]>([]);
  public readonly loading$ = new BehaviorSubject<boolean>(false);

  constructor(
    private readonly configService: ConfigService,
    private readonly http: HttpClient
  ) {
    this._valtimoEndpointBase = `${this.configService.config.valtimoApi.endpointUri}management/v1/case-definition`;
  }

  public setParams(params: CaseManagementParams): void {
    this._params = params;
  }

  private get _caseDefinitionUrl(): string {
    return `${this._valtimoEndpointBase}/${this._params.caseDefinitionKey}/version/${this._params.caseDefinitionVersionTag}`;
  }

  public loadTabs(): void {
    this.loading$.next(true);
    this.getTabList()
      .pipe(take(1))
      .subscribe({
        next: (items: ApiTabItem[]) => {
          this.tabs$.next(items);
          this.loading$.next(false);
        },
        error: error => {
          console.error(error);
        },
      });
  }

  public dispatchAction(actionResult: Observable<ApiTabItem | ApiTabItem[] | null>): void {
    actionResult
      .pipe(
        tap(() => {
          this.loading$.next(true);
          this.tabs$.next([]);
        }),
        switchMap((result: ApiTabItem | ApiTabItem[] | null) =>
          Array.isArray(result) ? of(result) : this.getTabList()
        ),
        take(1),
        catchError(error => of(error))
      )
      .subscribe({
        next: (tabs: ApiTabItem[]) => {
          this.loading$.next(false);
          this.tabs$.next(tabs);
        },
        error: error => {
          console.log(error);
        },
      });
  }

  public addTab(tab: Partial<ApiTabItem>): Observable<ApiTabItem> {
    return this.http.post<ApiTabItem>(`${this._caseDefinitionUrl}/tab`, this.getTabDto(tab));
  }

  public deleteTab(tabKey: string): Observable<null> {
    return this.http.delete<null>(`${this._caseDefinitionUrl}/tab/${tabKey}`);
  }

  public editTab(tab: Partial<ApiTabItem>, tabKey: string): Observable<ApiTabItem> {
    return this.http.put<ApiTabItem>(
      `${this._caseDefinitionUrl}/tab/${tabKey}`,
      this.getTabDto(tab)
    );
  }

  public editTabsOrder(tabList: ApiTabItem[]): Observable<ApiTabItem[]> {
    return this.http.put<ApiTabItem[]>(`${this._caseDefinitionUrl}/tab`, tabList);
  }

  public getTab(tabKey: string): Observable<ApiTabItem> {
    return this.http.get<ApiTabItem>(`${this._caseDefinitionUrl}/tab/${tabKey}`);
  }

  private getTabList(): Observable<ApiTabItem[]> {
    return this.http.get<ApiTabItem[]>(`${this._caseDefinitionUrl}/tab`);
  }

  private getTabDto(tab: Partial<ApiTabItem>): Partial<ApiTabItem> {
    if (tab.name === '') {
      delete tab.name;
    }
    return tab;
  }
}
