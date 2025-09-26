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
import {BehaviorSubject, distinctUntilChanged, Observable} from 'rxjs';
import {ZgwTabEnum} from '../models';

@Injectable({
  providedIn: 'root',
})
export class DossierManagementZgwService {
  public configuredTabKeys: string[];

  private readonly _DEFAULT_TAB: ZgwTabEnum = ZgwTabEnum.DOCUMENTEN_API_COLUMNS;

  private _currentTab$ = new BehaviorSubject<ZgwTabEnum>(this._DEFAULT_TAB);
  public get currentTab$(): Observable<ZgwTabEnum> {
    return this._currentTab$.pipe(distinctUntilChanged());
  }
  public set currentTab(tab: ZgwTabEnum) {
    this._currentTab$.next(tab);
  }

  public resetToDefaultTab(): void {
    this._currentTab$.next(this._DEFAULT_TAB);
  }
}
