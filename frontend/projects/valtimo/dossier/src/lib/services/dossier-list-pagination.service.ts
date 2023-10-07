/*
 * Copyright 2015-2023 Ritense BV, the Netherlands.
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
import {Injectable} from '@angular/core';
import {DEFAULT_PAGINATION, Pagination, SortState} from '@valtimo/components';
import {DefinitionColumn} from '@valtimo/config';
import {Documents, SpecifiedDocuments} from '@valtimo/document';
import {NGXLogger} from 'ngx-logger';
import {BehaviorSubject, filter, map, Observable, take, tap} from 'rxjs';
import {DossierService} from '../dossier.service';
import {DossierParameterService} from './dossier-parameter.service';

@Injectable()
export class DossierListPaginationService {
  private readonly _pagination$ = new BehaviorSubject<Pagination | undefined>(undefined);

  private readonly _paginationCopy$ = this._pagination$.pipe(
    filter(pagination => !!pagination),
    map(pagination => pagination && JSON.parse(JSON.stringify(pagination))),
    tap(pagination => this.dossierParameterService.setPaginationParameters(pagination))
  );

  get pagination$(): Observable<Pagination> {
    return this._paginationCopy$;
  }

  constructor(
    private readonly logger: NGXLogger,
    private readonly dossierParameterService: DossierParameterService,
    private readonly dossierService: DossierService
  ) {}

  pageChange(newPage: number): void {
    this._pagination$
      .pipe(
        take(1),
        filter(pagination => !!pagination && pagination.page !== newPage)
      )
      .subscribe(pagination => {
        this.logger.debug(`Page change: ${newPage}`);
        this._pagination$.next({...pagination, page: newPage});
      });
  }

  pageSizeChange(newPageSize: number): void {
    this._pagination$
      .pipe(
        take(1),
        filter(pagination => !!pagination && pagination.size !== newPageSize)
      )
      .subscribe(pagination => {
        const amountOfAvailablePages = Math.ceil(pagination.collectionSize / newPageSize);
        const newPage =
          amountOfAvailablePages < pagination.page ? amountOfAvailablePages : pagination.page;

        this.logger.debug(`Page size change. New Page: ${newPage} New page size: ${newPageSize}`);
        this._pagination$.next({...pagination, size: newPageSize, page: newPage});
      });
  }

  sortChanged(newSortState: SortState): void {
    this._pagination$
      .pipe(
        take(1),
        filter(
          pagination =>
            !!pagination && JSON.stringify(pagination.sort) !== JSON.stringify(newSortState)
        )
      )
      .subscribe(pagination => {
        this.logger.debug(`Sort state change: ${JSON.stringify(newSortState)}`);
        this._pagination$.next({...pagination, sort: newSortState});
      });
  }

  setPage(newPageNumber: number): void {
    this._pagination$.pipe(take(1)).subscribe(pagination => {
      this._pagination$.next({...pagination, page: newPageNumber});
    });
  }

  setCollectionSize(documents: Documents | SpecifiedDocuments): void {
    this._pagination$
      .pipe(
        take(1),
        filter(pagination => !!pagination && pagination.collectionSize !== documents.totalElements)
      )
      .subscribe(pagination => {
        this._pagination$.next({...pagination, collectionSize: documents.totalElements});
      });
  }

  checkPage(documents: Documents | SpecifiedDocuments): void {
    this._pagination$
      .pipe(
        take(1),
        filter(pagination => !!pagination)
      )
      .subscribe(pagination => {
        const amountOfItems = documents.totalElements;
        const amountOfPages = Math.ceil(amountOfItems / pagination.size);
        const currentPage = pagination.page;

        if (!!amountOfItems && !currentPage) {
          this._pagination$.next({...pagination, page: 1});
          return;
        }

        if (currentPage > amountOfPages) {
          this._pagination$.next({...pagination, page: amountOfPages});
        }
      });
  }

  clearPagination(): void {
    this._pagination$.next(undefined);
  }

  setPagination(columns: Array<DefinitionColumn>): void {
    this.dossierParameterService.queryPaginationParams$
      .pipe(take(1))
      .subscribe(queryPaginationParams => {
        const defaultPagination: Pagination = this.getDefaultPagination(columns);
        const paginationToUse = queryPaginationParams || defaultPagination;

        this.logger.debug(`Set pagination: ${JSON.stringify(paginationToUse)}`);

        this._pagination$.next(paginationToUse);
      });
  }

  private getDefaultPagination(columns: Array<DefinitionColumn>): Pagination {
    const defaultSortState = this.dossierService.getInitialSortState(columns);

    return {
      ...DEFAULT_PAGINATION,
      sort: defaultSortState,
    };
  }
}
