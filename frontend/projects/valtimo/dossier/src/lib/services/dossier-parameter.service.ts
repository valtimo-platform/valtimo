/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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
  map,
  Observable,
  Subscription,
  take,
} from 'rxjs';
import {ActivatedRoute, Router} from '@angular/router';
import {AssigneeFilter, Direction, SearchFieldValues} from '@valtimo/config';
import {Pagination} from '@valtimo/components';

@Injectable()
export class DossierParameterService implements OnDestroy {
  private readonly _dossierParameters$ = new BehaviorSubject<DossierParameters>(undefined);
  private readonly _searchFieldValues$ = new BehaviorSubject<SearchFieldValues>({});

  public get dossierParameters$(): Observable<DossierParameters> {
    return this._dossierParameters$.asObservable();
  }

  public get searchFieldValues$(): Observable<SearchFieldValues> {
    return this._searchFieldValues$.asObservable();
  }

  public get querySearchParams$(): Observable<SearchFieldValues> {
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

  public get queryPaginationParams$(): Observable<Pagination | null> {
    return this.route.queryParams.pipe(
      map(params => {
        const paramsCopy = {...params} as any as DossierParameters;

        return paramsCopy.collectionSize
          ? {
              collectionSize: Number(paramsCopy.collectionSize),
              page: Number(paramsCopy.page),
              size: Number(paramsCopy.size),
              ...(paramsCopy.isSorting === 'true' && {
                sort: {
                  isSorting: !!(paramsCopy.isSorting === 'true'),
                  state: {
                    name: paramsCopy.sortStateName,
                    direction: paramsCopy.sortStateDirection as Direction,
                  },
                },
              }),
            }
          : null;
      }),
      distinctUntilChanged(
        (prevParams, currParams) => JSON.stringify(prevParams) === JSON.stringify(currParams)
      )
    );
  }

  public get queryAssigneeParam$(): Observable<AssigneeFilter> {
    return this.route.queryParams.pipe(
      map(params => {
        if (params?.assignee) {
          return params?.assignee?.toUpperCase();
        }
        return '';
      }),
      distinctUntilChanged((prevParams, currParams) => prevParams === currParams)
    );
  }

  public get queryStatusParams$(): Observable<string[] | null> {
    return this.route.queryParams.pipe(
      map(params => {
        if (params?.status) {
          return JSON.parse(atob(params.status)) as string[];
        }
        return null;
      }),
      distinctUntilChanged(
        (prevParams, currParams) => JSON.stringify(prevParams) === JSON.stringify(currParams)
      )
    );
  }

  private _dossierParametersSubscription!: Subscription;

  constructor(
    private readonly router: Router,
    private readonly route: ActivatedRoute
  ) {
    this.setDossierParameters();
  }

  public ngOnDestroy(): void {
    this._dossierParametersSubscription?.unsubscribe();
  }

  public setSearchFieldValues(searchFieldValues: SearchFieldValues): void {
    this._searchFieldValues$.next(searchFieldValues);
  }

  public setSearchParameters(searchParameters: SearchFieldValues): void {
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

  public setPaginationParameters(pagination: Pagination): void {
    if (pagination) {
      this._dossierParameters$.pipe(take(1)).subscribe(dossierParameters => {
        this._dossierParameters$.next({
          ...dossierParameters,
          size: `${pagination.size}`,
          collectionSize: `${pagination.collectionSize}`,
          page: `${pagination.page}`,
          isSorting: pagination.sort?.isSorting ? 'true' : 'false',
          ...(pagination.sort?.state?.name && {sortStateName: `${pagination.sort?.state.name}`}),
          ...(pagination.sort?.state?.direction && {
            sortStateDirection: `${pagination.sort?.state.direction}`,
          }),
        });
      });
    }
  }

  public setAssigneeParameter(assigneeFilter: AssigneeFilter): void {
    this._dossierParameters$.pipe(take(1)).subscribe(dossierParameters => {
      this._dossierParameters$.next({
        ...dossierParameters,
        assignee: assigneeFilter.toLowerCase(),
      });
    });
  }

  public setStatusParameter(statusKeyParameters: string[]): void {
    this._dossierParameters$.pipe(take(1)).subscribe(dossierParameters => {
      if ((statusKeyParameters || []).length > 0) {
        this._dossierParameters$.next({
          ...dossierParameters,
          status: this.objectToBase64(statusKeyParameters),
        });
      } else {
        if (dossierParameters?.status) {
          delete dossierParameters.status;
        }
        this._dossierParameters$.next(dossierParameters);
      }
    });
  }

  public clearSearchFieldValues(): void {
    this._searchFieldValues$.next({});
  }

  public clearParameters(): void {
    this._dossierParameters$.next(undefined);
    this.router.navigate([this.getUrlWithoutParams()]);
  }

  private openDossierParametersSubscription(): void {
    this._dossierParametersSubscription = this.dossierParameters$.subscribe(dossierParams => {
      this.router.navigate([this.getUrlWithoutParams()], {queryParams: dossierParams});
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

  private setDossierParameters(): void {
    combineLatest([
      this.queryPaginationParams$,
      this.querySearchParams$,
      this.queryAssigneeParam$,
      this.queryStatusParams$,
    ])
      .pipe(take(1))
      .subscribe(([paginationParams, searchParams, assigneeParams, statusParams]) => {
        if (paginationParams) this.setPaginationParameters(paginationParams);
        if (assigneeParams) this.setAssigneeParameter(assigneeParams);
        if (statusParams) this.setStatusParameter(statusParams);
        if (searchParams) {
          this.setSearchParameters(searchParams);
          this.setSearchFieldValues(searchParams);
        }

        this.openDossierParametersSubscription();
      });
  }
}
