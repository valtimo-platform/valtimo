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

import {NavigationEnd, Router} from '@angular/router';
import {Subject} from 'rxjs';
import {CaseListOriginService} from './case-list-origin.service';

describe('CaseListOriginService', () => {
  let service: CaseListOriginService;
  let events$: Subject<unknown>;

  const navigateTo = (url: string): void => events$.next(new NavigationEnd(1, url, url));

  beforeEach(() => {
    events$ = new Subject();
    service = new CaseListOriginService({events: events$} as unknown as Router);
  });

  it('leads to the case definition list without a group origin', () => {
    expect(service.getListBreadcrumb('doc-1', 'permit', 'Permit')).toEqual({
      route: ['/cases/permit'],
      content: 'Permit',
      href: '/cases/permit',
    });
  });

  it('leads back to the group the case was opened from', () => {
    service.setGroupOrigin('doc-1', 'team-a', 'Team A');

    expect(service.getListBreadcrumb('doc-1', 'permit', 'Permit')).toEqual({
      route: ['/groups/team-a'],
      content: 'Team A',
      href: '/groups/team-a',
    });
  });

  it('ignores the group origin for another case', () => {
    service.setGroupOrigin('doc-1', 'team-a', 'Team A');

    expect(service.getListBreadcrumb('doc-2', 'permit', 'Permit').href).toBe('/cases/permit');
  });

  it('keeps the group origin while navigating within the case', () => {
    service.setGroupOrigin('doc-1', 'team-a', 'Team A');

    navigateTo('/cases/permit/document/doc-1/summary');
    navigateTo('/cases/permit/document/doc-1/case-inspection');

    expect(service.getListBreadcrumb('doc-1', 'permit', 'Permit').href).toBe('/groups/team-a');
  });

  it('forgets the group origin once the case is left', () => {
    service.setGroupOrigin('doc-1', 'team-a', 'Team A');

    navigateTo('/tasks');

    expect(service.getListBreadcrumb('doc-1', 'permit', 'Permit').href).toBe('/cases/permit');
  });
});
