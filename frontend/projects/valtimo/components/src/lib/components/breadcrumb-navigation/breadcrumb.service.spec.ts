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
import {Router, UrlSerializer} from '@angular/router';
import {TranslateModule} from '@ngx-translate/core';
import {BreadcrumbItem} from 'carbon-components-angular';
import {BehaviorSubject, of, Subject} from 'rxjs';
import {MenuService} from '../menu/services/menu.service';
import {BreadcrumbService} from './breadcrumb.service';

describe('BreadcrumbService', () => {
  const routerEvents$ = new Subject<unknown>();
  const router = {url: '/', config: [], events: routerEvents$};
  let service: BreadcrumbService;
  let items: Array<BreadcrumbItem>;
  let error: unknown;

  const navigate = (url: string): void => {
    router.url = url;
    routerEvents$.next(null);
  };

  const contents = (): Array<unknown> => items.map(item => item.content);

  beforeEach(() => {
    router.url = '/';
    items = [];
    error = null;

    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      providers: [
        {provide: Router, useValue: router},
        {
          provide: MenuService,
          useValue: {activeParentSequenceNumber$: new BehaviorSubject(''), menuItems$: of([])},
        },
        {provide: UrlSerializer, useValue: {}},
      ],
    });

    service = TestBed.inject(BreadcrumbService);
    service.breadcrumbItems$.subscribe({
      next: breadcrumbItems => (items = breadcrumbItems),
      error: err => (error = err),
    });
  });

  it('keeps a breadcrumb that leads to another page', () => {
    navigate('/iko/demo/bsn');
    service.setSecondBreadcrumb({content: 'Klant', route: ['/iko/demo'], href: '/iko/demo'});

    expect(contents()).toEqual(['Klant']);
  });

  it('drops a breadcrumb that leads to the current page', () => {
    navigate('/iko/demo/bsn');
    service.setSecondBreadcrumb({content: 'Klant', route: ['/iko/demo'], href: '/iko/demo'});
    service.setThirdBreadcrumb({
      content: 'Results',
      route: ['/iko/demo/bsn'],
      href: '/iko/demo/bsn',
    });

    expect(contents()).toEqual(['Klant']);
  });

  it('drops a breadcrumb left behind for a page the user navigated to', () => {
    navigate('/iko/demo/bsn');
    service.setSecondBreadcrumb({content: 'Klant', route: ['/iko/demo'], href: '/iko/demo'});

    navigate('/iko/demo');

    expect(contents()).toEqual([]);
  });

  it('compares paths regardless of query params, trailing slash and encoding', () => {
    navigate('/decision-tables/edit/a%3A1/?page=2');
    service.setThirdBreadcrumb({
      content: 'Decision',
      route: ['/decision-tables/edit/a:1'],
      href: '/decision-tables/edit/a:1?tab=x',
    });

    expect(contents()).toEqual([]);
  });

  it('compares against the route when a breadcrumb has no href', () => {
    navigate('/case-management');
    service.setThirdBreadcrumb({content: 'Cases', route: ['/case-management']});

    expect(contents()).toEqual([]);
  });

  it('drops an empty breadcrumb without breaking the breadcrumb stream', () => {
    navigate('/iko/demo/bsn/details/1');
    service.setSecondBreadcrumb({content: '', route: ['/iko/demo'], href: '/iko/demo'});

    expect(error).toBeNull();
    expect(contents()).toEqual([]);

    service.setSecondBreadcrumb({content: 'Klant', route: ['/iko/demo'], href: '/iko/demo'});

    expect(contents()).toEqual(['Klant']);
  });
});
