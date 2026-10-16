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
import {
  ActivatedRouteSnapshot,
  convertToParamMap,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import {QuickSearchItem} from '@valtimo/components';
import {firstValueFrom, isObservable, Observable, of, throwError} from 'rxjs';
import {CaseListDefaultQuickSearchService} from '../services/case-list-default-quick-search.service';
import {caseListDefaultQuickSearchGuard} from './case-list-default-quick-search.guard';

describe('caseListDefaultQuickSearchGuard', () => {
  const STATUS = btoa(JSON.stringify(['in-behandeling']));
  const DEFAULT: QuickSearchItem = {
    title: 'In behandeling',
    queryPath: new URLSearchParams({status: STATUS}).toString(),
  };

  let defaultQuickSearchService: jasmine.SpyObj<CaseListDefaultQuickSearchService>;

  const snapshot = (queryParams: {[key: string]: string} = {}): ActivatedRouteSnapshot =>
    ({
      paramMap: convertToParamMap({caseDefinitionKey: 'layout-test'}),
      queryParamMap: convertToParamMap(queryParams),
    }) as unknown as ActivatedRouteSnapshot;

  const runGuard = async (route: ActivatedRouteSnapshot): Promise<unknown> => {
    const result = TestBed.runInInjectionContext(() =>
      caseListDefaultQuickSearchGuard(route, {} as RouterStateSnapshot)
    );
    return isObservable(result) ? firstValueFrom(result as Observable<unknown>) : result;
  };

  beforeEach(() => {
    defaultQuickSearchService = jasmine.createSpyObj('CaseListDefaultQuickSearchService', [
      'getDefaultQuickSearchItem',
    ]);
    defaultQuickSearchService.getDefaultQuickSearchItem.and.returnValue(of(DEFAULT));

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {provide: CaseListDefaultQuickSearchService, useValue: defaultQuickSearchService},
      ],
    });
  });

  it('opens a case list without query parameters on its default quick search', async () => {
    const result = (await runGuard(snapshot())) as UrlTree;

    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result)).toBe(
      `/cases/layout-test?status=${encodeURIComponent(STATUS)}`
    );
    expect(defaultQuickSearchService.getDefaultQuickSearchItem).toHaveBeenCalledWith('layout-test');
  });

  it('leaves a case list with query parameters as it is', async () => {
    expect(await runGuard(snapshot({status: STATUS, page: '2'}))).toBeTrue();
    expect(defaultQuickSearchService.getDefaultQuickSearchItem).not.toHaveBeenCalled();
  });

  it('opens the case list as before when the user has no default', async () => {
    defaultQuickSearchService.getDefaultQuickSearchItem.and.returnValue(of(null));

    expect(await runGuard(snapshot())).toBeTrue();
  });

  it('opens the case list as before when the default holds no filter', async () => {
    defaultQuickSearchService.getDefaultQuickSearchItem.and.returnValue(
      of({title: 'Empty', queryPath: ''})
    );

    expect(await runGuard(snapshot())).toBeTrue();
  });

  it('opens the case list as before when the default cannot be looked up', async () => {
    defaultQuickSearchService.getDefaultQuickSearchItem.and.returnValue(
      throwError(() => new Error('403'))
    );

    expect(await runGuard(snapshot())).toBeTrue();
  });
});
