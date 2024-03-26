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
import {BehaviorSubject, Observable, combineLatest} from 'rxjs';
import {take} from 'rxjs/operators';
import {ButtonType} from '../models';

@Injectable({
  providedIn: 'root',
})
export class PromptService {
  private readonly _promptVisible$ = new BehaviorSubject<boolean>(false);
  private readonly _appearing$ = new BehaviorSubject<boolean>(false);
  private readonly _disappearing$ = new BehaviorSubject<boolean>(false);
  private readonly _appearingDelayMs$ = new BehaviorSubject<number>(140);
  private readonly _identifier$ = new BehaviorSubject<string>('');
  private readonly _headerText$ = new BehaviorSubject<string>('');
  private readonly _bodyText$ = new BehaviorSubject<string>('');
  private readonly _cancelText$ = new BehaviorSubject<string>('');
  private readonly _confirmText$ = new BehaviorSubject<string>('');
  private readonly _cancelMdiIcon$ = new BehaviorSubject<string>('');
  private readonly _confirmMdiIcon$ = new BehaviorSubject<string>('');
  private readonly _cancelButtonType$ = new BehaviorSubject<ButtonType>('primary');
  private readonly _confirmButtonType$ = new BehaviorSubject<ButtonType>('primary');
  private readonly _closeOnConfirm$ = new BehaviorSubject<boolean>(false);
  private readonly _closeOnCancel$ = new BehaviorSubject<boolean>(false);
  private readonly _closeButtonVisible$ = new BehaviorSubject<boolean>(false);
  private readonly _cancelCallbackFunction$ = new BehaviorSubject<() => void>(() => {});
  private readonly _confirmCallbackFunction$ = new BehaviorSubject<() => void>(() => {});
  private readonly _closeCallbackFunction$ = new BehaviorSubject<() => void>(() => {});

  get promptVisible$() {
    return this._promptVisible$.asObservable();
  }

  get appearing$() {
    return this._appearing$.asObservable();
  }

  get disappearing$() {
    return this._disappearing$.asObservable();
  }

  get appearingDelayMs$() {
    return this._appearingDelayMs$.asObservable();
  }

  get appearingDelayMs() {
    return this._appearingDelayMs$.getValue();
  }

  get identifier$(): Observable<string> {
    return this._identifier$.asObservable();
  }

  get headerText$(): Observable<string> {
    return this._headerText$.asObservable();
  }

  get bodyText$(): Observable<string> {
    return this._bodyText$.asObservable();
  }

  get cancelText$(): Observable<string> {
    return this._cancelText$.asObservable();
  }

  get confirmText$(): Observable<string> {
    return this._confirmText$.asObservable();
  }

  get cancelMdiIcon$(): Observable<string> {
    return this._cancelMdiIcon$.asObservable();
  }

  get confirmMdiIcon$(): Observable<string> {
    return this._confirmMdiIcon$.asObservable();
  }

  get cancelButtonType$(): Observable<ButtonType> {
    return this._cancelButtonType$.asObservable();
  }

  get confirmButtonType$(): Observable<ButtonType> {
    return this._confirmButtonType$.asObservable();
  }

  get closeButtonVisible$(): Observable<boolean> {
    return this._closeButtonVisible$.asObservable();
  }

