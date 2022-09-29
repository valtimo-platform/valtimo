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

import {Component, OnInit, ViewChild} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {DefinitionColumn} from '@valtimo/config';
import {
  DocumentSearchRequest,
  DocumentSearchRequestImpl,
  DocumentService,
  SortState,
  ProcessDocumentDefinition,
  Documents,
} from '@valtimo/document';
import moment from 'moment';
import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  filter,
  map,
  Observable,
  of,
  switchMap,
  take,
  tap,
} from 'rxjs';
import {DefaultTabs} from '../dossier-detail-tab-enum';
import {DossierProcessStartModalComponent} from '../dossier-process-start-modal/dossier-process-start-modal.component';
import {DossierService} from '../dossier.service';
import {Pagination, ListField} from '@valtimo/components';
import {NGXLogger} from 'ngx-logger';

// eslint-disable-next-line no-var
declare var $;

moment.locale(localStorage.getItem('langKey') || '');

@Component({
  selector: 'valtimo-dossier-list',
  templateUrl: './dossier-list.component.html',
  styleUrls: ['./dossier-list.component.css'],
})
export class DossierListComponent implements OnInit {
  @ViewChild('processStartModal') processStart: DossierProcessStartModalComponent;

  private selectedProcessDocumentDefinition: ProcessDocumentDefinition | null = null;
  private modalListenerAdded = false;
  readonly loading$ = new BehaviorSubject<boolean>(true);

  private readonly settingPaginationForDocName$ = new BehaviorSubject<string | undefined>(
    undefined
  );

  private readonly documentDefinitionName$: Observable<string> = this.route.params.pipe(
    map(params => params.documentDefinitionName || ''),
    tap(documentDefinitionName => {
      this.resetPagination(documentDefinitionName);
    })
  );

  readonly associatedProcessDocumentDefinitions$: Observable<Array<ProcessDocumentDefinition>> =
    this.documentDefinitionName$.pipe(
      switchMap(documentDefinitionName =>
        documentDefinitionName
          ? this.documentService.findProcessDocumentDefinitions(documentDefinitionName)
          : of([])
      ),
      map(processDocumentDefinitions =>
        processDocumentDefinitions.filter(definition => definition.canInitializeDocument)
      )
    );

  readonly schema$ = this.documentDefinitionName$.pipe(
    switchMap(documentDefinitionName =>
      this.documentService.getDocumentDefinition(documentDefinitionName)
    ),
    map(documentDefinition => documentDefinition?.schema)
  );

  private readonly storedSearchRequestKey$: Observable<string> = this.documentDefinitionName$.pipe(
    map(documentDefinitionName => `list-search-${documentDefinitionName}`)
  );

  private readonly hasStoredSearchRequest$: Observable<boolean> = this.storedSearchRequestKey$.pipe(
    map(storedSearchRequestKey => localStorage.getItem(storedSearchRequestKey) !== null)
  );

  private readonly columns$: Observable<Array<DefinitionColumn>> =
    this.documentDefinitionName$.pipe(
      map(documentDefinitionName =>
        this.dossierService.getDefinitionColumns(documentDefinitionName)
      )
    );

  readonly fields$: Observable<Array<ListField>> = combineLatest([
    this.columns$,
    this.translateService.stream('key'),
  ]).pipe(
    map(([columns]) =>
      columns.map((column, index) => ({
        key: column.propertyName,
        label: this.translateService.instant(`fieldLabels.${column.translationKey}`),
        sortable: column.sortable,
        ...(column.viewType && {viewType: column.viewType}),
      }))
    )
  );

  private readonly DEFAULT_PAGINATION: Pagination = {
    collectionSize: 0,
    page: 1,
    size: 10,
    maxPaginationItemSize: 5,
    sort: undefined,
  };

  private readonly pagination$ = new BehaviorSubject<Pagination | undefined>(undefined);

  readonly paginationCopy$ = this.pagination$.pipe(
    map(pagination => pagination && JSON.parse(JSON.stringify(pagination)))
  );

  readonly sequence$ = new BehaviorSubject<number | undefined>(undefined);

  readonly globalSearchFilter$ = new BehaviorSubject<string | undefined>(undefined);

  private readonly createdBy$ = new BehaviorSubject<string | undefined>(undefined);

  private readonly documentSearchRequest$: Observable<DocumentSearchRequest> = combineLatest([
    this.pagination$,
    this.documentDefinitionName$,
    this.sequence$,
    this.createdBy$,
    this.globalSearchFilter$,
  ]).pipe(
    filter(([pagination]) => !!pagination),
    map(
      ([pagination, documentDefinitionName, sequence, createdBy, globalSearchFilter]) =>
        new DocumentSearchRequestImpl(
          documentDefinitionName,
          pagination.page - 1,
          pagination.size,
          sequence,
          createdBy,
          globalSearchFilter,
          pagination.sort
        )
    )
  );

  private readonly documentsRequest$: Observable<Documents> = this.documentSearchRequest$.pipe(
    distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
    tap(request => {
      this.storedSearchRequestKey$.pipe(take(1)).subscribe(storedSearchRequestKey => {
        this.logger.debug(`store request in local storage: ${JSON.stringify(request)}`);
        localStorage.setItem(storedSearchRequestKey, JSON.stringify(request));
      });
    }),
    switchMap(documentSearchRequest => this.documentService.getDocuments(documentSearchRequest)),
    tap(documents => {
      this.setCollectionSize(documents);
    })
  );

