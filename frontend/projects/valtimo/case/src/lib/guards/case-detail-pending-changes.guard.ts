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

import {ActivatedRouteSnapshot, CanDeactivateFn, RouterStateSnapshot} from '@angular/router';
import type {CaseDetailComponent} from '../components/case-detail/case-detail.component';

/** Asks before leaving a case while a task or start form has unsaved edits. */
const caseDetailPendingChangesGuard: CanDeactivateFn<CaseDetailComponent> = (
  component,
  currentRoute,
  _currentState,
  nextState
) => staysOnCase(currentRoute, nextState) || component.canDeactivate();

/** Switching tabs reuses the case detail, so forms in the side panel keep their edits. */
function staysOnCase(currentRoute: ActivatedRouteSnapshot, nextState: RouterStateSnapshot): boolean {
  let next = nextState.root;
  while (next.firstChild) next = next.firstChild;

  return (
    next.routeConfig === currentRoute.routeConfig &&
    next.paramMap.get('documentId') === currentRoute.paramMap.get('documentId')
  );
}

export {caseDetailPendingChangesGuard};
