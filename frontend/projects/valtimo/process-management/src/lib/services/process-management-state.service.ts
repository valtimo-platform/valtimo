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
import {Observable, Subject} from 'rxjs';

@Injectable()
export class ProcessManagementStateService {
  private readonly _openModal$ = new Subject<boolean>();
  private readonly _reloadDefinitions$ = new Subject<null>();

  public get openModal$(): Observable<boolean> {
    return this._openModal$.asObservable();
  }

  public get reloadDefinitions$(): Observable<null> {
    return this._reloadDefinitions$.asObservable();
  }

  public openModal(): void {
    this._openModal$.next(true);
  }

  public closeModal(): void {
    this._openModal$.next(false);
  }

  public reloadDefinitions(): void {
    this._reloadDefinitions$.next(null);
  }
}
