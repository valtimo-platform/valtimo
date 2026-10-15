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
import {ActivatedRoute, DefaultUrlSerializer, Params, Router} from '@angular/router';
import {DocumentService} from '@valtimo/document';
import {BehaviorSubject, take} from 'rxjs';
import {CaseListSearchService} from './case-list-search.service';
import {CaseListService} from './case-list.service';
import {CaseParameterService} from './case-parameter.service';

describe('CaseListSearchService', () => {
  let router: jasmine.SpyObj<Router>;

  const createService = (queryParams: Params): CaseListSearchService => {
    const serializer = new DefaultUrlSerializer();
    router = jasmine.createSpyObj<Router>('Router', ['navigate', 'parseUrl'], {
      url: '/cases/bezwaar',
    });
    router.parseUrl.and.callFake((url: string) => serializer.parse(url));

    TestBed.configureTestingModule({
      providers: [
        CaseListSearchService,
        CaseListService,
        CaseParameterService,
        {provide: Router, useValue: router},
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {queryParams},
            queryParams: new BehaviorSubject<Params>(queryParams),
          },
        },
        {provide: DocumentService, useValue: {}},
      ],
    });

    return TestBed.inject(CaseListSearchService);
  };

  const globalSearchFilter = (service: CaseListSearchService): string => {
    let value: string;
    service.globalSearchFilter$.pipe(take(1)).subscribe(filter => (value = filter));
    return value;
  };

  const lastNavigatedQueryParams = (): Params =>
    router.navigate.calls.mostRecent().args[1].queryParams;

  it('starts with the free-text search from the url', () => {
    const service = createService({globalSearch: 'Jansen', page: '2'});

    expect(globalSearchFilter(service)).toBe('Jansen');
  });

  it('keeps the free-text search from the url in the list url', () => {
    createService({globalSearch: 'Jansen'});

    expect(lastNavigatedQueryParams().globalSearch).toBe('Jansen');
  });

  it('writes a new free-text search into the url', () => {
    const service = createService({});

    service.setGlobalSearchFilter('Pietersen');

    expect(globalSearchFilter(service)).toBe('Pietersen');
    expect(lastNavigatedQueryParams().globalSearch).toBe('Pietersen');
  });

  it('removes the free-text search from the url when it is cleared', () => {
    const service = createService({globalSearch: 'Jansen'});

    service.setGlobalSearchFilter(null);

    expect(globalSearchFilter(service)).toBe('');
    expect(lastNavigatedQueryParams()?.globalSearch).toBeUndefined();
  });
});
