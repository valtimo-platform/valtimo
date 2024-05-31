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
import {BehaviorSubject, Observable} from 'rxjs';

@Injectable()
export class FormIoLocalStorageService {
  private readonly _FORMIO_TOKEN_LOCAL_STORAGE_KEY = 'formioToken';
  private readonly _tokenSetInLocalStorage$ = new BehaviorSubject<boolean>(false);

  public get tokenSetInLocalStorage$(): Observable<boolean> {
    return this._tokenSetInLocalStorage$.asObservable();
  }

  public setTokenInLocalStorage(token: string): void {
    setTimeout(() => {
      localStorage.setItem(this._FORMIO_TOKEN_LOCAL_STORAGE_KEY, token);
      this.checkIfTokenExistsInLocalStorage();
    });
  }

  public clearTokenFromLocalStorage(): void {
    localStorage.removeItem(this._FORMIO_TOKEN_LOCAL_STORAGE_KEY);
    this.checkIfTokenIsRemovedFromLocalStorage();
  }

  private getTokenFromLocalStorage(): string | null {
    return localStorage.getItem(this._FORMIO_TOKEN_LOCAL_STORAGE_KEY);
  }

  private checkIfTokenExistsInLocalStorage(): void {
    const maxChecks = 100;
    let checks = 0;

    if (this.getTokenFromLocalStorage()) {
      this._tokenSetInLocalStorage$.next(true);
    } else if (checks <= maxChecks) {
      checks++;
      this.checkIfTokenExistsInLocalStorage();
    }
  }

  private checkIfTokenIsRemovedFromLocalStorage(): void {
    const maxChecks = 100;
    let checks = 0;

    if (this.getTokenFromLocalStorage() && checks <= maxChecks) {
      checks++;
      this.checkIfTokenIsRemovedFromLocalStorage();
    } else {
      this._tokenSetInLocalStorage$.next(false);
    }
  }
}
