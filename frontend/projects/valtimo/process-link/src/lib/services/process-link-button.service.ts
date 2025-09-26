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
export class ProcessLinkButtonService {
  private readonly _showSaveButton$ = new BehaviorSubject<boolean>(false);
  private readonly _enableSaveButton$ = new BehaviorSubject<boolean>(false);
  private readonly _enableNextButton$ = new BehaviorSubject<boolean>(false);
  private readonly _showBackButton$ = new BehaviorSubject<boolean>(false);
  private readonly _showNextButton$ = new BehaviorSubject<boolean>(false);
  private readonly _backButtonClick$ = new Subject<null>();
  private readonly _saveButtonClick$ = new Subject<null>();
  private readonly _nextButtonClick$ = new Subject<null>();

  get showSaveButton$(): Observable<boolean> {
    return this._showSaveButton$.asObservable();
  }
  get enableSaveButton$(): Observable<boolean> {
    return this._enableSaveButton$.asObservable();
  }
  get showNextButton$(): Observable<boolean> {
    return this._showNextButton$.asObservable();
  }
  get enableNextButton$(): Observable<boolean> {
    return this._enableNextButton$.asObservable();
  }
  get showBackButton$(): Observable<boolean> {
    return this._showBackButton$.asObservable();
  }
  get backButtonClick$(): Observable<null> {
    return this._backButtonClick$.asObservable();
  }
  get saveButtonClick$(): Observable<null> {
    return this._saveButtonClick$.asObservable();
  }
  get nextButtonClick$(): Observable<null> {
    return this._nextButtonClick$.asObservable();
  }

  showSaveButton(): void {
    this._showSaveButton$.next(true);
  }

  hideSaveButton(): void {
    this._showSaveButton$.next(false);
  }

  showNextButton(): void {
    this._showNextButton$.next(true);
  }

  hideNextButton(): void {
    this._showNextButton$.next(false);
  }

  enableNextButton(): void {
    this._enableNextButton$.next(true);
  }

  disableNextButton(): void {
    this._enableNextButton$.next(false);
  }

  enableSaveButton(): void {
    this._enableSaveButton$.next(true);
  }

  disableSaveButton(): void {
    this._enableSaveButton$.next(false);
  }

  showBackButton(): void {
    this._showBackButton$.next(true);
  }

  hideBackButton(): void {
    this._showBackButton$.next(false);
  }

  clickBackButton(): void {
    this._backButtonClick$.next(null);
  }

  clickSaveButton(): void {
    this._saveButtonClick$.next(null);
  }

  clickNextButton(): void {
    this._nextButtonClick$.next(null);
  }

  resetButtons(): void {
    this.disableSaveButton();
    this.hideBackButton();
    this.hideSaveButton();
    this.hideNextButton();
    this.disableNextButton();
  }
}
