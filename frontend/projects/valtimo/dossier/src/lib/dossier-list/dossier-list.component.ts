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
import {Component, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {ActivatedRoute, Params, Router} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {
  BreadcrumbService,
  CarbonListComponent,
  CarbonPaginationSelection,
  CarbonListTranslations,
  ListField,
  PageTitleService,
  Pagination,
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
  SpecifiedDocuments,
} from '@valtimo/document';
import {Tab, Tabs} from 'carbon-components-angular';
import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  filter,
  map,
  Observable,
  Subscription,
  switchMap,
  take,
  tap,
} from 'rxjs';

import {DefaultTabs} from '../dossier-detail-tab-enum';
import {DossierListActionsComponent} from '../dossier-list-actions/dossier-list-actions.component';
import {
  DossierBulkAssignService,
  DossierColumnService,
  DossierListAssigneeService,
  DossierListPaginationService,
  DossierListSearchService,
  DossierListService,
  DossierParameterService,
} from '../services';
import {PermissionService} from '@valtimo/access-control';
import {CAN_CREATE_CASE_PERMISSION, DOSSIER_DETAIL_PERMISSION_RESOURCE} from '../permissions';

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
  ],
})
export class DossierListComponent implements OnInit, OnDestroy {
  @ViewChild(CarbonListComponent) carbonList: CarbonListComponent<Document>;
  @ViewChild(DossierListActionsComponent) listActionsComponent: DossierListActionsComponent;
  @ViewChild(Tabs) tabsComponent: Tabs;

  public loadingFields = true;
  public loadingPagination = true;
  public loadingSearchFields = true;
  public loadingAssigneeFilter = true;
  public loadingDocumentItems = true;
  public pagination!: Pagination;
  public canHaveAssignee!: boolean;
  public visibleDossierTabs: Array<DossierListTab> | null = null;

  public readonly defaultTabs: DossierListTab[] = [
    DossierListTab.ALL,
    DossierListTab.MINE,
    DossierListTab.OPEN,
  ];

  public readonly tableTranslations: CarbonListTranslations = {
    select: {
      single: 'dossier.select.single',
      multiple: 'dossier.select.multiple',
    },
    pagination: {
      itemsPerPage: 'dossier.pagination.itemsPerPage',
      totalItems: 'dossier.pagination.totalItems',
    },
  };

  public readonly showAssignModal$ = new BehaviorSubject<boolean>(false);
  public readonly showChangePageModal$ = new BehaviorSubject<boolean>(false);
  public readonly showChangeTabModal$ = new BehaviorSubject<boolean>(false);

  public readonly searchFields$: Observable<Array<SearchField> | null> =
    this.searchService.documentSearchFields$.pipe(
      tap(() => {
        this.loadingSearchFields = false;
      })
    );

  public readonly documentDefinitionName$ = this.listService.documentDefinitionName$;

  public readonly canCreateDocument$: Observable<boolean> = this.documentDefinitionName$.pipe(
    switchMap(documentDefinitionName =>
      this.permissionService.requestPermission(CAN_CREATE_CASE_PERMISSION, {
        resource: DOSSIER_DETAIL_PERMISSION_RESOURCE.jsonSchemaDocumentDefinition,
        identifier: documentDefinitionName,
      })
    )
  );
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

