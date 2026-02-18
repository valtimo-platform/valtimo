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
import {ActivatedRoute} from '@angular/router';
import {
  getBuildingBlockManagementRouteParams,
  getCaseManagementRouteParams,
  ManagementContext,
} from '@valtimo/shared';
import {combineLatest, Observable, of} from 'rxjs';
import {distinctUntilChanged, map, switchMap} from 'rxjs/operators';
import {FormManagementParams} from '../models';

function getContextObservable(route: ActivatedRoute): Observable<ManagementContext | '' | null> {
  return route.data.pipe(
    map(data => (data && (data['context'] as ManagementContext)) || null),
    distinctUntilChanged()
  );
}

function getFormManagementRouteParamsAndContext(
  route: ActivatedRoute
): Observable<[ManagementContext | null, FormManagementParams]> {
  const context$ = getContextObservable(route);

  return context$.pipe(
    switchMap(context => {
      if (context === 'case') {
        return combineLatest([of(context), getCaseManagementRouteParams(route, true)]).pipe(
          map(
            ([ctx, params]) =>
              [
                ctx,
                {
                  caseDefinitionKey: params?.caseDefinitionKey,
                  caseDefinitionVersionTag: params?.caseDefinitionVersionTag,
                },
              ] as [ManagementContext, FormManagementParams]
          )
        );
      }

      if (context === 'buildingBlock') {
        return combineLatest([of(context), getBuildingBlockManagementRouteParams(route, true)]).pipe(
          map(
            ([ctx, params]) =>
              [
                ctx,
                {
                  buildingBlockDefinitionKey: params?.buildingBlockDefinitionKey,
                  buildingBlockDefinitionVersionTag: params?.buildingBlockDefinitionVersionTag,
                },
              ] as [ManagementContext, FormManagementParams]
          )
        );
      }

      const fallbackParams: FormManagementParams = {};
      return of([context, fallbackParams] as [ManagementContext | null, FormManagementParams]);
    })
  );
}

export {getContextObservable, getFormManagementRouteParamsAndContext};
