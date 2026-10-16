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

import {inject} from '@angular/core';
import {ActivatedRouteSnapshot, CanActivateFn, Router} from '@angular/router';
import {catchError, map, of} from 'rxjs';
import {CaseListDefaultQuickSearchService} from '../services/case-list-default-quick-search.service';

/** Opens a case list whose address has no query parameters with the user's default quick search. */
const caseListDefaultQuickSearchGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const caseDefinitionKey = route.paramMap.get('caseDefinitionKey');

  if (!caseDefinitionKey || route.queryParamMap.keys.length > 0) return true;

  const router = inject(Router);

  return inject(CaseListDefaultQuickSearchService)
    .getDefaultQuickSearchItem(caseDefinitionKey)
    .pipe(
      map(quickSearchItem => {
        const queryParams = Object.fromEntries(
          new URLSearchParams(quickSearchItem?.queryPath ?? '')
        );

        // A redirect without parameters would run this guard again, endlessly.
        return Object.keys(queryParams).length > 0
          ? router.createUrlTree(['/cases', caseDefinitionKey], {queryParams})
          : true;
      }),
      catchError(() => of(true))
    );
};

export {caseListDefaultQuickSearchGuard};
