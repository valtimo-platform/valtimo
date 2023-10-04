/*
 * Copyright 2015-2023 Ritense BV, the Netherlands.
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
import {ConfigService} from '@valtimo/config';
import {BehaviorSubject, Observable, tap, take} from 'rxjs';
import {ApiTabItem} from '@valtimo/dossier';

@Injectable()
export class TabManagementService {
  private _valtimoEndpointUri: string;

  public readonly tabs$ = new BehaviorSubject<ApiTabItem[]>([]);
  public readonly loading$ = new BehaviorSubject<boolean>(false);

  constructor(
    private readonly configService: ConfigService,
    private readonly http: HttpClient
  ) {
    this._valtimoEndpointUri = `${this.configService.config.valtimoApi.endpointUri}management/v1/case-definition`;
  }

  public loadTabs(caseDefinitionId: string): void {
    this.loading$.next(true);
    this.getTabList(caseDefinitionId)
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

  private getTabList(caseDefinitionId: string): Observable<ApiTabItem[]> {
    return this.http.get<ApiTabItem[]>(`${this._valtimoEndpointUri}/${caseDefinitionId}/tab`);
  }
}
