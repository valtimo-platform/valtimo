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
import {Router} from '@angular/router';
import {RouterTestingModule} from '@angular/router/testing';
import {TranslateService} from '@ngx-translate/core';
import {BreadcrumbItem} from 'carbon-components-angular';
import {BehaviorSubject, of} from 'rxjs';
import {MenuService} from '../menu/services/menu.service';
import {BreadcrumbService} from './breadcrumb.service';

describe('BreadcrumbService', () => {
  const CASE_LIST_ROUTE = '/cases/bezwaar';
  const LIST_PARAMS = {page: '2', size: '10', status: 'WyJvcGVuIl0='};

  let service: BreadcrumbService;
  let translationsLoaded$: BehaviorSubject<string>;
  let emissions: Array<Array<BreadcrumbItem>>;

  const caseListBreadcrumb = (route = CASE_LIST_ROUTE): BreadcrumbItem => ({
    route: [route],
    content: 'Bezwaar',
    href: route,
  });

  const caseListItem = (items: Array<BreadcrumbItem>): BreadcrumbItem =>
    items.find(item => item.content === 'Bezwaar');

  beforeEach(() => {
    translationsLoaded$ = new BehaviorSubject<string>('key');

    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [
        BreadcrumbService,
        {
          provide: MenuService,
          useValue: {
            activeParentSequenceNumber$: of('1'),
            menuItems$: of([{sequence: 1, title: 'Cases'}]),
          },
        },
        {
          provide: TranslateService,
          useValue: {
            stream: () => translationsLoaded$.asObservable(),
            instant: (key: string) => key,
          },
        },
      ],
    });

    service = TestBed.inject(BreadcrumbService);
    emissions = [];
    service.breadcrumbItems$.subscribe(items => emissions.push(items));
  });

  it('keeps the cached list params on the breadcrumb across every later emission', async () => {
    service.cacheQueryParams(CASE_LIST_ROUTE, LIST_PARAMS);
    service.setSecondBreadcrumb(caseListBreadcrumb());

    translationsLoaded$.next('key');
    service.setThirdBreadcrumb({content: 'General'});
    await TestBed.inject(Router).navigateByUrl('/');
    service.clearThirdBreadcrumb();

    const emissionsWithBreadcrumb = emissions.filter(items => !!caseListItem(items));
    expect(emissionsWithBreadcrumb.length).toBeGreaterThan(3);
    emissionsWithBreadcrumb.forEach(items => {
      expect(caseListItem(items).routeExtras).toEqual({queryParams: LIST_PARAMS});
      expect(caseListItem(items).href).toContain('page=2');
    });
  });

  it('only puts cached params on the breadcrumb of exactly the cached route', () => {
    service.cacheQueryParams(CASE_LIST_ROUTE, LIST_PARAMS);
    service.setSecondBreadcrumb(caseListBreadcrumb('/cases/bezwaar-extra'));

    const item = caseListItem(emissions[emissions.length - 1]);
    expect(item.routeExtras).toBeUndefined();
    expect(item.href).toBe('/cases/bezwaar-extra');
  });

  it('replaces the cached params when the list is left again without any params', () => {
    service.cacheQueryParams(CASE_LIST_ROUTE, LIST_PARAMS);
    service.cacheQueryParams(CASE_LIST_ROUTE, {});
    service.setSecondBreadcrumb(caseListBreadcrumb());

    const item = caseListItem(emissions[emissions.length - 1]);
    expect(item.routeExtras).toBeUndefined();
    expect(item.href).toBe(CASE_LIST_ROUTE);
  });
});
