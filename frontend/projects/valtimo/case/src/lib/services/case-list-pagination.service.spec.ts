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

import {of} from 'rxjs';
import {CaseListPaginationService} from './case-list-pagination.service';

describe('CaseListPaginationService', () => {
  let service: CaseListPaginationService;
  let userSettingsService: jasmine.SpyObj<any>;
  let emitted: any[];

  beforeEach(() => {
    userSettingsService = jasmine.createSpyObj('UserSettingsService', [
      'getUserSettings',
      'saveUserSettings',
    ]);
    userSettingsService.getUserSettings.and.returnValue(of({}));
    userSettingsService.saveUserSettings.and.returnValue(of({}));

    const caseParameterService = {
      queryPaginationParams$: of({page: 1, size: 10, collectionSize: 25}),
      setPaginationParameters: () => {},
    };

    service = new CaseListPaginationService(
      {debug: () => {}} as any,
      caseParameterService as any,
      {getInitialSortState: () => undefined} as any,
      userSettingsService
    );
    service.setPagination([], 'permit');

    emitted = [];
    service.pagination$.subscribe(pagination => emitted.push(pagination));
  });

  it('ignores the page size the list emits as a string on init', () => {
    service.pageSizeChange('10');

    expect(emitted.length).toBe(1);
    expect(userSettingsService.saveUserSettings).not.toHaveBeenCalled();
  });

  it('applies a real page size change as a number', () => {
    service.pageSizeChange('20');

    expect(emitted.length).toBe(2);
    expect(emitted[1].size).toBe(20);
  });
});
