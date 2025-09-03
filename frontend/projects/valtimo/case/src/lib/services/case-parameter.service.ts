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

import {Injectable, OnDestroy} from '@angular/core';
import {CaseParameters} from '../models';
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
import {AssigneeFilter, Direction, SearchFieldValues} from '@valtimo/shared';
import {Pagination} from '@valtimo/components';

@Injectable()
export class CaseParameterService implements OnDestroy {
  private readonly _caseParameters$ = new BehaviorSubject<CaseParameters>(undefined);
  private readonly _searchFieldValues$ = new BehaviorSubject<SearchFieldValues>({});

  public get caseParameters$(): Observable<CaseParameters> {
    return this._caseParameters$.asObservable();
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
        const paramsCopy = {...params} as any as CaseParameters;

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

  public get queryCaseTagsParams$(): Observable<string[] | null> {
    return this.route.queryParams.pipe(
      map(params => {
        if (params?.casetags) {
          return JSON.parse(atob(params.casetags)) as string[];
        }
        return null;
      }),
      distinctUntilChanged(
        (prevParams, currParams) => JSON.stringify(prevParams) === JSON.stringify(currParams)
      )
    );
  }

  private _caseParametersSubscription!: Subscription;

  constructor(
    private readonly router: Router,
    private readonly route: ActivatedRoute
  ) {
    this.setCaseParameters();
  }

  public ngOnDestroy(): void {
    this._caseParametersSubscription?.unsubscribe();
  }

  public setSearchFieldValues(searchFieldValues: SearchFieldValues): void {
    this._searchFieldValues$.next(searchFieldValues);
  }

  public setSearchParameters(searchParameters: SearchFieldValues): void {
    this._caseParameters$.pipe(take(1)).subscribe(caseParameters => {
      if (Object.keys(searchParameters || {}).length > 0) {
        this._caseParameters$.next({
          ...caseParameters,
          ...this.getSearchParameter('search', searchParameters),
        });
      } else {
        if (caseParameters?.search) {
          delete caseParameters.search;
        }
        this._caseParameters$.next(caseParameters);
      }
    });
  }

  public setPaginationParameters(pagination: Pagination): void {
    if (pagination) {
      this._caseParameters$.pipe(take(1)).subscribe(dossierParameters => {
        this._caseParameters$.next({
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
    this._caseParameters$.pipe(take(1)).subscribe(dossierParameters => {
      this._caseParameters$.next({
        ...dossierParameters,
        assignee: assigneeFilter.toLowerCase(),
      });
    });
  }

  public setStatusParameter(statusKeyParameters: string[]): void {
    this._caseParameters$.pipe(take(1)).subscribe(dossierParameters => {
      if ((statusKeyParameters || []).length > 0) {
        this._caseParameters$.next({
          ...dossierParameters,
          ...this.getSearchParameter('status', statusKeyParameters),
        });
      } else {
        if (dossierParameters?.status) {
          delete dossierParameters.status;
        }
        this._caseParameters$.next(dossierParameters);
      }
    });
  }

  public setCaseTagParameter(caseTagKeyParameters: string[]): void {
    this._caseParameters$.pipe(take(1)).subscribe(dossierParameters => {
      if ((caseTagKeyParameters || []).length > 0) {
        this._caseParameters$.next({
          ...dossierParameters,
          ...this.getSearchParameter('casetags', caseTagKeyParameters),
        });
      } else {
        if (dossierParameters?.casetags) {
          delete dossierParameters.casetags;
        }
        this._caseParameters$.next(dossierParameters);
      }
    });
  }

  public clearSearchFieldValues(): void {
    this._searchFieldValues$.next({});
  }

  public clearParameters(): void {
    this._caseParameters$.next(undefined);
    this.router.navigate([this.getUrlWithoutParams()], {replaceUrl: true});
  }

  public getSearchParameter(
    searchParamKey: string,
    parameters: string[] | SearchFieldValues
  ): {[key: string]: string} {
    return {[searchParamKey]: this.objectToBase64(parameters)};
  }

  public getSearchObject(searchQuery: string): object {
    return this.base64ToObject(searchQuery);
  }

  private openDossierParametersSubscription(): void {
    this._caseParametersSubscription = this.caseParameters$.subscribe(dossierParams => {
      this.router.navigate([this.getUrlWithoutParams()], {
        queryParams: dossierParams,
        replaceUrl: true,
      });
    });
  }

  private objectToBase64(jsObject: object): string {
    return btoa(JSON.stringify(jsObject));
  }

  private base64ToObject(string: string): object {
    return JSON.parse(atob(string));
  }

  private getUrlWithoutParams(): string {
    const urlTree = this.router.parseUrl(this.router.url);
    urlTree.queryParams = {};
    urlTree.fragment = null;
    return urlTree.toString();
  }

  private setCaseParameters(): void {
    combineLatest([
      this.queryPaginationParams$,
      this.querySearchParams$,
      this.queryAssigneeParam$,
      this.queryStatusParams$,
      this.queryCaseTagsParams$,
    ])
      .pipe(take(1))
      .subscribe(
        ([paginationParams, searchParams, assigneeParams, statusParams, caseTagParams]) => {
          if (paginationParams) this.setPaginationParameters(paginationParams);
          if (assigneeParams) this.setAssigneeParameter(assigneeParams);
          if (statusParams) this.setStatusParameter(statusParams);
          if (caseTagParams) this.setCaseTagParameter(caseTagParams);
          if (searchParams) {
            this.setSearchParameters(searchParams);
            this.setSearchFieldValues(searchParams);
          }

          this.openDossierParametersSubscription();
        }
      );
  }
}
