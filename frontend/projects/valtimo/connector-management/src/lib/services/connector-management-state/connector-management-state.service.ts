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
import {take} from 'rxjs/operators';
import {ConnectorInstance, ConnectorModal, ConnectorType} from '@valtimo/config';

@Injectable({
  providedIn: 'root',
})
export class ConnectorManagementStateService {
  private readonly _showModal$ = new Subject();
  private readonly _hideModal$ = new Subject();
  private readonly _showExtensionModal$ = new BehaviorSubject<boolean>(false);
  private readonly _inputDisabled$ = new BehaviorSubject<boolean>(false);
  private readonly _saveButtonDisabled$ = new BehaviorSubject<boolean>(true);
  private readonly _refresh$ = new BehaviorSubject<null>(null);
  private readonly _save$ = new Subject();
  private readonly _selectedInstance$ = new BehaviorSubject<ConnectorInstance>(undefined);
  private readonly _lastConfigIdAdded$ = new BehaviorSubject<string>('');
  private readonly _selectedConnector$ = new BehaviorSubject<ConnectorType>(undefined);
  private readonly _connectorTypes$ = new BehaviorSubject<Array<ConnectorType>>(undefined);
  private readonly _modalType$ = new BehaviorSubject<ConnectorModal>('add');
  private readonly _delete$ = new Subject();
  private readonly _hideModalSaveButton$ = new BehaviorSubject<boolean>(false);

  get showModal$(): Observable<any> {
    return this._showModal$.asObservable();
  }

  get hideModal$(): Observable<any> {
    return this._hideModal$.asObservable();
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

  get selectedConnector$(): Observable<ConnectorType> {
    return this._selectedConnector$.asObservable();
  }

  get connectorTypes$(): Observable<Array<ConnectorType>> {
    return this._connectorTypes$.asObservable();
  }

  get saveButtonDisabled$(): Observable<boolean> {
    return this._saveButtonDisabled$.asObservable();
  }

  get save$(): Observable<any> {
    return this._save$.asObservable();
  }

  get modalType$(): Observable<ConnectorModal> {
    return this._modalType$.asObservable();
  }

  get delete$(): Observable<any> {
    return this._delete$.asObservable();
  }

  get hideModalSaveButton$(): Observable<boolean> {
    return this._hideModalSaveButton$.asObservable();
  }

  showModal(): void {
    this._showModal$.next(null);
  }

  hideModal(): void {
    this._hideModal$.next(null);
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
    this._refresh$.next(null);
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

  setSelectedConnectorType(connectorType: ConnectorType): void {
    this._selectedConnector$.next(connectorType);
  }

  clearSelectedConnector(): void {
    this._selectedConnector$.next(undefined);
  }

  setConnectorTypes(connectorTypes: Array<ConnectorType>): void {
    this._connectorTypes$.next(connectorTypes);
  }

  enableSaveButton(): void {
    this._saveButtonDisabled$.next(false);
  }

  disableSaveButton(): void {
    this._saveButtonDisabled$.next(true);
  }

  save(): void {
    this._saveButtonDisabled$.pipe(take(1)).subscribe(saveButtonDisabled => {
      if (!saveButtonDisabled) {
        this._save$.next(null);
      }
    });
  }

  setModalType(type: ConnectorModal): void {
    this._modalType$.next(type);
  }

  delete(): void {
    this._delete$.next(null);
  }

  hideModalSaveButton(): void {
    this._hideModalSaveButton$.next(true);
  }

  showModalSaveButton(): void {
    this._hideModalSaveButton$.next(false);
  }
}
