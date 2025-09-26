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
import {BehaviorSubject, Observable, Subject} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ObjectStateService {
  private readonly _showModal$ = new Subject();
  private readonly _hideModal$ = new Subject();
  private readonly _refresh$ = new BehaviorSubject<null>(null);
  private readonly _modalType$ = new BehaviorSubject<any>('add');

  constructor() {}

  get showModal$(): Observable<any> {
    return this._showModal$.asObservable();
  }

  get hideModal$(): Observable<any> {
    return this._hideModal$.asObservable();
  }

  get refresh$(): Observable<any> {
    return this._refresh$.asObservable();
  }

  get modalType$(): Observable<any> {
    return this._modalType$.asObservable();
  }

  showModal(): void {
    this._showModal$.next(null);
  }

  hideModal(): void {
    this._hideModal$.next(null);
  }

  refresh(): void {
    this._refresh$.next(null);
  }

  setModalType(type: any): void {
    this._modalType$.next(type);
  }
}
