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

import {TestBed} from '@angular/core/testing';
import {UserSettings, UserSettingsService} from '@valtimo/shared';
import {of} from 'rxjs';
import {TaskListRefreshService} from './task-list-refresh.service';

describe('TaskListRefreshService', () => {
  let service: TaskListRefreshService;
  let userSettingsServiceSpy: jasmine.SpyObj<UserSettingsService>;

  const setStoredSettings = (settings: UserSettings): void => {
    userSettingsServiceSpy.getUserSettings.and.returnValue(of(settings));
  };

  beforeEach(() => {
    userSettingsServiceSpy = jasmine.createSpyObj<UserSettingsService>('UserSettingsService', [
      'getUserSettings',
      'saveUserSettings',
    ]);
    userSettingsServiceSpy.getUserSettings.and.returnValue(of({}));
    userSettingsServiceSpy.saveUserSettings.and.returnValue(of({}));

    TestBed.configureTestingModule({
      providers: [
        TaskListRefreshService,
        {provide: UserSettingsService, useValue: userSettingsServiceSpy},
      ],
    });

    service = TestBed.inject(TaskListRefreshService);
  });

  it('defaults to automatic refresh', () => {
    expect(service.autoRefresh).toBeTrue();
  });

  it('loadPreference applies the stored preference', () => {
    setStoredSettings({taskListAutoRefresh: false});

    service.loadPreference();

    expect(service.autoRefresh).toBeFalse();
  });

  it('loadPreference keeps the default when nothing is stored', () => {
    setStoredSettings({languageCode: 'nl'});

    service.loadPreference();

    expect(service.autoRefresh).toBeTrue();
  });

  it('setAutoRefresh persists the preference without dropping other settings', () => {
    setStoredSettings({languageCode: 'nl', taskListPageSizes: {'case-a': 25}});

    service.setAutoRefresh(false);

    expect(service.autoRefresh).toBeFalse();
    expect(userSettingsServiceSpy.saveUserSettings).toHaveBeenCalledWith({
      languageCode: 'nl',
      taskListPageSizes: {'case-a': 25},
      taskListAutoRefresh: false,
    });
  });

  it('counts pending updates and clears them on refresh', () => {
    service.markPendingUpdate();
    service.markPendingUpdate();

    expect(service.pendingUpdateCount).toBe(2);

    service.clearPendingUpdates();

    expect(service.pendingUpdateCount).toBe(0);
  });

  it('clears pending updates when switching back to automatic', () => {
    service.setAutoRefresh(false);
    service.markPendingUpdate();

    service.setAutoRefresh(true);

    expect(service.pendingUpdateCount).toBe(0);
  });
});
