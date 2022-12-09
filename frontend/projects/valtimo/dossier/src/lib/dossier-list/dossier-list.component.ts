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
import {
  AssigneeFilter,
  ConfigService,
  DefinitionColumn,
  DossierListTab,
  SearchField,
  SearchFieldValues,
  SearchFilter,
  SearchFilterRange,
} from '@valtimo/config';
import {
  AdvancedDocumentSearchRequest,
  AdvancedDocumentSearchRequestImpl,
  Documents,
  DocumentService,
  ProcessDocumentDefinition,
  SortState,
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
import {ListField, Pagination} from '@valtimo/components';
import {NGXLogger} from 'ngx-logger';
import {NgbNavChangeEvent} from '@ng-bootstrap/ng-bootstrap';

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

  public dossierVisibleTabs: Array<DossierListTab> | null = null;

  private selectedProcessDocumentDefinition: ProcessDocumentDefinition | null = null;
  private modalListenerAdded = false;
  private readonly settingPaginationForDocName$ = new BehaviorSubject<string | undefined>(
    undefined
  );

  readonly loading$ = new BehaviorSubject<boolean>(true);

  readonly loadingDocumentSearchFields$ = new BehaviorSubject<boolean>(true);

  readonly documentDefinitionName$: Observable<string> = this.route.params.pipe(
    map(params => params.documentDefinitionName || ''),
    tap(documentDefinitionName => {
      this.resetPagination(documentDefinitionName);
    })
  );

  readonly canHaveAssignee$: Observable<boolean> = this.documentDefinitionName$.pipe(
    switchMap(documentDefinitionName =>
      this.documentService.getCaseSettings(documentDefinitionName)
    ),
    map(caseSettings => caseSettings?.canHaveAssignee)
  );

  readonly documentSearchFields$: Observable<Array<SearchField> | null> =
    this.documentDefinitionName$.pipe(
      distinctUntilChanged(),
      tap(() => this.loadingDocumentSearchFields$.next(true)),
      switchMap(documentDefinitionName =>
        this.documentService.getDocumentSearchFields(documentDefinitionName)
      ),
      tap(() => this.loadingDocumentSearchFields$.next(false))
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

  private readonly ASSIGNEE_KEY = 'assigneeFullName';

  readonly fields$: Observable<Array<ListField>> = combineLatest([
    this.columns$,
    this.canHaveAssignee$,
    this.translateService.stream('key'),
  ]).pipe(
    map(([columns, canHaveAssignee]) => [
      ...columns
        .map(column => ({
          key: column.propertyName,
          label: this.translateService.instant(`fieldLabels.${column.translationKey}`),
          sortable: column.sortable,
          ...(column.viewType && {viewType: column.viewType}),
          ...(column.enum && {enum: column.enum}),
        }))
        // Filter out assignee column if the case type can not have an assignee
        .filter(column => {
          if (column?.key === this.ASSIGNEE_KEY && !canHaveAssignee) {
            return false;
          }
          return true;
        }),
      // If the case type can have an assignee, and the assignee column is not present in the case column definition, add an assignee column at the end
      ...(canHaveAssignee && !columns.find(column => column.propertyName === this.ASSIGNEE_KEY)
        ? [
            {
              key: this.ASSIGNEE_KEY,
              label: this.translateService.instant(`fieldLabels.${this.ASSIGNEE_KEY}`),
              sortable: true,
              viewType: 'string',
            },
          ]
        : []),
    ])
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

  private readonly documentSearchRequest$: Observable<AdvancedDocumentSearchRequest> =
    combineLatest([this.pagination$, this.documentDefinitionName$]).pipe(
      filter(([pagination]) => !!pagination),
      map(
        ([pagination, documentDefinitionName]) =>
          new AdvancedDocumentSearchRequestImpl(
            documentDefinitionName,
            pagination.page - 1,
            pagination.size,
            pagination.sort
          )
      )
    );

  private readonly searchFieldValues$ = new BehaviorSubject<SearchFieldValues>({});

  private readonly assigneeFilter$ = new BehaviorSubject<AssigneeFilter>('ALL');

  private readonly documentsRequest$: Observable<Documents> = combineLatest([
    this.documentSearchRequest$,
    this.searchFieldValues$,
    this.assigneeFilter$,
  ]).pipe(
    distinctUntilChanged(
      (
        [prevSearchRequest, prevSearchValues, prevAssigneeFilter],
        [currSearchRequest, currSearchValues, currAssigneeFilter]
      ) =>
        JSON.stringify({...prevSearchRequest, ...prevSearchValues}) + prevAssigneeFilter ===
        JSON.stringify({...currSearchRequest, ...currSearchValues}) + currAssigneeFilter
    ),
    tap(([documentSearchRequest]) => {
      this.storedSearchRequestKey$.pipe(take(1)).subscribe(storedSearchRequestKey => {
        this.logger.debug(
          `store request in local storage: ${JSON.stringify(documentSearchRequest)}`
        );
        localStorage.setItem(storedSearchRequestKey, JSON.stringify(documentSearchRequest));
      });
    }),
    switchMap(([documentSearchRequest, searchValues, assigneeFilter]) => {
      if ((Object.keys(searchValues) || []).length > 0) {
        return this.documentService.getDocumentsSearch(
          documentSearchRequest,
          'AND',
          assigneeFilter,
          this.mapSearchValuesToFilters(searchValues)
        );
      } else {
        return this.documentService.getDocumentsSearch(
          documentSearchRequest,
          'AND',
          assigneeFilter
        );
      }
    }),
    tap(documents => {
      this.setCollectionSize(documents);
      this.checkPage(documents);
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
    private readonly logger: NGXLogger,
    private configService: ConfigService
  ) {
    this.dossierVisibleTabs = this.configService.config?.visibleDossierListTabs || null;
  }

  ngOnInit(): void {
    this.modalListenerAdded = false;
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

  search(searchFieldValues: SearchFieldValues): void {
    this.searchFieldValues$.next(searchFieldValues || {});
  }

  private mapSearchValuesToFilters(
    values: SearchFieldValues
  ): Array<SearchFilter | SearchFilterRange> {
    const filters: Array<SearchFilter | SearchFilterRange> = [];

    Object.keys(values).forEach(valueKey => {
      const searchValue = values[valueKey] as any;
      if (searchValue.start) {
        filters.push({key: valueKey, rangeFrom: searchValue.start, rangeTo: searchValue.end});
      } else {
        filters.push({key: valueKey, values: [searchValue]});
      }
    });

    return filters;
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

  private checkPage(documents: Documents): void {
    this.pagination$.pipe(take(1)).subscribe(pagination => {
      const amountOfItems = documents.totalElements;
      const amountOfPages = Math.ceil(amountOfItems / pagination.size);
      const currentPage = pagination.page;

      if (currentPage > amountOfPages) {
        this.pagination$.next({...pagination, page: amountOfPages});
      }
    });
  }

  tabChange(tab: NgbNavChangeEvent<any>): void {
    this.pagination$.pipe(take(1)).subscribe(pagination => {
      this.pagination$.next({...pagination, page: 1});
    });
    this.assigneeFilter$.next(tab.nextId.toUpperCase());
  }
}
