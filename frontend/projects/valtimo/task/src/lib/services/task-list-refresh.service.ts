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
import {UserSettingsService} from '@valtimo/shared';
import {BehaviorSubject, Observable} from 'rxjs';
import {switchMap, take} from 'rxjs/operators';

@Injectable()
export class TaskListRefreshService {
  private readonly _autoRefresh$ = new BehaviorSubject<boolean>(true);

  private readonly _pendingUpdateCount$ = new BehaviorSubject<number>(0);

  public get autoRefresh$(): Observable<boolean> {
    return this._autoRefresh$.asObservable();
  }

  public get autoRefresh(): boolean {
    return this._autoRefresh$.getValue();
  }

  public get pendingUpdateCount$(): Observable<number> {
    return this._pendingUpdateCount$.asObservable();
  }

  public get pendingUpdateCount(): number {
    return this._pendingUpdateCount$.getValue();
  }

  constructor(private readonly userSettingsService: UserSettingsService) {}

  public loadPreference(): void {
    this.userSettingsService
      .getUserSettings()
      .pipe(take(1))
      .subscribe(settings => {
        if (typeof settings?.taskListAutoRefresh === 'boolean') {
          this._autoRefresh$.next(settings.taskListAutoRefresh);
        }
      });
  }

  public setAutoRefresh(enabled: boolean): void {
    this._autoRefresh$.next(enabled);

    if (enabled) this.clearPendingUpdates();

    this.userSettingsService
      .getUserSettings()
      .pipe(
        take(1),
        switchMap(settings =>
          this.userSettingsService.saveUserSettings({...settings, taskListAutoRefresh: enabled})
        )
      )
      .subscribe();
  }

  public markPendingUpdate(): void {
    this._pendingUpdateCount$.next(this.pendingUpdateCount + 1);
  }

  public clearPendingUpdates(): void {
    if (this.pendingUpdateCount !== 0) this._pendingUpdateCount$.next(0);
  }
}
