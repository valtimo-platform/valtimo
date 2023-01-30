/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
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

import {Injectable, OnDestroy} from '@angular/core';
import {DossierParameters} from '../models';
import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  filter,
  map,
  Observable,
  startWith,
  Subscription,
  take,
} from 'rxjs';
import {ActivatedRoute, Router} from '@angular/router';
import {Direction, SearchFieldValues} from '@valtimo/config';
import {Pagination} from '@valtimo/components';

@Injectable({
  providedIn: 'root',
})
export class DossierParameterService implements OnDestroy {
  private readonly _dossierParameters$ = new BehaviorSubject<DossierParameters>(undefined);

  get dossierParameters$(): Observable<DossierParameters> {
    return this._dossierParameters$.asObservable();
  }

  get querySearchParams$(): Observable<SearchFieldValues> {
    return this.route.queryParams.pipe(
      map(params => {
        if (params.search) {
          return JSON.parse(atob(params.search)) as SearchFieldValues;
        }
        return {};
      }),
      distinctUntilChanged(
        (prevParams, currParams) => JSON.stringify(prevParams) === JSON.stringify(currParams)
      )
    );
  }

  get queryPaginationParams$(): Observable<Pagination | null> {
    return this.route.queryParams.pipe(
      filter(params => params.collectionSize),
      map(params => {
        const paramsCopy = {...params} as any as DossierParameters;

        if (paramsCopy.search) {
          delete paramsCopy.search;
        }

        return {
          collectionSize: Number(paramsCopy.collectionSize),
          page: Number(paramsCopy.page),
          size: Number(paramsCopy.size),
          maxPaginationItemSize: Number(paramsCopy.maxPaginationItemSize),
          ...(paramsCopy.isSorting === 'true' && {
            isSorting: !!(paramsCopy.isSorting === 'true'),
            state: {
              name: paramsCopy.sortStateName,
              direction: paramsCopy.sortStateDirection as Direction,
            },
          }),
        };
      }),
      distinctUntilChanged(
        (prevParams, currParams) => JSON.stringify(prevParams) === JSON.stringify(currParams)
      ),
      startWith(null)
    );
  }

  dossierParametersSubscription!: Subscription;

  constructor(private readonly router: Router, private readonly route: ActivatedRoute) {
    this.openDossierParametersSubscription();
  }

  ngOnDestroy(): void {
    this.dossierParametersSubscription?.unsubscribe();
  }

  setSearchParameters(searchParameters: SearchFieldValues): void {
    this._dossierParameters$.pipe(take(1)).subscribe(dossierParameters => {
      if (Object.keys(searchParameters || {}).length > 0) {
        this._dossierParameters$.next({
          ...dossierParameters,
          search: this.objectToBase64(searchParameters),
        });
      } else {
        if (dossierParameters?.search) {
          delete dossierParameters.search;
        }
        this._dossierParameters$.next(dossierParameters);
      }
    });
  }

  setPaginationParameters(pagination: Pagination): void {
    if (pagination) {
      this._dossierParameters$.pipe(take(1)).subscribe(dossierParameters => {
        this._dossierParameters$.next({
          ...dossierParameters,
          size: `${pagination.size}`,
          collectionSize: `${pagination.collectionSize}`,
          page: `${pagination.page}`,
          maxPaginationItemSize: `${pagination.maxPaginationItemSize}`,
          isSorting: pagination.sort?.isSorting ? 'true' : 'false',
          ...(pagination.sort?.state?.name && {sortStateName: `${pagination.sort?.state.name}`}),
          ...(pagination.sort?.state?.direction && {
            sortStateDirection: `${pagination.sort?.state.direction}`,
          }),
        });
      });
    }
  }

  private openDossierParametersSubscription(): void {
    this.dossierParametersSubscription = combineLatest([
      this.dossierParameters$,
      this.route.queryParams,
    ]).subscribe(([dossierParams, queryParams]) => {
      let paramsToUse = {};

      if (
        Object.keys(queryParams || {}).length > 0 &&
        Object.keys(dossierParams || {}).length === 0
      ) {
        paramsToUse = queryParams;
      } else {
        paramsToUse = dossierParams;
      }

      this.router.navigate([this.getUrlWithoutParams()], {queryParams: paramsToUse});
    });
  }

  private objectToBase64(jsObject: object): string {
    return btoa(JSON.stringify(jsObject));
  }

  private getUrlWithoutParams(): string {
    const urlTree = this.router.parseUrl(this.router.url);
    urlTree.queryParams = {};
    urlTree.fragment = null;
    return urlTree.toString();
  }
}
