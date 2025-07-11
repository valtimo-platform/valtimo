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
import {BehaviorSubject, filter, Observable} from 'rxjs';
import {IkoTab} from '../models';
import {map} from 'rxjs/operators';
import {NGXLogger} from 'ngx-logger';

@Injectable({providedIn: 'root'})
export class IkoTabService {
  private readonly _activeTab$ = new BehaviorSubject<IkoTab | null>(null);
  private readonly _dataAggregateKey$ = new BehaviorSubject<string | null>(null);

  public get activeTab$(): Observable<IkoTab> {
    return this._activeTab$.pipe(filter(tab => !!tab));
  }

  public get activeTabKey$(): Observable<string> {
    return this.activeTab$.pipe(map(tab => tab.key));
  }

  public get dataAggregateKey$(): Observable<string> {
    return this._dataAggregateKey$.pipe(filter(key => !!key));
  }

  constructor(private readonly logger: NGXLogger) {}

  public setActiveTab(tab: IkoTab): void {
    this._activeTab$.next(tab);
    this.logger.debug(`Active IKO tab set to ${JSON.stringify(tab)}`);
  }

  public setDataAggregateKey(key: string): void {
    this._dataAggregateKey$.next(key);
    this.logger.debug(`Active IKO data aggregate key set to ${key}`);
  }
}
