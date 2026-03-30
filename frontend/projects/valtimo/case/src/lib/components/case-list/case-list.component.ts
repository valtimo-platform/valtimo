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
import {Component, inject, Inject, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {ActivatedRoute, Params, Router} from '@angular/router';
import {
  BreadcrumbService,
  CarbonListComponent,
  CarbonPaginationSelection,
  IQuickSearchService,
  ListHiddenColumn,
  PageTitleService,
  Pagination,
  QUICK_SEARCH_SERVICE,
  QuickSearchStateService,
} from '@valtimo/components';
import {CaseListTab, SearchFieldValues, SortState} from '@valtimo/shared';
import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  filter,
  map,
  Subscription,
  take,
} from 'rxjs';
import {CASE_LIST_TABLE_TRANSLATIONS} from '../../constants';
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

@Component({
  standalone: false,
  templateUrl: './case-list.component.html',
  styleUrls: ['./case-list.component.scss'],
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
export class CaseListComponent implements OnInit, OnDestroy {
  @ViewChild(CarbonListComponent) carbonList: CarbonListComponent;
  @ViewChild(CaseListActionsComponent) listActionsComponent: CaseListActionsComponent;
  @ViewChild(CaseListTabsComponent) tabsComponent: CaseListTabsComponent;

  public pagination!: Pagination;
  public canHaveAssignee!: boolean;
  public loadingExport = false;

  public readonly orchestration = inject(CaseListOrchestrationService);

  public readonly tableTranslations = CASE_LIST_TABLE_TRANSLATIONS;

  public readonly showAssignModal$ = new BehaviorSubject<boolean>(false);
  public readonly showChangePageModal$ = new BehaviorSubject<boolean>(false);
  public readonly disableStartButton$ = new BehaviorSubject<boolean>(false);
  public readonly selectedCaseIds$ = new BehaviorSubject<string[]>([]);
  public readonly paginationChange$ = new BehaviorSubject<CarbonPaginationSelection | null>(null);

  private _previousCaseDefinitionKey!: string;
  private _caseDefinitionKeySubscription!: Subscription;
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
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly searchService: CaseListSearchService,
    private readonly statusService: CaseListStatusService,
    @Inject(QUICK_SEARCH_SERVICE)
    private readonly caseListQuickSearchService: IQuickSearchService<CaseListQuickSearchParams>
  ) {}

  public ngOnInit(): void {
    this.openCaseDefinitionKeySubscription();
    this.subscribeToPagination();
    this.subscribeToCanHaveAssignee();
    this.subscribeToSearchFields();
  }

  public ngOnDestroy(): void {
    this._caseDefinitionKeySubscription?.unsubscribe();
    this._paginationSubscription?.unsubscribe();
    this._canHaveAssigneeSubscription?.unsubscribe();
    this._searchFieldsSubscription?.unsubscribe();
    this.pageTitleService.enableReset();
  }

  // --- Search ---

  public search(searchFieldValues: SearchFieldValues): void {
    this.searchService.search(searchFieldValues);
  }

  // --- Row click ---

  public rowClick(item: any): void {
    this.listService.caseDefinitionKey$.pipe(take(1)).subscribe(caseDefinitionKey => {
      this.breadcrumbService.cacheQueryParams(
        `/cases/${caseDefinitionKey}`,
        this.route.snapshot.queryParams
      );

      if (item.ctrlClick) {
        window.open(`/cases/${caseDefinitionKey}/document/${item.id}`, '_blank');
      } else {
        this.router.navigate([`/cases/${caseDefinitionKey}/document/${item.id}`]);
      }
    });
  }

  // --- Tab change ---

  public onTabChange(tab: CaseListTab): void {
    this.orchestration.setLoadingAssigneeFilter(true);
    this.orchestration.updateNoResultsMessage(false, tab);
    this.paginationService.setPage(1);
    this.assigneeService.setAssigneeFilter(tab);
  }

  // --- Pagination ---

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

  // --- Bulk assign ---

  public showAssignModal(): void {
    this.selectedCaseIds$.next(
      this.carbonList.selectedItems.map(document => document.id)
    );
    this.showAssignModal$.next(true);
  }

  public onCloseEvent(bulkAssign: null | BulkAssign): void {
    this.showAssignModal$.next(false);
    if (!bulkAssign?.assigneeId && !bulkAssign?.assignedTeamKey) return;

    this.bulkAssignService.bulkAssign(bulkAssign.ids, bulkAssign.assigneeId, bulkAssign.assignedTeamKey).subscribe(() => {
      this.forceRefresh();
    });
  }

  // --- Actions ---

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

  // --- Filters ---

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

  // --- Quick search ---

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
    combineLatest([this.route.queryParams, this.orchestration.caseDefinitionKey$])
      .pipe(take(1))
      .subscribe(([urlParams, caseDefinitionKey]) => {
        const queryParams = {...urlParams, ...Object.fromEntries(new URLSearchParams(queryPath))};
        this.router.navigate([`/cases/${caseDefinitionKey}`], {
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

  // --- Private ---

  private openCaseDefinitionKeySubscription(): void {
    this._caseDefinitionKeySubscription = this.route.params
      .pipe(
        map((params: Params) => params?.caseDefinitionKey),
        filter(docDefName => !!docDefName),
        distinctUntilChanged()
      )
      .subscribe(caseDefinitionKey => {
        if (this._previousCaseDefinitionKey) {
          this.parameterService.clearParameters();
          this.parameterService.clearSearchFieldValues();
        }
        this._previousCaseDefinitionKey = caseDefinitionKey;
        this.paginationService.clearPagination();
        this.assigneeService.resetAssigneeFilter();
        this.listService.setCaseDefinitionKey(caseDefinitionKey);
        this.orchestration.setLoading();
      });
  }

  private subscribeToPagination(): void {
    this._paginationSubscription = this.orchestration.pagination$.subscribe(pagination => {
      this.pagination = pagination;
    });
  }

  private subscribeToCanHaveAssignee(): void {
    this._canHaveAssigneeSubscription = this.assigneeService.canHaveAssignee$.subscribe(
      canHaveAssignee => {
        this.canHaveAssignee = canHaveAssignee;
      }
    );
  }

  private subscribeToSearchFields(): void {
    this._searchFieldsSubscription = this.orchestration.searchFields$.subscribe(() => {
      this.orchestration.setLoadingSearchFields(false);
    });
  }
}
