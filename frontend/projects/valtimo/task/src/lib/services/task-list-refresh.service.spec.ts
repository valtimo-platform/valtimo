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

import {TestBed} from '@angular/core/testing';
import {ConfigService, UserSettings, UserSettingsService} from '@valtimo/shared';
import {BehaviorSubject, of, Subject} from 'rxjs';
import {TaskListRefreshService} from './task-list-refresh.service';

describe('TaskListRefreshService', () => {
  let service: TaskListRefreshService;
  let manualByDefault$: BehaviorSubject<boolean>;
  let userSettings$: Subject<UserSettings>;
  let userSettingsService: jasmine.SpyObj<UserSettingsService>;

  const latestAutoRefresh = (): boolean | undefined => {
    let value: boolean | undefined;
    service.autoRefresh$.subscribe(autoRefresh => (value = autoRefresh)).unsubscribe();
    return value;
  };

  beforeEach(() => {
    manualByDefault$ = new BehaviorSubject<boolean>(false);
    userSettings$ = new Subject<UserSettings>();
    userSettingsService = jasmine.createSpyObj('UserSettingsService', [
      'getUserSettings',
      'saveUserSettings',
    ]);
    userSettingsService.getUserSettings.and.returnValue(userSettings$);
    userSettingsService.saveUserSettings.and.returnValue(of(null));

    TestBed.configureTestingModule({
      providers: [
        TaskListRefreshService,
        {
          provide: ConfigService,
          useValue: {getFeatureToggleObservable: () => manualByDefault$},
        },
        {provide: UserSettingsService, useValue: userSettingsService},
      ],
    });

    service = TestBed.inject(TaskListRefreshService);
  });

  it('refreshes automatically when neither the admin nor the user chose otherwise', () => {
    expect(latestAutoRefresh()).toBeTrue();
  });

  it('follows the admin default when the user has no preference', () => {
    manualByDefault$.next(true);
    service.loadPreference();
    userSettings$.next({});

    expect(latestAutoRefresh()).toBeFalse();
  });

  it('uses the user preference over the admin default', () => {
    manualByDefault$.next(true);
    service.loadPreference();
    userSettings$.next({taskListAutoRefresh: true});

    expect(latestAutoRefresh()).toBeTrue();
  });

  it('saves only its own setting so other user settings are kept', () => {
    service.setAutoRefresh(false);

    expect(userSettingsService.saveUserSettings).toHaveBeenCalledOnceWith({
      taskListAutoRefresh: false,
    });
    expect(latestAutoRefresh()).toBeFalse();
  });

  it('keeps a choice made before the saved preference has loaded', () => {
    service.loadPreference();
    service.setAutoRefresh(false);
    userSettings$.next({taskListAutoRefresh: true});

    expect(latestAutoRefresh()).toBeFalse();
  });

});
