/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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
import {Component, inject, Inject, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {Router} from '@angular/router';
import {
  BreadcrumbService,
  CarbonListComponent,
  CarbonPaginationSelection,
  IQuickSearchService,
  ListField,
  ListHiddenColumn,
  PageTitleService,
  Pagination,
  QUICK_SEARCH_SERVICE,
  QuickSearchStateService,
  ViewType,
} from '@valtimo/components';
import {
  AssigneeFilter,
  CaseListTab,
  ConfigService,
  DefinitionColumn,
  SearchFieldValues,
  SortState,
} from '@valtimo/shared';
import {DocumentService, Documents, DocumentSearchRequestImpl} from '@valtimo/document';
import {TeamsApiService} from '@valtimo/teams';
import {TranslateService} from '@ngx-translate/core';
import {
  BehaviorSubject,
  combineLatest,
  map,
  Observable,
  of,
  shareReplay,
  Subscription,
  switchMap,
  take,
  tap,
} from 'rxjs';
import {CASE_LIST_TABLE_TRANSLATIONS, DEFAULT_CASE_LIST_TABS} from '../../constants';
import {BulkAssign, CaseListQuickSearchParams} from '../../models';
import {
  CaseBulkAssignService,
  CaseColumnService,
  CaseExportService,
  CaseListAssigneeService,
  CaseListCaseTagService,
  CaseListOrchestrationService,
  CaseListPaginationService,
  CaseListQuickSearchService,
  CaseListSearchService,
  CaseListService,
  CaseListStatusService,
  CaseParameterService,
} from '../../services';
import {CaseListActionsComponent} from '../case-list-actions/case-list-actions.component';
import {CaseListTabsComponent} from '../case-list-tabs/case-list-tabs.component';
import {ListItem} from 'carbon-components-angular';

const ALL_CASES_ID = 'ALL_CASES';

@Component({
  standalone: false,
  templateUrl: './generic-case-list.component.html',
  styleUrls: ['./generic-case-list.component.scss'],
  providers: [
    CaseListService,
    CaseColumnService,
    CaseListAssigneeService,
    CaseParameterService,
    CaseListPaginationService,
    CaseListSearchService,
    CaseListStatusService,
    CaseListCaseTagService,
    CaseExportService,
    CaseListOrchestrationService,
    {
      provide: QUICK_SEARCH_SERVICE,
      useClass: CaseListQuickSearchService,
    },
  ],
})
export class GenericCaseListComponent implements OnInit, OnDestroy {
  @ViewChild('specificCaseList') carbonList: CarbonListComponent;
  @ViewChild(CaseListActionsComponent) listActionsComponent: CaseListActionsComponent;
  @ViewChild(CaseListTabsComponent) tabsComponent: CaseListTabsComponent;

  public readonly ALL_CASES_ID = ALL_CASES_ID;
  public readonly tableTranslations = CASE_LIST_TABLE_TRANSLATIONS;

  public pagination!: Pagination;
  public canHaveAssignee!: boolean;
  public loadingExport = false;
  public visibleCaseTabs: CaseListTab[] | null = null;

  public readonly orchestration = inject(CaseListOrchestrationService);

  public readonly showAssignModal$ = new BehaviorSubject<boolean>(false);
  public readonly showChangePageModal$ = new BehaviorSubject<boolean>(false);
  public readonly disableStartButton$ = new BehaviorSubject<boolean>(false);
  public readonly selectedCaseIds$ = new BehaviorSubject<string[]>([]);
  public readonly paginationChange$ = new BehaviorSubject<CarbonPaginationSelection | null>(null);

  // --- Case definition dropdown ---
  public readonly loadingCaseListItems$ = new BehaviorSubject<boolean>(true);
  private readonly _selectedCaseDefinitionId$ = new BehaviorSubject<string>(ALL_CASES_ID);
  public readonly selectedCaseDefinitionId$ = this._selectedCaseDefinitionId$.asObservable();

  public readonly isAllCases$: Observable<boolean> = this._selectedCaseDefinitionId$.pipe(
    map(id => id === ALL_CASES_ID)
  );

  public readonly caseListItems$: Observable<ListItem[]> = combineLatest([
    this.documentService.getAllDefinitions(),
    this._selectedCaseDefinitionId$,
    this.translateService.stream('key'),
  ]).pipe(
    map(([documentDefinitionRes, selectedId]) => [
      {
        content: this.translateService.instant('case.allCases'),
        id: ALL_CASES_ID,
        selected: selectedId === ALL_CASES_ID,
      },
      ...documentDefinitionRes.content.map(documentDefinition => ({
        id: documentDefinition.id.name,
        content: documentDefinition?.schema?.title,
        selected: documentDefinition.id.name === selectedId,
      })),
    ]),
    tap(() => this.loadingCaseListItems$.next(false))
  );

  // --- "All Cases" data pipeline ---
  private readonly _allCasesPage$ = new BehaviorSubject<number>(1);
  private readonly _allCasesSize$ = new BehaviorSubject<number>(10);
  private readonly _allCasesSort$ = new BehaviorSubject<SortState | null>(null);
  private readonly _allCasesReload$ = new BehaviorSubject<boolean>(false);
  private readonly _allCasesAssigneeFilter$ = new BehaviorSubject<AssigneeFilter>('ALL');
  public readonly allCasesAssigneeFilter$ = this._allCasesAssigneeFilter$.asObservable();

  public readonly allCasesFields$: Observable<ListField[]> = this.translateService
    .stream('fieldLabels')
    .pipe(
      map(() =>
        this.mapDefaultColumnsToListFields(
          this.configService.config?.defaultDefinitionTable || []
        )
      )
    );

  public readonly allCasesLoading$ = new BehaviorSubject<boolean>(true);

  public readonly allCasesData$: Observable<{items: any[]; pagination: Pagination}> = combineLatest([
    this._allCasesPage$,
    this._allCasesSize$,
    this._allCasesSort$,
    this._allCasesReload$,
    this._allCasesAssigneeFilter$,
  ]).pipe(
    tap(() => this.allCasesLoading$.next(true)),
    switchMap(([page, size, sort, _, assigneeFilter]) => {
      const request = new DocumentSearchRequestImpl(
        '',
        page - 1,
        size,
        undefined,
        undefined,
        undefined,
        sort,
        undefined,
        assigneeFilter !== 'ALL' ? assigneeFilter : undefined
      );
      return this.documentService.getDocuments(request).pipe(
        map((documents: Documents) => ({
          items: documents.content.map(document => {
            const {content, ...others} = document;
            return {...content, ...others};
          }),
          pagination: {
            collectionSize: documents.totalElements,
            page,
            size,
            sort,
          } as Pagination,
        }))
      );
    }),
    tap(() => this.allCasesLoading$.next(false)),
    shareReplay(1)
  );

  private _subscriptions = new Subscription();
  private _paginationSubscription!: Subscription;
  private _canHaveAssigneeSubscription!: Subscription;
  private _searchFieldsSubscription!: Subscription;

  constructor(
    private readonly assigneeService: CaseListAssigneeService,
    private readonly breadcrumbService: BreadcrumbService,
    private readonly bulkAssignService: CaseBulkAssignService,
    private readonly caseExportService: CaseExportService,
    private readonly caseListCaseTagService: CaseListCaseTagService,
    private readonly listService: CaseListService,
    private readonly pageTitleService: PageTitleService,
    private readonly paginationService: CaseListPaginationService,
    private readonly parameterService: CaseParameterService,
    private readonly quickSearchStateService: QuickSearchStateService,
    private readonly router: Router,
    private readonly searchService: CaseListSearchService,
    private readonly statusService: CaseListStatusService,
    @Inject(QUICK_SEARCH_SERVICE)
    private readonly caseListQuickSearchService: IQuickSearchService<CaseListQuickSearchParams>,
    private readonly configService: ConfigService,
    private readonly teamsApiService: TeamsApiService,
    private readonly documentService: DocumentService,
    private readonly translateService: TranslateService
  ) {}

  public ngOnInit(): void {
    this.pageTitleService.disableReset();
    this.pageTitleService.setCustomPageTitle(
      this.translateService.instant('Cases'),
      true
    );
    this.resolveVisibleCaseTabs();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
    this._paginationSubscription?.unsubscribe();
    this._canHaveAssigneeSubscription?.unsubscribe();
    this._searchFieldsSubscription?.unsubscribe();
    this.pageTitleService.enableReset();
  }

  // --- Case definition switching ---

  public setCaseDefinition(definition: {item: {id: string}}): void {
    const newId = definition.item.id;
    if (newId === this._selectedCaseDefinitionId$.getValue()) return;

    this._selectedCaseDefinitionId$.next(newId);

    if (newId !== ALL_CASES_ID) {
      this.parameterService.clearParameters();
      this.parameterService.clearSearchFieldValues();
      this.paginationService.clearPagination();
      this.assigneeService.resetAssigneeFilter();
      this.listService.setCaseDefinitionKey(newId);
      this.orchestration.setLoading();
      this.subscribeToPagination();
      this.subscribeToCanHaveAssignee();
      this.subscribeToSearchFields();
    } else {
      this._allCasesPage$.next(1);
      this._allCasesReload$.next(!this._allCasesReload$.getValue());
    }
  }

  // --- Delegated to existing case list services when a specific definition is selected ---

  public search(searchFieldValues: SearchFieldValues): void {
    this.searchService.search(searchFieldValues);
  }

  public rowClick(item: any): void {
    this._selectedCaseDefinitionId$.pipe(take(1)).subscribe(selectedId => {
      const caseDefinitionKey =
        selectedId !== ALL_CASES_ID ? selectedId : item.definitionName || item.definitionId?.name;

      if (caseDefinitionKey) {
        if (item.ctrlClick) {
          window.open(`/cases/${caseDefinitionKey}/document/${item.id}`, '_blank');
        } else {
          this.router.navigate([`/cases/${caseDefinitionKey}/document/${item.id}`]);
        }
      }
    });
  }

  public onTabChange(tab: CaseListTab): void {
    this.orchestration.setLoadingAssigneeFilter(true);
    this.orchestration.updateNoResultsMessage(false, tab);
    this.paginationService.setPage(1);
    this.assigneeService.setAssigneeFilter(tab);
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

  public onChangePageConfirm(pagination: CarbonPaginationSelection): void {
    if (pagination.size !== this.pagination.size) {
      this.paginationService.pageSizeChange(pagination.size);
      return;
    }
    this.paginationService.pageChange(pagination.page);
  }

  public showAssignModal(): void {
    this.selectedCaseIds$.next(
      this.carbonList.selectedItems.map(document => document.id)
    );
    this.showAssignModal$.next(true);
  }

  public onCloseEvent(bulkAssign: null | BulkAssign): void {
    this.showAssignModal$.next(false);
    if (!bulkAssign?.assigneeId && !bulkAssign?.assignedTeamKey) return;

    this.bulkAssignService
      .bulkAssign(bulkAssign.ids, bulkAssign.assigneeId, bulkAssign.assignedTeamKey)
      .subscribe(() => {
        this.carbonList.model.selectAll(false);
        this.forceRefresh();
      });
  }

  public startCase(): void {
    this.listActionsComponent.startCase();
  }

  public export(): void {
    this.caseExportService
      .downloadExport()
      .subscribe(data => (this.loadingExport = data.isLoading));
  }

  public forceRefresh(): void {
    this.listService.forceRefresh();
  }

  public onSelectedStatusesChange(statusKeys: string[]): void {
    this.statusService.setSelectedStatuses(statusKeys);
  }

  public onSelectedCaseTagsChange(caseTagKeys: string[]): void {
    this.caseListCaseTagService.setSelectedCaseTags(caseTagKeys);
  }

  public onStartButtonDisableEvent(disabled: boolean): void {
    this.disableStartButton$.next(disabled);
  }

  public onViewUpdateEvent(hiddenColumns: ListHiddenColumn[]): void {
    this.orchestration.saveHiddenColumns(hiddenColumns);
  }

  public onSaveSearchEvent(event: any): void {
    combineLatest([
      this.statusService.selectedCaseStatuses$,
      this.caseListCaseTagService.selectedCaseTagKeys$,
    ])
      .pipe(take(1))
      .subscribe(([statusKeys, tags]) => {
        this.quickSearchStateService.openModal({
          ...this.parameterService.getSearchParameter('casetags', tags),
          ...this.parameterService.getSearchParameter('status', statusKeys),
          ...this.parameterService.getSearchParameter('search', event),
        });
      });
  }

  public onQuickSearchEvent(queryPath: string): void {
    combineLatest([this.orchestration.caseDefinitionKey$])
      .pipe(take(1))
      .subscribe(([caseDefinitionKey]) => {
        const queryParams = Object.fromEntries(new URLSearchParams(queryPath));
        this.router.navigate(['/cases'], {
          queryParams,
          replaceUrl: true,
          queryParamsHandling: 'replace',
        });
        this.statusService.setSelectedStatuses(
          this.parameterService.getSearchObject(queryParams['status']) as string[]
        );
        this.caseListCaseTagService.setSelectedCaseTags(
          this.parameterService.getSearchObject(queryParams['casetags']) as string[]
        );
        this.parameterService.setSearchFieldValues(
          this.parameterService.getSearchObject(queryParams['search']) as SearchFieldValues
        );
      });
  }

  public onClearEvent(): void {
    this.statusService.setSelectedStatuses([]);
    this.caseListCaseTagService.setSelectedCaseTags([]);
  }

  // --- All Cases pagination ---

  public allCasesPageChange(page: number): void {
    this._allCasesPage$.next(page);
  }

  public allCasesPageSizeChange(size: number): void {
    this._allCasesSize$.next(size);
    this._allCasesPage$.next(1);
  }

  public allCasesSortChanged(newSortState: SortState): void {
    this._allCasesSort$.next(newSortState);
  }

  public allCasesTabChange(tab: CaseListTab): void {
    this._allCasesAssigneeFilter$.next(tab as AssigneeFilter);
    this._allCasesPage$.next(1);
  }

  // --- Private ---

  private subscribeToPagination(): void {
    this._paginationSubscription?.unsubscribe();
    this._paginationSubscription = this.orchestration.pagination$.subscribe(pagination => {
      this.pagination = pagination;
    });
  }

  private subscribeToCanHaveAssignee(): void {
    this._canHaveAssigneeSubscription?.unsubscribe();
    this._canHaveAssigneeSubscription = this.assigneeService.canHaveAssignee$.subscribe(
      canHaveAssignee => {
        this.canHaveAssignee = canHaveAssignee;
      }
    );
  }

  private subscribeToSearchFields(): void {
    this._searchFieldsSubscription?.unsubscribe();
    this._searchFieldsSubscription = this.orchestration.searchFields$.subscribe(() => {
      this.orchestration.setLoadingSearchFields(false);
    });
  }

  private resolveVisibleCaseTabs(): void {
    const tabs = this.configService.config?.visibleCaseListTabs || DEFAULT_CASE_LIST_TABS;

    this.teamsApiService.getCurrentUserTeams().subscribe(teams => {
      this.visibleCaseTabs =
        teams.length > 0 ? tabs : tabs.filter(tab => tab !== CaseListTab.TEAM);
    });
  }

  private mapDefaultColumnsToListFields(columns: DefinitionColumn[]): ListField[] {
    return columns.map(column => {
      const translationKey = `fieldLabels.${column.translationKey}`;
      const translation = this.translateService.instant(translationKey);
      const validTranslation = translation !== translationKey && translation;
      return {
        key: column.propertyName,
        label: validTranslation || column.translationKey,
        sortable: column.sortable,
        ...(column.viewType && {viewType: column.viewType as ViewType}),
        ...(column.default && {default: column.default}),
      };
    });
  }
}
