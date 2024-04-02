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
export class FormManagementStateService {
  private readonly _showModal$ = new Subject<null>();
  private readonly _hideModal$ = new Subject<null>();
  private readonly _refresh$ = new BehaviorSubject<null>(null);
  private readonly _modalType$ = new BehaviorSubject<any>('add');

  public get showModal$(): Observable<null> {
    return this._showModal$.asObservable();
  }

  public get hideModal$(): Observable<null> {
    return this._hideModal$.asObservable();
  }

  public get refresh$(): Observable<null> {
    return this._refresh$.asObservable();
  }

  public get modalType$(): Observable<any> {
    return this._modalType$.asObservable();
  }

  public showModal(): void {
    this._showModal$.next(null);
  }

  public hideModal(): void {
    this._hideModal$.next(null);
  }

  public refresh(): void {
    this._refresh$.next(null);
  }

  public setModalType(type: any): void {
    this._modalType$.next(type);
  }
}
