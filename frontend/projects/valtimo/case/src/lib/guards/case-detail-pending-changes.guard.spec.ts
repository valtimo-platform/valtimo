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

import {ActivatedRouteSnapshot, convertToParamMap, Route, RouterStateSnapshot} from '@angular/router';
import type {CaseDetailComponent} from '../components/case-detail/case-detail.component';
import {caseDetailPendingChangesGuard} from './case-detail-pending-changes.guard';

describe('caseDetailPendingChangesGuard', () => {
  const caseDetailRoute: Route = {path: 'cases/:caseDefinitionKey/document/:documentId/:tab'};
  const otherRoute: Route = {path: 'cases/:caseDefinitionKey'};

  let component: jasmine.SpyObj<CaseDetailComponent>;

  const snapshot = (routeConfig: Route, documentId?: string): ActivatedRouteSnapshot =>
    ({
      routeConfig,
      paramMap: convertToParamMap(documentId ? {documentId} : {}),
      firstChild: null,
    }) as unknown as ActivatedRouteSnapshot;

  const state = (leaf: ActivatedRouteSnapshot): RouterStateSnapshot =>
    ({root: {firstChild: leaf} as unknown as ActivatedRouteSnapshot}) as RouterStateSnapshot;

  const runGuard = (next: ActivatedRouteSnapshot) =>
    caseDetailPendingChangesGuard(
      component,
      snapshot(caseDetailRoute, 'doc-1'),
      {} as RouterStateSnapshot,
      state(next)
    );

  beforeEach(() => {
    component = jasmine.createSpyObj<CaseDetailComponent>('CaseDetailComponent', [
      'canDeactivate',
    ]);
    component.canDeactivate.and.returnValue(false);
  });

  it('lets tab switches within the same case through without asking', () => {
    expect(runGuard(snapshot(caseDetailRoute, 'doc-1'))).toBeTrue();
    expect(component.canDeactivate).not.toHaveBeenCalled();
  });

  it('asks when going to another case', () => {
    expect(runGuard(snapshot(caseDetailRoute, 'doc-2'))).toBeFalse();
    expect(component.canDeactivate).toHaveBeenCalled();
  });

  it('asks when leaving the case detail', () => {
    expect(runGuard(snapshot(otherRoute))).toBeFalse();
    expect(component.canDeactivate).toHaveBeenCalled();
  });
});
