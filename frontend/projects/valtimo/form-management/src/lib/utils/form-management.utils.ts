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

import {combineLatest, Observable, of} from 'rxjs';
import {filter, map} from 'rxjs/operators';
import {ActivatedRoute} from '@angular/router';
import {ManagementContext} from '@valtimo/shared';
import {FormManagementParams} from '../models';

function getContextObservable(route: ActivatedRoute): Observable<ManagementContext | ''> {
  return route.data.pipe(map(data => (data && (data['context'] as ManagementContext)) || ''));
}

function getCaseManagementRouteParams(
  context: string,
  route: ActivatedRoute
): Observable<FormManagementParams | undefined> {
  if (context !== 'case') {
    return of(undefined);
  }

  const rootParams$ = route.params ? route.params : of({});
  const parentParams$ = route.parent?.params ? route.parent.params : of({});

  return combineLatest([rootParams$, parentParams$]).pipe(
    map(([rootParams, parentParams]) => {
      const caseDefinitionKey =
        rootParams['caseDefinitionKey'] || parentParams['caseDefinitionKey'];
      const caseDefinitionVersionTag =
        rootParams['caseDefinitionVersionTag'] || parentParams['caseDefinitionVersionTag'];

      if (caseDefinitionKey && caseDefinitionVersionTag) {
        return {caseDefinitionKey, caseDefinitionVersionTag};
      }

      return null;
    }),
    filter((params): params is FormManagementParams => params !== null)
  );
}

export {getContextObservable, getCaseManagementRouteParams};
