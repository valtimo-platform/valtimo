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
import {ActivatedRoute, DefaultUrlSerializer, Navigation, Params, Router} from '@angular/router';
import {BehaviorSubject, firstValueFrom} from 'rxjs';
import {CaseParameters} from '../models';
import {CaseParameterService} from './case-parameter.service';

describe('CaseParameterService', () => {
  const STATUS_A = btoa(JSON.stringify(['open']));
  const STATUS_B = btoa(JSON.stringify(['closed']));

  let queryParams$: BehaviorSubject<Params>;
  let router: jasmine.SpyObj<Router>;
  let service: CaseParameterService;

  beforeEach(() => {
    queryParams$ = new BehaviorSubject<Params>({status: STATUS_A, assignee: 'all'});
    router = jasmine.createSpyObj('Router', ['navigate', 'parseUrl', 'getCurrentNavigation']);
    router.getCurrentNavigation.and.returnValue(null);
    router.parseUrl.and.returnValue({
      queryParams: {},
      fragment: null,
      toString: () => '/cases',
    } as any);

    TestBed.configureTestingModule({
      providers: [
        CaseParameterService,
        {provide: ActivatedRoute, useValue: {queryParams: queryParams$}},
        {provide: Router, useValue: router},
      ],
    });

    service = TestBed.inject(CaseParameterService);
  });

  it('starts from the filter in the address', async () => {
    expect(await firstValueFrom(service.caseParameters$)).toEqual({
      assignee: 'all',
      status: STATUS_A,
    } as CaseParameters);
  });

  it('rebuilds the parameters from the new address instead of keeping the previous ones', async () => {
    queryParams$.next({status: STATUS_B});

    service.resetParametersToRoute();

    expect(await firstValueFrom(service.caseParameters$)).toEqual({
      status: STATUS_B,
    } as CaseParameters);
    expect(await firstValueFrom(service.searchFieldValues$)).toEqual({});
  });

  it('keeps the address in step with the parameters', () => {
    router.navigate.calls.reset();

    service.setStatusParameter(['closed']);

    expect(router.navigate).toHaveBeenCalledOnceWith(['/cases'], {
      queryParams: {assignee: 'all', status: STATUS_B},
      replaceUrl: true,
    });
  });

  it('leaves the address alone while a navigation to another page is under way', () => {
    router.getCurrentNavigation.and.returnValue(navigationTo('/cases/other'));
    router.navigate.calls.reset();

    service.setStatusParameter(['closed']);

    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('keeps the address in step while a navigation within the list is under way', () => {
    router.getCurrentNavigation.and.returnValue(navigationTo(`/cases?status=${STATUS_A}`));
    router.navigate.calls.reset();

    service.setStatusParameter(['closed']);

    expect(router.navigate).toHaveBeenCalledTimes(1);
  });

  it('rebuilds to no filter at all when the new address has none', async () => {
    queryParams$.next({});

    service.resetParametersToRoute();

    expect(await firstValueFrom(service.caseParameters$)).toBeUndefined();
  });

  function navigationTo(url: string): Navigation {
    return {extractedUrl: new DefaultUrlSerializer().parse(url)} as Navigation;
  }
});
