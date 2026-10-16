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

import {Component} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {provideRouter, Router} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {BreadcrumbItem} from 'carbon-components-angular';
import {firstValueFrom, of} from 'rxjs';
import {MenuService} from '../menu/services/menu.service';
import {BreadcrumbService} from './breadcrumb.service';

@Component({standalone: true, template: ''})
class EmptyComponent {}

describe('BreadcrumbService', () => {
  const LIST_PARAMS = {status: 'WyJhZmdlaGFuZGVsZCJd', page: '1'};

  let router: Router;
  let service: BreadcrumbService;

  const caseListBreadcrumb = async (caseDefinitionKey: string): Promise<BreadcrumbItem> => {
    service.setSecondBreadcrumb({
      route: [`/cases/${caseDefinitionKey}`],
      content: caseDefinitionKey,
      href: `/cases/${caseDefinitionKey}`,
    });
    const items = await firstValueFrom(service.breadcrumbItems$);
    return items.find(item => item.content === caseDefinitionKey)!;
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {path: 'dashboard', component: EmptyComponent},
          {path: 'cases/:caseDefinitionKey', component: EmptyComponent},
          {path: 'cases/:caseDefinitionKey/document/:documentId', component: EmptyComponent},
          {path: 'cases/:caseDefinitionKey/document/:documentId/:tab', component: EmptyComponent},
        ]),
        {
          provide: MenuService,
          useValue: {activeParentSequenceNumber$: of(null), menuItems$: of([])},
        },
        {
          provide: TranslateService,
          useValue: {stream: () => of(''), instant: (key: string) => key},
        },
      ],
    });

    router = TestBed.inject(Router);
    service = TestBed.inject(BreadcrumbService);

    await router.navigateByUrl('/cases/a?status=WyJhZmdlaGFuZGVsZCJd&page=1');
    service.cacheQueryParams('/cases/a', LIST_PARAMS);
    await router.navigateByUrl('/cases/a/document/1');
  });

  it("keeps the case list's parameters on its breadcrumb while the user moves through the case", async () => {
    expect((await caseListBreadcrumb('a')).routeExtras?.queryParams).toEqual(LIST_PARAMS);

    await router.navigateByUrl('/cases/a/document/1/documents');

    const breadcrumb = await caseListBreadcrumb('a');
    expect(breadcrumb.routeExtras?.queryParams).toEqual(LIST_PARAMS);
    expect(breadcrumb.href).toBe('/cases/a?status=WyJhZmdlaGFuZGVsZCJd&page=1');
  });

  it("forgets the case list's parameters once the user leaves its pages", async () => {
    await router.navigateByUrl('/dashboard');
    await caseListBreadcrumb('a');
    await router.navigateByUrl('/cases/a/document/1');

    expect((await caseListBreadcrumb('a')).routeExtras).toBeUndefined();
  });

  it("keeps the case list's parameters off the breadcrumbs of the case's own pages", async () => {
    await router.navigateByUrl('/cases/a/document/1/case-inspection');
    service.setThirdBreadcrumb({
      route: ['/cases/a/document/1'],
      content: '1',
      href: '/cases/a/document/1',
    });

    const items = await firstValueFrom(service.breadcrumbItems$);
    expect(items.find(item => item.content === '1')?.routeExtras).toBeUndefined();
  });

  it("does not give a case list's parameters to another case list whose key starts the same", async () => {
    await router.navigateByUrl('/cases/ab/document/2');

    expect((await caseListBreadcrumb('ab')).routeExtras).toBeUndefined();
  });
});