  openPrompt(promptParameters: {
    identifier?: string;
    headerText: string;
    bodyText: string;
    cancelButtonText: string;
    confirmButtonText: string;
    cancelMdiIcon?: string;
    confirmMdiIcon?: string;
    cancelButtonType?: ButtonType;
    confirmButtonType?: ButtonType;
    closeOnConfirm?: boolean;
    closeOnCancel?: boolean;
    closeButtonVisible?: boolean;
    cancelCallbackFunction?: () => void;
    confirmCallBackFunction?: () => void;
    closeCallBackFunction?: () => void;
  }): void {
    if (promptParameters.identifier) this._identifier$.next(promptParameters.identifier);
    this._headerText$.next(promptParameters.headerText);
    this._bodyText$.next(promptParameters.bodyText);
    this._cancelText$.next(promptParameters.cancelButtonText);
    this._confirmText$.next(promptParameters.confirmButtonText);
    if (promptParameters.cancelMdiIcon) this._cancelMdiIcon$.next(promptParameters.cancelMdiIcon);
    if (promptParameters.confirmMdiIcon)
      this._confirmMdiIcon$.next(promptParameters.confirmMdiIcon);
    if (promptParameters.cancelButtonType)
      this._cancelButtonType$.next(promptParameters.cancelButtonType);
    if (promptParameters.confirmButtonType)
      this._confirmButtonType$.next(promptParameters.confirmButtonType);
    if (promptParameters.closeOnConfirm)
      this._closeOnConfirm$.next(promptParameters.closeOnConfirm);
    if (promptParameters.closeOnCancel) this._closeOnCancel$.next(promptParameters.closeOnCancel);
    if (promptParameters.closeButtonVisible)
      this._closeButtonVisible$.next(promptParameters.closeButtonVisible);
    if (promptParameters.cancelCallbackFunction)
      this._cancelCallbackFunction$.next(promptParameters.cancelCallbackFunction);
    if (promptParameters.confirmCallBackFunction)
      this._confirmCallbackFunction$.next(promptParameters.confirmCallBackFunction);
    if (promptParameters.closeCallBackFunction)
      this._closeCallbackFunction$.next(promptParameters.closeCallBackFunction);

    this._promptVisible$.next(true);
    this._appearing$.next(true);
    this.setAppearingTimeout();
  }

  setAppearingDelay(appearingDelayMs: number): void {
    this._appearingDelayMs$.next(appearingDelayMs);
  }

  setBodyText(bodyText: string): void {
    this._bodyText$.next(bodyText);
  }

  confirm(): void {
    combineLatest([this._closeOnConfirm$, this._confirmCallbackFunction$])
      .pipe(take(1))
      .subscribe(([closeOnConfirm, confirmCallback]) => {
        if (closeOnConfirm) {
          this.closePrompt(confirmCallback);
        } else if (confirmCallback) {
          confirmCallback();
        }
      });
  }

  cancel(): void {
    combineLatest([this._closeOnCancel$, this._cancelCallbackFunction$])
      .pipe(take(1))
      .subscribe(([closeOnCancel, cancelCallback]) => {
        if (closeOnCancel) {
          this.closePrompt(cancelCallback);
        } else if (cancelCallback) {
          cancelCallback();
        }
      });
  }

  close(): void {
    combineLatest([this._closeButtonVisible$, this._closeCallbackFunction$])
      .pipe(take(1))
      .subscribe(([closeButtonVisible, cancelCallback]) => {
        if (closeButtonVisible) {
          this.closePrompt(cancelCallback);
        }
      });
  }

  private closePrompt(callBackFunction?: () => void): void {
    if (callBackFunction) {
      callBackFunction();
    }
    this._disappearing$.next(true);
    this.setDisappearingTimeout();
    this._promptVisible$.next(false);
  }

  private setAppearingTimeout(): void {
    this._appearingDelayMs$.pipe(take(1)).subscribe(appearingDelayMs => {
      setTimeout(() => {
        this._appearing$.next(false);
      }, appearingDelayMs);
    });
  }

  private setDisappearingTimeout(): void {
    this._appearingDelayMs$.pipe(take(1)).subscribe(appearingDelayMs => {
      setTimeout(() => {
        this._disappearing$.next(false);
        this.clear();
      }, appearingDelayMs);
    });
  }

  private clear(): void {
    this._identifier$.next('');
    this._headerText$.next('');
    this._bodyText$.next('');
    this._cancelText$.next('');
    this._confirmText$.next('');
    this._cancelMdiIcon$.next('');
    this._confirmMdiIcon$.next('');
    this._cancelButtonType$.next('primary');
    this._confirmButtonType$.next('primary');
    this._closeOnCancel$.next(false);
    this._closeOnConfirm$.next(false);
    this._cancelCallbackFunction$.next(() => {});
    this._confirmCallbackFunction$.next(() => {});
    this._closeCallbackFunction$.next(() => {});
  }
}