  public showSelectionColumn!: boolean;
  public readonly searchFieldValues$ = this.parameterService.searchFieldValues$;
  public readonly assigneeFilter$: Observable<AssigneeFilter> =
    this.assigneeService.assigneeFilter$;
  public readonly paginationChange$ = new BehaviorSubject<CarbonPaginationSelection | null>(null);
  public readonly tabChange$ = new BehaviorSubject<DossierListTab | null>(null);
  public readonly canHaveAssignee$: Observable<boolean> =
    this.assigneeService.canHaveAssignee$.pipe(
      tap((showSelectionColumn: boolean) => {
        this.showSelectionColumn = showSelectionColumn;
      })
    );
  private readonly _pagination$ = this.paginationService.pagination$.pipe(
    tap(pagination => {
      this.pagination = pagination;
      this.loadingPagination = false;
    })
  );
  private readonly _reload$ = new BehaviorSubject<boolean>(false);
  private readonly _hasEnvColumnConfig$: Observable<boolean> = this.listService.hasEnvColumnConfig$;
  private readonly _hasApiColumnConfig$ = new BehaviorSubject<boolean>(false);
  private readonly _canHaveAssignee$: Observable<boolean> = this.assigneeService.canHaveAssignee$;
  private readonly _searchSwitch$ = this.searchService.searchSwitch$;
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
        this.listService.documentDefinitionName$.pipe(take(1)).subscribe(documentDefinitionName => {
          this.paginationService.setPagination(documentDefinitionName, columns);
        });
      })
    );

  public readonly fields$: Observable<Array<ListField>> = combineLatest([
    this._canHaveAssignee$,
    this._columns$,
    this._hasEnvColumnConfig$,
    this.translateService.stream('key'),
  ]).pipe(
    tap(([canHaveAssignee]) => {
      this.canHaveAssignee = canHaveAssignee;
    }),
    map(([canHaveAssignee, columns, hasEnvConfig]) => {
      const filteredAssigneeColumns = this.assigneeService.filterAssigneeColumns(
        columns,
        canHaveAssignee
      );
      const listFields = this.columnService.mapDefinitionColumnsToListFields(
        filteredAssigneeColumns,
        hasEnvConfig
      );
      const fieldsToReturn = this.assigneeService.addAssigneeListField(
        columns,
        listFields,
        canHaveAssignee
      );

      return fieldsToReturn;
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

  private readonly _documentsRequest$: Observable<Documents | SpecifiedDocuments> = combineLatest([
    this._documentSearchRequest$,
    this.searchFieldValues$,
    this.assigneeFilter$,
    this._hasEnvColumnConfig$,
    this._hasApiColumnConfig$,
    this._searchSwitch$,
    this._reload$,
  ]).pipe(
    distinctUntilChanged(
      (
        [
          prevSearchRequest,
          prevSearchValues,
          prevAssigneeFilter,
          prevHasEnvColumnConfig,
          prevHasApiColumnConfig,
          prevSearchSwitch,
          prevReload,
        ],
        [
          currSearchRequest,
          currSearchValues,
          currAssigneeFilter,
          currHasEnvColumnConfig,
          currHasApiColumnConfig,
          currSearchSwitch,
          currReload,
        ]
      ) =>
        JSON.stringify({...prevSearchRequest, ...prevSearchValues}) +
          prevAssigneeFilter +
          prevSearchSwitch ===
          JSON.stringify({...currSearchRequest, ...currSearchValues}) +
            currAssigneeFilter +
            currSearchSwitch && prevReload !== currReload
    ),
    switchMap(
      ([
        documentSearchRequest,
        searchValues,
        assigneeFilter,
        hasEnvColumnConfig,
        hasApiColumnConfig,
      ]) => {
        if ((Object.keys(searchValues) || []).length > 0) {
          return hasEnvColumnConfig || !hasApiColumnConfig
            ? this.documentService.getDocumentsSearch(
                documentSearchRequest,
                'AND',
                assigneeFilter,
                this.searchService.mapSearchValuesToFilters(searchValues)
              )
            : this.documentService.getSpecifiedDocumentsSearch(
                documentSearchRequest,
                'AND',
                assigneeFilter,
                this.searchService.mapSearchValuesToFilters(searchValues)
              );
        }

        return hasEnvColumnConfig || !hasApiColumnConfig
          ? this.documentService.getDocumentsSearch(documentSearchRequest, 'AND', assigneeFilter)
          : this.documentService.getSpecifiedDocumentsSearch(
              documentSearchRequest,
              'AND',
              assigneeFilter
            );
      }
    ),
    tap(documents => {
      this.paginationService.setCollectionSize(documents);
      this.paginationService.checkPage(documents);
    })
  );

  public documentItems$ = combineLatest([
    this._documentsRequest$,
    this._hasEnvColumnConfig$,
    this._hasApiColumnConfig$,
  ]).pipe(
    map(([documents, hasEnvColumnConfig, hasApiColumnConfig]) =>
      this.listService.mapDocuments(documents, hasEnvColumnConfig, hasApiColumnConfig)
    ),
    tap(() => {
      this.loadingAssigneeFilter = false;
      this.loadingDocumentItems = false;
    })
  );

  private _previousDocumentDefinitionName!: string;
  private _documentDefinitionNameSubscription!: Subscription;
  private _previousTab: DossierListTab = null;

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
    private readonly permissionService: PermissionService
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

  public rowClick(document: any): void {
    this.listService.documentDefinitionName$.pipe(take(1)).subscribe(documentDefinitionName => {
      this.breadcrumbService.cacheQueryParams(
        `/dossiers/${documentDefinitionName}`,
        this.route.snapshot.queryParams
      );
      this.router.navigate([
        `/dossiers/${documentDefinitionName}/document/${document.id}/${DefaultTabs.summary}`,
      ]);
    });
  }

  public tabChange(tab: DossierListTab): void {
    if (!this._previousTab) {
      this._previousTab = tab;
      return;
    }

    if (this._previousTab === tab) {
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

    const prevTab: Tab = this.tabsComponent.tabs.find((tab: Tab) => tab.id === this._previousTab);
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
    this._previousTab = tab;
    this.paginationService.setPage(1);
    this.assigneeService.setAssigneeFilter(tab);
  }

  public refresh(): void {
    this.searchService.refresh();
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

    this.bulkAssignService
      .bulkAssign(assigneeId, documentIds)
      .pipe(
        tap(() => {
          this._reload$.next(false);
        }),
        take(1)
      )
      .subscribe(() => {
        this._reload$.next(false);
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
        this.setLoading();
        this.paginationService.clearPagination();
        this.assigneeService.resetAssigneeFilter();
        this.listService.setDocumentDefinitionName(documentDefinitonName);
      });
  }

  private setLoading(): void {
    this.loadingFields = true;
    this.loadingPagination = true;
    this.loadingSearchFields = true;
    this.loadingAssigneeFilter = true;
    this.loadingDocumentItems = true;
  }

  private setVisibleTabs(): void {
    this.visibleDossierTabs = this.configService.config?.visibleDossierListTabs || null;
  }
}