  readonly documentItems$ = this.documentsRequest$.pipe(
    map(documents =>
      documents.content.map(document => {
        const {content, ...others} = document;
        return {...content, ...others};
      })
    ),
    tap(() => this.loading$.next(false))
  );

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly documentService: DocumentService,
    private readonly translateService: TranslateService,
    private readonly dossierService: DossierService,
    private readonly logger: NGXLogger
  ) {}

  ngOnInit(): void {
    this.modalListenerAdded = false;
  }

  globalSearchFilterChange(searchFilter: string): void {
    this.globalSearchFilter$.next(searchFilter);
    this.pageChange(1);
  }

  sequenceChange(sequence: string): void {
    this.sequence$.next(Number(sequence));
    this.pageChange(1);
  }

  pageChange(newPage: number): void {
    this.pagination$.pipe(take(1)).subscribe(pagination => {
      if (pagination && pagination.page !== newPage) {
        this.logger.debug(`Page change: ${newPage}`);
        this.pagination$.next({...pagination, page: newPage});
      }
    });
  }

  pageSizeChange(newPageSize: number): void {
    this.pagination$.pipe(take(1)).subscribe(pagination => {
      if (pagination && pagination.size !== newPageSize) {
        const amountOfAvailablePages = Math.ceil(pagination.collectionSize / newPageSize);
        const newPage =
          amountOfAvailablePages < pagination.page ? amountOfAvailablePages : pagination.page;

        this.logger.debug(`Page size change. New Page: ${newPage} New page size: ${newPageSize}`);
        this.pagination$.next({...pagination, size: newPageSize, page: newPage});
      }
    });
  }

  sortChanged(newSortState: SortState): void {
    this.pagination$.pipe(take(1)).subscribe(pagination => {
      if (pagination && JSON.stringify(pagination.sort) !== JSON.stringify(newSortState)) {
        this.logger.debug(`Sort state change: ${JSON.stringify(newSortState)}`);
        this.pagination$.next({...pagination, sort: newSortState});
      }
    });
  }

  rowClick(document: any): void {
    this.documentDefinitionName$.pipe(take(1)).subscribe(documentDefinitionName => {
      this.router.navigate([
        `/dossiers/${documentDefinitionName}/document/${document.id}/${DefaultTabs.summary}`,
      ]);
    });
  }

  startDossier(): void {
    this.associatedProcessDocumentDefinitions$
      .pipe(take(1))
      .subscribe(associatedProcessDocumentDefinitions => {
        if (associatedProcessDocumentDefinitions.length > 1) {
          $('#startProcess').modal('show');
        } else {
          this.selectedProcessDocumentDefinition = associatedProcessDocumentDefinitions[0];
          this.showStartProcessModal();
        }
      });
  }

  selectProcess(processDocumentDefinition: ProcessDocumentDefinition): void {
    const modal = $('#startProcess');
    if (!this.modalListenerAdded) {
      modal.on('hidden.bs.modal', this.showStartProcessModal.bind(this));
      this.modalListenerAdded = true;
    }
    this.selectedProcessDocumentDefinition = processDocumentDefinition;
    modal.modal('hide');
  }

  private resetPagination(documentDefinitionName): void {
    this.settingPaginationForDocName$.pipe(take(1)).subscribe(settingPaginationForDocName => {
      if (documentDefinitionName !== settingPaginationForDocName) {
        this.pagination$.next(undefined);
        this.logger.debug('clear pagination');
        this.settingPaginationForDocName$.next(documentDefinitionName);
        this.setPagination(documentDefinitionName);
      }
    });
  }

  private setPagination(documentDefinitionName: string): void {
    combineLatest([this.hasStoredSearchRequest$, this.storedSearchRequestKey$, this.columns$])
      .pipe(take(1))
      .subscribe(([hasStoredSearchRequest, storedSearchRequestKey, columns]) => {
        const defaultPagination: Pagination = this.getDefaultPagination(columns);
        const storedPagination: Pagination = this.getStoredPagination(
          hasStoredSearchRequest,
          storedSearchRequestKey
        );

        this.logger.debug(
          `Set pagination: ${JSON.stringify(storedPagination || defaultPagination)}`
        );
        this.pagination$.next(storedPagination || defaultPagination);
      });
  }

  private getDefaultPagination(columns: Array<DefinitionColumn>): Pagination {
    const defaultSortState = this.dossierService.getInitialSortState(columns);

    return {
      ...this.DEFAULT_PAGINATION,
      sort: defaultSortState,
    };
  }

  private getStoredPagination(
    hasStoredSearchRequest: boolean,
    storedSearchRequestKey: string
  ): Pagination | undefined {
    const storedSearchRequest =
      hasStoredSearchRequest && JSON.parse(localStorage.getItem(storedSearchRequestKey));

    return (
      storedSearchRequest && {
        ...this.DEFAULT_PAGINATION,
        sort: storedSearchRequest.sort,
        page: storedSearchRequest.page + 1,
        size: storedSearchRequest.size,
      }
    );
  }

  private setCollectionSize(documents: Documents): void {
    this.pagination$.pipe(take(1)).subscribe(pagination => {
      if (pagination.collectionSize !== documents.totalElements) {
        this.pagination$.next({...pagination, collectionSize: documents.totalElements});
      }
    });
  }

  private showStartProcessModal(): void {
    if (this.selectedProcessDocumentDefinition !== null) {
      this.processStart.openModal(this.selectedProcessDocumentDefinition);
      this.selectedProcessDocumentDefinition = null;
    }
  }
}
