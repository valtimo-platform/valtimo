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

import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {QuickSearchItem} from '@valtimo/components';
import {ConfigService, UserSettings, UserSettingsService} from '@valtimo/shared';
import {firstValueFrom, Observable, of, throwError} from 'rxjs';
import {CaseListQuickSearchService} from './case-list-quick-search.service';

describe('CaseListQuickSearchService', () => {
  const CASE_DEFINITION_KEY = 'layout-test';
  const QUICK_SEARCH_URL = `/api/v1/case/${CASE_DEFINITION_KEY}/stored-quick-search`;
  const OPEN: QuickSearchItem = {title: 'Open', queryPath: 'status=WyJvcGVuIl0%3D'};
  const CLOSED: QuickSearchItem = {title: 'Closed', queryPath: 'status=WyJjbG9zZWQiXQ%3D%3D'};

  let httpTestingController: HttpTestingController;
  let service: CaseListQuickSearchService;
  let storedSettings: UserSettings;
  let savedSettings: UserSettings[];
  let userSettingsService: Partial<UserSettingsService>;

  const quickSearchItems = async (): Promise<QuickSearchItem[]> => {
    const result = firstValueFrom(service.getQuickSearchItems());
    httpTestingController.expectOne(QUICK_SEARCH_URL).flush([OPEN, CLOSED]);
    return result;
  };

  beforeEach(() => {
    storedSettings = {};
    savedSettings = [];

    userSettingsService = {
      getUserSettings: (): Observable<UserSettings> => of({...storedSettings}),
      // Merges per top-level key, as the backend does.
      saveUserSettings: (settings: UserSettings): Observable<null> => {
        savedSettings.push(settings);
        storedSettings = {...storedSettings, ...settings};
        return of(null);
      },
    };

    TestBed.configureTestingModule({
      providers: [
        CaseListQuickSearchService,
        provideHttpClient(),
        provideHttpClientTesting(),
        {provide: ConfigService, useValue: {config: {valtimoApi: {endpointUri: '/api/'}}}},
        {provide: UserSettingsService, useValue: userSettingsService},
      ],
    });

    httpTestingController = TestBed.inject(HttpTestingController);
    service = TestBed.inject(CaseListQuickSearchService);
    service.initParams(CASE_DEFINITION_KEY);
  });

  afterEach(() => httpTestingController.verify());

  it('marks the quick search set as default, and no other', async () => {
    await firstValueFrom(service.setDefaultQuickSearchItem(CLOSED));

    const items = await quickSearchItems();

    expect(items.find(item => item.title === CLOSED.title)?.isDefault).toBeTrue();
    expect(items.find(item => item.title === OPEN.title)?.isDefault).toBeFalse();
  });

  it('replaces the previous default when another quick search is set as default', async () => {
    await firstValueFrom(service.setDefaultQuickSearchItem(OPEN));
    await firstValueFrom(service.setDefaultQuickSearchItem(CLOSED));

    expect(storedSettings.caseListDefaultQuickSearches).toEqual({
      [CASE_DEFINITION_KEY]: CLOSED.title,
    });
    expect((await quickSearchItems()).filter(item => item.isDefault).length).toBe(1);
  });

  it('clears the default', async () => {
    await firstValueFrom(service.setDefaultQuickSearchItem(OPEN));
    await firstValueFrom(service.clearDefaultQuickSearchItem());

    expect(storedSettings.caseListDefaultQuickSearches).toEqual({});
    expect((await quickSearchItems()).some(item => item.isDefault)).toBeFalse();
  });

  it('clears the default when the default quick search is deleted', async () => {
    await firstValueFrom(service.setDefaultQuickSearchItem(OPEN));

    const deleted = firstValueFrom(service.deleteQuickSearchItem(OPEN));
    httpTestingController.expectOne(`${QUICK_SEARCH_URL}/${OPEN.title}`).flush(null);
    await deleted;

    expect(storedSettings.caseListDefaultQuickSearches).toEqual({});
  });

  it('completes a delete when the default cannot be read', async () => {
    userSettingsService.getUserSettings = () => throwError(() => new Error('unavailable'));

    const deleted = firstValueFrom(service.deleteQuickSearchItem(OPEN));
    httpTestingController.expectOne(`${QUICK_SEARCH_URL}/${OPEN.title}`).flush(null);

    await expectAsync(deleted).toBeResolved();
  });

  it('keeps the default when another quick search is deleted', async () => {
    await firstValueFrom(service.setDefaultQuickSearchItem(OPEN));

    const deleted = firstValueFrom(service.deleteQuickSearchItem(CLOSED));
    httpTestingController.expectOne(`${QUICK_SEARCH_URL}/${CLOSED.title}`).flush(null);
    await deleted;

    expect(storedSettings.caseListDefaultQuickSearches).toEqual({
      [CASE_DEFINITION_KEY]: OPEN.title,
    });
  });

  it('saves only the defaults, keeping the other settings and the defaults of other case lists', async () => {
    storedSettings = {
      languageCode: 'nl',
      caseListPageSizes: {[CASE_DEFINITION_KEY]: 25},
      caseListDefaultQuickSearches: {'other-case': 'Mine'},
    };

    await firstValueFrom(service.setDefaultQuickSearchItem(OPEN));

    expect(savedSettings).toEqual([
      {caseListDefaultQuickSearches: {'other-case': 'Mine', [CASE_DEFINITION_KEY]: OPEN.title}},
    ]);
    expect(storedSettings.languageCode).toBe('nl');
    expect(storedSettings.caseListPageSizes).toEqual({[CASE_DEFINITION_KEY]: 25});
  });

  it('still lists the quick searches when the settings cannot be read', async () => {
    userSettingsService.getUserSettings = () => throwError(() => new Error('unavailable'));

    expect(await quickSearchItems()).toEqual([
      {...OPEN, isDefault: false},
      {...CLOSED, isDefault: false},
    ]);
  });
});
