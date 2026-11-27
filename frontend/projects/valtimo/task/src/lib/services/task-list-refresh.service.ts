/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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
import {ConfigService, UserSettingsService} from '@valtimo/shared';
import {BehaviorSubject, combineLatest, Observable} from 'rxjs';
import {distinctUntilChanged, map} from 'rxjs/operators';

@Injectable()
export class TaskListRefreshService {
  private readonly _userAutoRefresh$ = new BehaviorSubject<boolean | null>(null);

  public readonly autoRefresh$: Observable<boolean> = combineLatest([
    this._userAutoRefresh$,
    this.configService.getFeatureToggleObservable('enableManualTaskListRefresh'),
  ]).pipe(
    map(([userAutoRefresh, manualByDefault]) => userAutoRefresh ?? !manualByDefault),
    distinctUntilChanged()
  );

  constructor(
    private readonly configService: ConfigService,
    private readonly userSettingsService: UserSettingsService
  ) {}

  public loadPreference(): void {
    this.userSettingsService.getUserSettings().subscribe(settings => {
      // Keep a choice made while loading
      if (this._userAutoRefresh$.getValue() !== null) return;

      if (typeof settings?.taskListAutoRefresh === 'boolean') {
        this._userAutoRefresh$.next(settings.taskListAutoRefresh);
      }
    });
  }

  public setAutoRefresh(autoRefresh: boolean): void {
    this._userAutoRefresh$.next(autoRefresh);
    this.userSettingsService.saveUserSettings({taskListAutoRefresh: autoRefresh}).subscribe();
  }
}
