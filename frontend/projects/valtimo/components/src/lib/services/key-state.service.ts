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

import {Injectable, OnDestroy} from '@angular/core';
import {fromEvent, merge, Observable, Subject} from 'rxjs';
import {map, takeUntil} from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class KeyStateService implements OnDestroy {
  private _isCtrlOrCmdPressed: boolean = false;
  private _destroy$ = new Subject<void>();

  constructor() {
    const keyDowns$: Observable<boolean> = fromEvent<KeyboardEvent>(document, 'keydown').pipe(
      map(event => event.ctrlKey || event.metaKey)
    );

    const keyUps$: Observable<boolean> = fromEvent<KeyboardEvent>(document, 'keyup').pipe(
      map(() => false)
    );

    merge(keyDowns$, keyUps$)
      .pipe(takeUntil(this._destroy$))
      .subscribe(isPressed => {
        this._isCtrlOrCmdPressed = isPressed;
      });
  }

  public getCtrlOrCmdState(): boolean {
    return this._isCtrlOrCmdPressed;
  }

  public ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }
}
