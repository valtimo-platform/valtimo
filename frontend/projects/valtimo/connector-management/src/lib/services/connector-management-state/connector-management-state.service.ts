/*
 * Copyright 2020 Dimpact.
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
import {ConnectorInstance} from '@valtimo/config';

@Injectable({
  providedIn: 'root',
})
export class ConnectorManagementStateService {
  private readonly _showModal$ = new BehaviorSubject<boolean>(false);
  private readonly _showExtensionModal$ = new BehaviorSubject<boolean>(false);
  private readonly _inputDisabled$ = new BehaviorSubject<boolean>(false);
  private readonly _refresh$ = new BehaviorSubject<'refresh'>('refresh');
  private readonly _selectedInstance$ = new BehaviorSubject<ConnectorInstance>(undefined);
  private readonly _lastConfigIdAdded$ = new BehaviorSubject<string>('');

  get showModal$(): Observable<boolean> {
    return this._showModal$.asObservable();
  }

  get showExtensionModal$(): Observable<boolean> {
    return this._showExtensionModal$.asObservable();
  }

  get inputDisabled$(): Observable<boolean> {
    return this._inputDisabled$.asObservable();
  }

  get refresh$(): Observable<any> {
    return this._refresh$.asObservable();
  }

  get selectedInstance$(): Observable<ConnectorInstance> {
    return this._selectedInstance$.asObservable();
  }

  get lastConfigIdAdded$(): Observable<string> {
    return this._lastConfigIdAdded$.asObservable();
  }

  showModal(): void {
    this._showModal$.next(true);
  }

  hideModal(): void {
    this._showModal$.next(false);
  }

  showExtensionModal(): void {
    this._showExtensionModal$.next(true);
  }

  hideExtensionModal(): void {
    this._showExtensionModal$.next(false);
  }

  disableInput(): void {
    this._inputDisabled$.next(true);
  }

  enableInput(): void {
    this._inputDisabled$.next(false);
  }

  refresh(): void {
    this._refresh$.next('refresh');
  }

  setConnectorInstance(instance: ConnectorInstance): void {
    this._selectedInstance$.next(instance);
  }

  setLastConfigIdAdded(id: string): void {
    this._lastConfigIdAdded$.next(id);
  }

  clearLastConfigIdAdded(): void {
    this._lastConfigIdAdded$.next('');
  }
}
