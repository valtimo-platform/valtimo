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
import {CaseManagementParams, ConfigService} from '@valtimo/shared';
import {BehaviorSubject, Observable, of} from 'rxjs';
import {catchError, switchMap, take, tap} from 'rxjs/operators';
import {
  ManagementStartableItem,
  StartableItemOrderEntry,
  UpdateStartableItemOrderRequest,
} from '../models';

@Injectable()
export class StartableItemManagementService {
  private _valtimoEndpointBase: string;
  private _params!: CaseManagementParams;

  public readonly items$ = new BehaviorSubject<ManagementStartableItem[]>([]);
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

  public loadItems(): void {
    this.loading$.next(true);
    this.getItemList()
      .pipe(take(1))
      .subscribe({
        next: (items: ManagementStartableItem[]) => {
          this.items$.next(items);
          this.loading$.next(false);
        },
        error: error => {
          console.error(error);
          this.loading$.next(false);
        },
      });
  }

  public dispatchAction(
    actionResult: Observable<ManagementStartableItem | ManagementStartableItem[] | null>
  ): void {
    actionResult
      .pipe(
        tap(() => {
          this.loading$.next(true);
          this.items$.next([]);
        }),
        switchMap((result: ManagementStartableItem | ManagementStartableItem[] | null) =>
          Array.isArray(result) ? of(result) : this.getItemList()
        ),
        take(1),
        catchError(error => of(error))
      )
      .subscribe({
        next: (items: ManagementStartableItem[]) => {
          this.loading$.next(false);
          this.items$.next(items);
        },
        error: error => {
          console.error(error);
        },
      });
  }

  public updateOrder(
    items: ManagementStartableItem[]
  ): Observable<ManagementStartableItem[]> {
    const request: UpdateStartableItemOrderRequest = {
      items: items.map(
        (item, index): StartableItemOrderEntry => ({
          key: item.key,
          type: item.type,
          sortOrder: index,
        })
      ),
    };
    return this.http.put<ManagementStartableItem[]>(
      `${this._caseDefinitionUrl}/startable-item/order`,
      request
    );
  }

  private getItemList(): Observable<ManagementStartableItem[]> {
    return this.http.get<ManagementStartableItem[]>(
      `${this._caseDefinitionUrl}/startable-item`
    );
  }
}
