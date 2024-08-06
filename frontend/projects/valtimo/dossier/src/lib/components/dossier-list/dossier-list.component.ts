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
import {Component, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {ActivatedRoute, Params, Router} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {PermissionService} from '@valtimo/access-control';
import {
  BreadcrumbService,
  CarbonListComponent,
  CarbonListNoResultsMessage,
  CarbonPaginationSelection,
  CASES_WITHOUT_STATUS_KEY,
  ListField,
  PageTitleService,
  Pagination,
  ViewType,
} from '@valtimo/components';
import {
  AssigneeFilter,
  ConfigService,
  DefinitionColumn,
  Direction,
  DossierListTab,
  SearchField,
  SearchFieldValues,
  SortState,
} from '@valtimo/config';
import {
  AdvancedDocumentSearchRequest,
  AdvancedDocumentSearchRequestImpl,
  Document,
  Documents,
  DocumentService,
  InternalCaseStatus,
  InternalCaseStatusUtils,
  SpecifiedDocuments,
} from '@valtimo/document';
import {Tab, Tabs} from 'carbon-components-angular';
import {isEqual} from 'lodash';
import {
  BehaviorSubject,
  combineLatest,
  debounceTime,
  defaultIfEmpty,
  distinctUntilChanged,
  filter,
  forkJoin,
  map,
  Observable,
  of,
  Subscription,
  switchMap,
  take,
  tap,
} from 'rxjs';

import {
  DEFAULT_DOSSIER_LIST_TABS,
  DOSSIER_LIST_NO_RESULTS_MESSAGE,
  DOSSIER_LIST_TABLE_TRANSLATIONS,
} from '../../constants';
import {
  CAN_CREATE_CASE_PERMISSION,
  CAN_VIEW_CASE_PERMISSION,
  DOSSIER_DETAIL_PERMISSION_RESOURCE,
} from '../../permissions';
import {
  DossierBulkAssignService,
  DossierColumnService,
  DossierListAssigneeService,
  DossierListPaginationService,
  DossierListSearchService,
  DossierListService,
  DossierListStatusService,
  DossierParameterService,
} from '../../services';
import {DossierListActionsComponent} from '../dossier-list-actions/dossier-list-actions.component';

@Component({
  selector: 'valtimo-dossier-list',
  templateUrl: './dossier-list.component.html',
  styleUrls: ['./dossier-list.component.scss'],
  providers: [
    DossierListService,
    DossierColumnService,
    DossierListAssigneeService,
    DossierParameterService,
    DossierListPaginationService,
    DossierListSearchService,
    DossierListStatusService,
  ],
})
export class DossierListComponent implements OnInit, OnDestroy {
  @ViewChild(CarbonListComponent) carbonList: CarbonListComponent;
  @ViewChild(DossierListActionsComponent) listActionsComponent: DossierListActionsComponent;
  @ViewChild(Tabs) tabsComponent: Tabs;

  public activeTab: DossierListTab = null;
  public loadingFields = true;
  public loadingPagination = true;
  public loadingSearchFields = true;
  public loadingAssigneeFilter = true;
  public loadingDocumentItems = true;
  public loadingStatuses = true;
  public pagination!: Pagination;
  public canHaveAssignee!: boolean;
  public visibleDossierTabs: Array<DossierListTab> | null = null;

  public readonly defaultTabs = DEFAULT_DOSSIER_LIST_TABS;
  public readonly tableTranslations = DOSSIER_LIST_TABLE_TRANSLATIONS;

  public readonly noResultsMessage$ = new BehaviorSubject<CarbonListNoResultsMessage>(
    DOSSIER_LIST_NO_RESULTS_MESSAGE
  );
  public readonly disableStartButton$ = new BehaviorSubject<boolean>(false);
  public readonly showAssignModal$ = new BehaviorSubject<boolean>(false);
  public readonly showChangePageModal$ = new BehaviorSubject<boolean>(false);
  public readonly showChangeTabModal$ = new BehaviorSubject<boolean>(false);

  public readonly searchFields$: Observable<Array<SearchField> | null> =
    this.searchService.documentSearchFields$.pipe(tap(() => (this.loadingSearchFields = false)));

  public readonly statuses$ = this.statusService.caseStatuses$.pipe(
    tap(() => (this.loadingStatuses = false))
  );
  public readonly selectedStatuses$ = this.statusService.selectedCaseStatuses$;

  public readonly documentDefinitionName$ = this.listService.documentDefinitionName$;

  public readonly selectedDocumentIds$ = new BehaviorSubject<string[]>([]);

  public readonly schema$ = this.listService.documentDefinitionName$.pipe(
    switchMap(documentDefinitionName =>
      this.documentService.getDocumentDefinition(documentDefinitionName)
    ),
    map(documentDefinition => documentDefinition?.schema),
    tap(schema => {
      if (schema?.title) {
        this.pageTitleService.setCustomPageTitle(schema?.title, true);
      }
    })
  );
  public readonly canCreateDocument$: Observable<boolean> = this.documentDefinitionName$.pipe(
    switchMap(documentDefinitionName =>
      this.permissionService.requestPermission(CAN_CREATE_CASE_PERMISSION, {
        resource: DOSSIER_DETAIL_PERMISSION_RESOURCE.jsonSchemaDocumentDefinition,
        identifier: documentDefinitionName,
      })
    )
  );

  public readonly searchFieldValues$ = this.parameterService.searchFieldValues$;
  public readonly assigneeFilter$: Observable<AssigneeFilter> =
    this.assigneeService.assigneeFilter$.pipe(
      tap(assigneeFilter => (this.activeTab = assigneeFilter as DossierListTab))
    );
  public readonly paginationChange$ = new BehaviorSubject<CarbonPaginationSelection | null>(null);
  public readonly tabChange$ = new BehaviorSubject<DossierListTab | null>(null);
  private readonly _pagination$ = this.paginationService.pagination$.pipe(
    tap(pagination => {
      this.pagination = pagination;
      this.loadingPagination = false;
    })
  );
  private readonly _hasEnvColumnConfig$: Observable<boolean> = this.listService.hasEnvColumnConfig$;
  private readonly _hasApiColumnConfig$ = new BehaviorSubject<boolean>(false);
  private readonly _canHaveAssignee$: Observable<boolean> = this.assigneeService.canHaveAssignee$;
  private readonly _columns$: Observable<Array<DefinitionColumn>> =
    this.listService.documentDefinitionName$.pipe(
      switchMap(documentDefinitionName =>
        this.columnService.getDefinitionColumns(documentDefinitionName)
      ),
      map(res => {
        this._hasApiColumnConfig$.next(res.hasApiConfig);
        return res.columns;
      }),
      tap(columns => {
        this.listService.documentDefinitionName$.pipe(take(1)).subscribe(_ => {
          this.paginationService.setPagination(columns);
        });
      })
    );

  public readonly showStatusSelector$ = this.statusService.showStatusSelector$;

  private readonly _statusField: ListField = {
    label: 'document.status',
    key: 'internalStatus',
    viewType: ViewType.TAGS,
    sortable: true,
  };
  public readonly fields$: Observable<Array<ListField>> = combineLatest([
    this._canHaveAssignee$,
    this._columns$,
    this._hasEnvColumnConfig$,
    this._hasApiColumnConfig$,
    this.statuses$,
    this.translateService.stream('key'),
  ]).pipe(
    tap(([canHaveAssignee]) => {
      this.canHaveAssignee = canHaveAssignee;
    }),
    map(([canHaveAssignee, columns, hasEnvConfig, hasApiConfig, statuses]) => {
      const filteredAssigneeColumns = this.assigneeService.filterAssigneeColumns(
        columns,
        canHaveAssignee
      );
      const listFields = this.columnService.mapDefinitionColumnsToListFields(
        filteredAssigneeColumns,
        hasEnvConfig,
        hasApiConfig
      );
      const fieldsToReturn = this.assigneeService.addAssigneeListField(
        columns,
        listFields,
        canHaveAssignee
      );

      return statuses.some(
        (status: InternalCaseStatus) => status.key !== CASES_WITHOUT_STATUS_KEY
      ) && !hasApiConfig
        ? [...fieldsToReturn, this._statusField]
        : fieldsToReturn;
    }),
    tap(listFields => {
      const defaultListField = listFields.find(field => field.default);
      // set default sort state if no pagination query parameters for sorting are available
      this.parameterService.queryPaginationParams$
        .pipe(take(1))
        .subscribe(queryPaginationParams => {
          if (defaultListField && !queryPaginationParams?.sort?.isSorting) {
            const sortDirection =
              typeof defaultListField.default === 'string' ? defaultListField.default : 'DESC';
            this.paginationService.sortChanged({
              isSorting: true,
              state: {name: defaultListField.key, direction: sortDirection as Direction},
            });
          }
        });
    }),
    tap(() => {
      this.loadingFields = false;
    })
  );

  private readonly _documentSearchRequest$: Observable<AdvancedDocumentSearchRequest> =
    combineLatest([this._pagination$, this.listService.documentDefinitionName$]).pipe(
      filter(([pagination]) => !!pagination),
      map(([pagination, documentDefinitionName]) => {
        const page = pagination.page - 1;

        return new AdvancedDocumentSearchRequestImpl(
          documentDefinitionName,
          page >= 0 ? page : 0,
          pagination.size,
          pagination.sort
        );
      })
    );

  public readonly documentItems$: Observable<any[]> = this.listService.checkRefresh$.pipe(
    switchMap(() =>
      combineLatest([
        this._documentSearchRequest$,
        this.assigneeFilter$,
        this.searchFieldValues$,
        this.statusService.selectedCaseStatuses$,
        this.listService.forceRefresh$,
        this._hasEnvColumnConfig$,
        this._hasApiColumnConfig$,
      ]).pipe(debounceTime(50))
    ),
    distinctUntilChanged(
      (
        [
          prevSearchRequest,
          prevAssigneeFilter,
          prevSearchFieldValues,
          prevSelectedStatuses,
          prevForceRefresh,
        ],
        [
          currSearchRequest,
          currAssigneeFilter,
          currSearchFieldValues,
          currSelectedStatuses,
          currForceRefresh,
        ]
      ) =>
        isEqual(
          {
            ...prevSearchRequest,
            assignee: prevAssigneeFilter,
            ...prevSearchFieldValues,
            ...prevSelectedStatuses.map((status: InternalCaseStatus) => status.key),
            forceRefresh: prevForceRefresh,
          },
          {
            ...currSearchRequest,
            assignee: currAssigneeFilter,
            ...currSearchFieldValues,
            ...currSelectedStatuses.map((status: InternalCaseStatus) => status.key),
            forceRefresh: currForceRefresh,
          }
        )
    ),
    switchMap(
      ([
        documentSearchRequest,
        assigneeFilter,
        searchValues,
        selectedStatuses,
        _,
        hasEnvColumnConfig,
        hasApiColumnConfig,
      ]) => {
        const obsEnv: Observable<boolean> = of(hasEnvColumnConfig);
        const obsApi: Observable<boolean> = of(hasApiColumnConfig);
        const statusKeys: (string | null)[] = selectedStatuses.map((status: InternalCaseStatus) =>
          status.key === CASES_WITHOUT_STATUS_KEY ? null : status.key
        );
        if ((Object.keys(searchValues) || []).length > 0) {
          return forkJoin({
            documents:
              hasEnvColumnConfig || !hasApiColumnConfig
                ? this.documentService.getDocumentsSearch(
                    documentSearchRequest,
                    'AND',
                    assigneeFilter,
                    this.searchService.mapSearchValuesToFilters(searchValues),
                    statusKeys
                  )
                : this.documentService.getSpecifiedDocumentsSearch(
                    documentSearchRequest,
                    'AND',
                    assigneeFilter,
                    this.searchService.mapSearchValuesToFilters(searchValues),
                    statusKeys
                  ),
            hasEnvColumnConfig: obsEnv,
            hasApiColumnConfig: obsApi,
            isSearchResult: of(true),
            selectedStatuses: of(selectedStatuses),
          });
        }

        return forkJoin({
          documents:
            hasEnvColumnConfig || !hasApiColumnConfig
              ? this.documentService.getDocumentsSearch(
                  documentSearchRequest,
                  'AND',
                  assigneeFilter,
                  undefined,
                  statusKeys
                )
              : this.documentService.getSpecifiedDocumentsSearch(
                  documentSearchRequest,
                  'AND',
                  assigneeFilter,
                  undefined,
                  statusKeys
                ),
          hasEnvColumnConfig: obsEnv,
          hasApiColumnConfig: obsApi,
          isSearchResult: of(false),
          selectedStatuses: of(selectedStatuses),
        });
      }
    ),
    switchMap(res =>
      combineLatest([
        of(res),
        forkJoin(
          res.documents.content.map(document =>
            this.permissionService
              .requestPermission(CAN_VIEW_CASE_PERMISSION, {
                resource: DOSSIER_DETAIL_PERMISSION_RESOURCE.jsonSchemaDocument,
                identifier: document.id,
              })
              .pipe(take(1))
          )
        ).pipe(defaultIfEmpty([] as boolean[])),
      ])
    ),
    map(([res, documentsAuthorization]) => ({
      ...res,
      documents: {
        ...res.documents,
        content: res.documents.content.map((document, index) => ({
          ...document,
          locked: !documentsAuthorization[index],
        })),
      },
    })),
    map(
      (res: {
        documents: Documents | SpecifiedDocuments;
        hasEnvColumnConfig: boolean;
        hasApiColumnConfig: boolean;
        isSearchResult: boolean;
        selectedStatuses: InternalCaseStatus[];
      }) => {
        this.paginationService.setCollectionSize(res.documents);
        this.paginationService.checkPage(res.documents);
        this.updateNoResultsMessage(res.isSearchResult);

        return {
          data: this.listService.mapDocuments(
            res.documents,
            res.hasEnvColumnConfig,
            res.hasApiColumnConfig
          ),
          statuses: res.selectedStatuses,
        };
      }
    ),
    map(res => {
      if (!Array.isArray(res.data)) return res.data;

      return res.data.map(item => {
        const status = res.statuses.find(
          (status: InternalCaseStatus) =>
            status.key === item.internalStatus || status.key === item.status
        );
        if (!status) return item;

        return {
          ...item,
          tags: [
            {
              content: status.title,
              type: InternalCaseStatusUtils.getTagTypeFromInternalCaseStatusColor(status.color),
            },
          ],
        };
      });
    }),
    tap(() => {
      this.loadingAssigneeFilter = false;
      this.loadingDocumentItems = false;
    })
  );

  private _previousDocumentDefinitionName!: string;
  private _documentDefinitionNameSubscription!: Subscription;

  constructor(
    private readonly assigneeService: DossierListAssigneeService,
    private readonly breadcrumbService: BreadcrumbService,
    private readonly bulkAssignService: DossierBulkAssignService,
    private readonly columnService: DossierColumnService,
    private readonly configService: ConfigService,
    private readonly documentService: DocumentService,
    private readonly listService: DossierListService,
    private readonly pageTitleService: PageTitleService,
    private readonly paginationService: DossierListPaginationService,
    private readonly parameterService: DossierParameterService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly searchService: DossierListSearchService,
    private readonly translateService: TranslateService,
    private readonly permissionService: PermissionService,
    private readonly statusService: DossierListStatusService
  ) {}

  public ngOnInit(): void {
    this.setVisibleTabs();
    this.openDocumentDefinitionNameSubscription();
  }

  public ngOnDestroy(): void {
    this._documentDefinitionNameSubscription?.unsubscribe();
    this.pageTitleService.enableReset();
  }

  public trackByIndex(index: number): number {
    return index;
  }

  public search(searchFieldValues: SearchFieldValues): void {
    this.searchService.search(searchFieldValues);
  }

  public rowClick(item: any): void {
    this.listService.documentDefinitionName$.pipe(take(1)).subscribe(documentDefinitionName => {
      this.breadcrumbService.cacheQueryParams(
        `/dossiers/${documentDefinitionName}`,
        this.route.snapshot.queryParams
      );
      this.router.navigate([`/dossiers/${documentDefinitionName}/document/${item.id}`]);
    });
  }

  public tabChange(tab: DossierListTab): void {
    if (!this.activeTab) {
      this.activeTab = tab;
      this.updateNoResultsMessage(false);
      return;
    }

    if (this.activeTab.toLowerCase() === tab.toLowerCase()) {
      return;
    }

    if (this.carbonList.model.selectedRowsCount()) {
      this.showChangeTabModal$.next(true);
      this.tabChange$.next(tab);
      return;
    }

    this.onChangeTabConfirm(tab);
  }

  public onChangeTabCancel(): void {
    if (!this.tabsComponent) {
      return;
    }

    const prevTab: Tab | undefined = this.tabsComponent.tabs.find(
      (tab: Tab) => tab.id === this.activeTab
    );

    if (!prevTab) {
      return;
    }

    this.tabsComponent.tabs.find((tab: Tab) => tab.active).active = false;
    prevTab.active = true;
  }

  public pageChange(page: number): void {
    if (this.carbonList?.model.selectedRowsCount()) {
      this.showChangePageModal$.next(true);
      this.paginationChange$.next({page, size: this.pagination.size});
      return;
    }
    this.paginationService.pageChange(page);
  }

  public pageSizeChange(size: number): void {
    if (this.carbonList?.model.selectedRowsCount()) {
      this.showChangePageModal$.next(true);
      this.paginationChange$.next({page: this.pagination.page, size});
      return;
    }
    this.paginationService.pageSizeChange(size);
  }

  public sortChanged(newSortState: SortState): void {
    this.paginationService.sortChanged(newSortState);
  }

  private onChangeTabConfirm(tab: DossierListTab): void {
    this.loadingAssigneeFilter = true;
    this.activeTab = tab;
    this.updateNoResultsMessage(false);
    this.paginationService.setPage(1);
    this.assigneeService.setAssigneeFilter(tab);
  }

  public showAssignModal(): void {
    this.selectedDocumentIds$.next(
      this.carbonList.selectedItems.map((document: Document) => document.id)
    );
    this.showAssignModal$.next(true);
  }

  public onCloseEvent(assigneeId: null | string, documentIds: string[]): void {
    this.showAssignModal$.next(false);
    if (!assigneeId) {
      return;
    }

    this.bulkAssignService.bulkAssign(assigneeId, documentIds).subscribe(() => {
      this.forceRefresh();
    });
  }

  public onChangePageConfirm(pagination: CarbonPaginationSelection): void {
    if (pagination.size !== this.pagination.size) {
      this.paginationService.pageSizeChange(pagination.size);
      return;
    }

    this.paginationService.pageChange(pagination.page);
  }

  public startDossier(): void {
    this.listActionsComponent.startDossier();
  }

  public forceRefresh(): void {
    this.listService.forceRefresh();
  }

  public onSelectedStatusesChange(statuses: InternalCaseStatus[]): void {
    this.statusService.setSelectedStatuses(statuses);
  }

  public onStartButtonDisableEvent(disabled: boolean): void {
    this.disableStartButton$.next(disabled);
  }

  private openDocumentDefinitionNameSubscription(): void {
    this._documentDefinitionNameSubscription = this.route.params
      .pipe(
        map((params: Params) => params?.documentDefinitionName),
        filter(docDefName => !!docDefName),
        distinctUntilChanged()
      )
      .subscribe(documentDefinitonName => {
        if (this._previousDocumentDefinitionName) {
          this.parameterService.clearParameters();
          this.parameterService.clearSearchFieldValues();
        }
        this._previousDocumentDefinitionName = documentDefinitonName;
        this.paginationService.clearPagination();
        this.assigneeService.resetAssigneeFilter();
        this.listService.setDocumentDefinitionName(documentDefinitonName);
        this.setLoading();
      });
  }

  private setLoading(): void {
    this.loadingFields = true;
    this.loadingPagination = true;
    this.loadingSearchFields = true;
    this.loadingAssigneeFilter = true;
    this.loadingDocumentItems = true;
    this.loadingStatuses = true;
  }

  private setVisibleTabs(): void {
    this.visibleDossierTabs = this.configService.config?.visibleDossierListTabs || null;
  }

  private updateNoResultsMessage(isSearchResult: boolean): void {
    this.noResultsMessage$.next(
      isSearchResult
        ? {
            description: 'dossier.noResults.search.description',
            isSearchResult,
            title: 'dossier.noResults.search.title',
          }
        : {
            description: `dossier.noResults.${this.activeTab ?? 'ALL'}.description`,
            isSearchResult,
            title: `dossier.noResults.${this.activeTab ?? 'ALL'}.title`,
          }
    );
  }
}
