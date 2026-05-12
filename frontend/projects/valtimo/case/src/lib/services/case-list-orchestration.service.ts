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

import {DestroyRef, Inject, Injectable} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {TranslateService} from '@ngx-translate/core';
import {PermissionService} from '@valtimo/access-control';
import {
  CarbonListNoResultsMessage,
  CASES_WITHOUT_STATUS_KEY,
  IQuickSearchService,
  ListField,
  ListHiddenColumn,
  PageTitleService,
  Pagination,
  QUICK_SEARCH_SERVICE,
  ViewType,
} from '@valtimo/components';
import {
  AdvancedDocumentSearchRequest,
  AdvancedDocumentSearchRequestImpl,
  CaseTag,
  CaseTagsUtils,
  Documents,
  DocumentService,
  InternalCaseStatus,
  InternalCaseStatusUtils,
  SpecifiedDocuments,
} from '@valtimo/document';
import {
  AssigneeFilter,
  CaseListTab,
  DefinitionColumn,
  SearchField,
  SearchFieldValues,
} from '@valtimo/shared';
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
  switchMap,
  take,
  tap,
} from 'rxjs';
import {CASE_LIST_NO_RESULTS_MESSAGE} from '../constants';
import {CaseListQuickSearchParams} from '../models';
import {
  CAN_CREATE_CASE_PERMISSION,
  CAN_EXPORT_CASE_PERMISSION,
  CAN_VIEW_CASE_PERMISSION,
  CASE_DETAIL_PERMISSION_RESOURCE,
} from '../permissions';
import {CaseColumnService} from './case-column.service';
import {CaseListAssigneeService} from './case-list-assignee.service';
import {CaseListCaseTagService} from './case-list-case-tag.service';
import {CaseListHiddenColumnsService} from './case-list-hidden-columns.service';
import {CaseListPaginationService} from './case-list-pagination.service';
import {CaseListSearchService} from './case-list-search.service';
import {CaseListService} from './case-list.service';
import {CaseListStatusService} from './case-list-status.service';
import {CaseParameterService} from './case-parameter.service';

@Injectable()
export class CaseListOrchestrationService {
  private readonly INTERNAL_STATUS_COLUMN = 'internalStatus';
  private readonly CASE_TAGS_COLUMN = 'caseTags';

  private readonly _statusField: ListField = {
    label: 'document.status',
    key: this.INTERNAL_STATUS_COLUMN,
    viewType: ViewType.TAGS,
    sortable: true,
  };

  private readonly _internalStatusKeys$ = new BehaviorSubject<string[]>([
    this.INTERNAL_STATUS_COLUMN,
  ]);
  private readonly _caseTagsKeys$ = new BehaviorSubject<string[]>([this.CASE_TAGS_COLUMN]);
  private readonly _refreshHiddenColumns$ = new BehaviorSubject<null>(null);

  public readonly noResultsMessage$ = new BehaviorSubject<CarbonListNoResultsMessage>(
    CASE_LIST_NO_RESULTS_MESSAGE
  );
  public readonly hasApiColumnConfig$ = new BehaviorSubject<boolean>(false);
  public readonly disableExportButton$ = new BehaviorSubject<boolean>(false);

  public readonly caseDefinitionKey$: Observable<string> = this.listService.caseDefinitionKey$.pipe(
    tap((caseDefinitionKey: string) =>
      this.caseListQuickSearchService.initParams(caseDefinitionKey)
    )
  );

  public readonly searchFields$: Observable<Array<SearchField> | null> =
    this.searchService.documentSearchFields$;

  public readonly statuses$: Observable<Array<InternalCaseStatus>> =
    this.statusService.caseStatuses$;

  public readonly caseTags$: Observable<CaseTag[]> = this.caseListCaseTagService.caseTags$;

  public readonly selectedStatusKeys$ = this.statusService.selectedCaseStatuses$;
  public readonly selectedCaseTagKeys$ = this.caseListCaseTagService.selectedCaseTagKeys$;
  public readonly searchFieldValues$ = this.parameterService.searchFieldValues$;
  public readonly assigneeFilter$: Observable<AssigneeFilter> =
    this.assigneeService.assigneeFilter$;
  public readonly showStatusSelector$ = this.statusService.showStatusSelector$;
  public readonly showCaseTagsSelector$ = this.caseListCaseTagService.showCaseTagsSelector$;

  public readonly hiddenColumns$: Observable<ListField[]> = this._refreshHiddenColumns$.pipe(
    switchMap(() => this.caseDefinitionKey$),
    switchMap((caseDefinitionKey: string) =>
      caseDefinitionKey
        ? this.caseListHiddenColumnsService.getHiddenColumns(caseDefinitionKey)
        : of([])
    )
  );

  public readonly schema$ = this.listService.caseDefinitionKey$.pipe(
    filter(caseDefinitionKey => !!caseDefinitionKey),
    switchMap(caseDefinitionKey => this.documentService.getDocumentDefinition(caseDefinitionKey)),
    map(caseDefinition => caseDefinition?.schema),
    tap(schema => {
      if (schema?.title) {
        this.pageTitleService.setCustomPageTitle(schema?.title, true);
      }
    })
  );

  public readonly canCreateCase$: Observable<boolean> = this.caseDefinitionKey$.pipe(
    switchMap(caseDefinitionKey =>
      caseDefinitionKey
        ? this.permissionService.requestPermission(CAN_CREATE_CASE_PERMISSION, {
            resource: CASE_DETAIL_PERMISSION_RESOURCE.jsonSchemaDocumentDefinition,
            identifier: caseDefinitionKey,
          })
        : of(false)
    )
  );

  public readonly canExportCase$: Observable<boolean> = this.caseDefinitionKey$.pipe(
    switchMap(caseDefinitionKey =>
      caseDefinitionKey
        ? combineLatest([
            this.permissionService.requestPermission(CAN_EXPORT_CASE_PERMISSION, {
              resource: CASE_DETAIL_PERMISSION_RESOURCE.jsonSchemaDocumentDefinition,
              identifier: caseDefinitionKey,
            }),
            this.documentService.getCaseList(caseDefinitionKey),
          ])
        : of([false, []] as [boolean, any[]])
    ),
    switchMap(([canExportPermission, caseList]) => {
      const isExportableColumns = caseList.some(caseListitem => caseListitem.exportable);
      return of(canExportPermission && isExportableColumns);
    })
  );

  public readonly disableSaveSearch$: Observable<boolean> = combineLatest([
    this.statusService.selectedCaseStatuses$,
    this.caseListCaseTagService.selectedCaseTagKeys$,
  ]).pipe(
    map(([selectedStatuses, selectedTags]) => !selectedStatuses.length && !selectedTags.length)
  );

  private readonly _canHaveAssignee$: Observable<boolean> = this.assigneeService.canHaveAssignee$;

  private readonly _columns$: Observable<Array<DefinitionColumn>> =
    this.listService.caseDefinitionKey$.pipe(
      switchMap(caseDefinitionKey =>
        caseDefinitionKey
          ? this.columnService.getDefinitionColumns(caseDefinitionKey)
          : of({hasApiConfig: false, columns: []})
      ),
      map(res => {
        this.hasApiColumnConfig$.next(res.hasApiConfig);
        return res.columns;
      }),
      tap(columns => {
        this.listService.caseDefinitionKey$.pipe(take(1)).subscribe(_ => {
          this.paginationService.setPagination(columns);
        });
      })
    );

  // --- Loading state ---

  private readonly _loadingFields$ = new BehaviorSubject<boolean>(true);
  private readonly _loadingPagination$ = new BehaviorSubject<boolean>(true);
  private readonly _loadingSearchFields$ = new BehaviorSubject<boolean>(true);
  private readonly _loadingAssigneeFilter$ = new BehaviorSubject<boolean>(true);
  private readonly _loadingDocumentItems$ = new BehaviorSubject<boolean>(true);

  public readonly pagination$: Observable<Pagination> = this.paginationService.pagination$.pipe(
    tap(() => this._loadingPagination$.next(false))
  );

  public readonly loaded$: Observable<boolean> = combineLatest([
    this._loadingFields$,
    this._loadingPagination$,
    this._loadingSearchFields$,
    this._loadingAssigneeFilter$,
    this._loadingDocumentItems$,
  ]).pipe(map(flags => flags.every(loading => !loading)));

  // --- Column & field observables ---

  public readonly availableFields$: Observable<ListField[]> = combineLatest([
    this._canHaveAssignee$,
    this._columns$,
    this.hasApiColumnConfig$,
    this.statuses$,
    this.translateService.stream('key'),
  ]).pipe(
    map(([canHaveAssignee, columns, hasApiConfig, statuses]) => {
      this._internalStatusKeys$.next([
        ...this._internalStatusKeys$.getValue(),
        ...columns.reduce(
          (acc, curr) =>
            curr.propertyName === this.INTERNAL_STATUS_COLUMN ? [...acc, curr.translationKey] : acc,
          [] as string[]
        ),
      ]);
      this._caseTagsKeys$.next([
        ...this._caseTagsKeys$.getValue(),
        ...columns.reduce(
          (acc, curr) =>
            curr.propertyName === this.CASE_TAGS_COLUMN ? [...acc, curr.translationKey] : acc,
          []
        ),
      ]);
      const filteredAssigneeColumns = this.assigneeService.filterAssigneeColumns(
        columns,
        canHaveAssignee
      );
      const listFields = this.columnService.mapDefinitionColumnsToListFields(
        filteredAssigneeColumns,
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
    })
  );

  public readonly fields$: Observable<ListField[]> = combineLatest([
    this.availableFields$,
    this.hiddenColumns$,
  ]).pipe(
    map(([fields, hiddenColumns]) =>
      fields.filter(
        (field: ListField) =>
          !hiddenColumns.find((hiddenColumn: ListField) => hiddenColumn.key === field.key)
      )
    ),
    tap(listFields => {
      const defaultListField = listFields.find(field => field.default);
      this.parameterService.queryPaginationParams$
        .pipe(take(1))
        .subscribe(queryPaginationParams => {
          if (defaultListField && !queryPaginationParams?.sort?.isSorting) {
            const sortDirection =
              typeof defaultListField.default === 'string' ? defaultListField.default : 'DESC';
            this.paginationService.sortChanged({
              isSorting: true,
              state: {name: defaultListField.key, direction: sortDirection as any},
            });
          }
        });
    }),
    tap(() => this._loadingFields$.next(false))
  );

  // --- Document items (the main data pipeline) ---

  private readonly _documentItems$ = new BehaviorSubject<any[] | null>(null);
  public readonly documentItems$: Observable<any[] | null> = this._documentItems$.asObservable();

  private readonly _documentSearchRequest$: Observable<AdvancedDocumentSearchRequest> =
    combineLatest([this.pagination$, this.listService.caseDefinitionKey$]).pipe(
      filter(([pagination, caseDefinitionKey]) => !!pagination && !!caseDefinitionKey),
      map(([pagination, caseDefinitionKey]) => {
        const page = pagination.page - 1;
        return new AdvancedDocumentSearchRequestImpl(
          caseDefinitionKey,
          page >= 0 ? page : 0,
          pagination.size,
          pagination.sort
        );
      })
    );

  private readonly _documentItemsPipeline$ = this.listService.checkRefresh$.pipe(
    switchMap(() =>
      combineLatest([
        this._documentSearchRequest$,
        this.assigneeFilter$,
        this.searchFieldValues$,
        this.statusService.selectedCaseStatuses$,
        this.caseListCaseTagService.selectedCaseTagKeys$,
        this.listService.forceRefresh$,
        this.hasApiColumnConfig$,
        this.statusService.caseStatuses$,
        this.caseListCaseTagService.caseTags$,
      ]).pipe(debounceTime(50))
    ),
    distinctUntilChanged(this.areDocumentRequestsEqual),
    switchMap(
      ([
        documentSearchRequest,
        assigneeFilter,
        searchValues,
        selectedStatuses,
        selectedCaseTagKeys,
        _,
        hasApiColumnConfig,
        allStatuses,
      ]) =>
        this.fetchDocuments(
          documentSearchRequest,
          assigneeFilter,
          searchValues,
          selectedStatuses,
          selectedCaseTagKeys,
          hasApiColumnConfig,
          allStatuses
        )
    ),
    switchMap(res => this.checkDocumentPermissions(res)),
    map(res => this.mapDocumentsToItems(res)),
    map(res => this.mapStatusAndTagColumns(res)),
    tap(items => {
      this._documentItems$.next(items);
      this._loadingAssigneeFilter$.next(false);
      this._loadingDocumentItems$.next(false);
    })
  );

  constructor(
    private readonly assigneeService: CaseListAssigneeService,
    private readonly caseListCaseTagService: CaseListCaseTagService,
    private readonly caseListHiddenColumnsService: CaseListHiddenColumnsService,
    private readonly columnService: CaseColumnService,
    private readonly destroyRef: DestroyRef,
    private readonly documentService: DocumentService,
    private readonly listService: CaseListService,
    private readonly pageTitleService: PageTitleService,
    private readonly paginationService: CaseListPaginationService,
    private readonly parameterService: CaseParameterService,
    private readonly permissionService: PermissionService,
    private readonly searchService: CaseListSearchService,
    private readonly statusService: CaseListStatusService,
    private readonly translateService: TranslateService,
    @Inject(QUICK_SEARCH_SERVICE)
    private readonly caseListQuickSearchService: IQuickSearchService<CaseListQuickSearchParams>
  ) {
    this._documentItemsPipeline$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  public setLoading(): void {
    this._loadingFields$.next(true);
    this._loadingPagination$.next(true);
    this._loadingSearchFields$.next(true);
    this._loadingAssigneeFilter$.next(true);
    this._loadingDocumentItems$.next(true);
    this._documentItems$.next(null);
  }

  public setLoadingAssigneeFilter(loading: boolean): void {
    this._loadingAssigneeFilter$.next(loading);
  }

  public setLoadingSearchFields(loading: boolean): void {
    this._loadingSearchFields$.next(loading);
  }

  public updateNoResultsMessage(isSearchResult: boolean, activeTab: CaseListTab | null): void {
    this.noResultsMessage$.next(
      isSearchResult
        ? {
            description: 'case.noResults.search.description',
            isSearchResult,
            title: 'case.noResults.search.title',
          }
        : {
            description: `case.noResults.${activeTab ?? 'ALL'}.description`,
            isSearchResult,
            title: `case.noResults.${activeTab ?? 'ALL'}.title`,
          }
    );
  }

  public saveHiddenColumns(hiddenColumns: ListHiddenColumn[]): void {
    this.caseDefinitionKey$
      .pipe(
        take(1),
        switchMap((caseDefinitionKey: string) =>
          this.caseListHiddenColumnsService.saveHiddenColumns(caseDefinitionKey, hiddenColumns)
        )
      )
      .subscribe(() => this._refreshHiddenColumns$.next(null));
  }

  // --- Private helpers for the document items pipeline ---

  private areDocumentRequestsEqual(
    [
      prevSearchRequest,
      prevAssigneeFilter,
      prevSearchFieldValues,
      prevSelectedStatuses,
      prevCaseTagKeys,
      prevForceRefresh,
    ]: any[],
    [
      currSearchRequest,
      currAssigneeFilter,
      currSearchFieldValues,
      currSelectedStatuses,
      currCaseTagKeys,
      currForceRefresh,
    ]: any[]
  ): boolean {
    return isEqual(
      {
        ...prevSearchRequest,
        assignee: prevAssigneeFilter,
        ...prevSearchFieldValues,
        ...prevSelectedStatuses,
        ...prevCaseTagKeys,
        forceRefresh: prevForceRefresh,
      },
      {
        ...currSearchRequest,
        assignee: currAssigneeFilter,
        ...currSearchFieldValues,
        ...currSelectedStatuses,
        ...currCaseTagKeys,
        forceRefresh: currForceRefresh,
      }
    );
  }

  private fetchDocuments(
    documentSearchRequest: AdvancedDocumentSearchRequest,
    assigneeFilter: AssigneeFilter,
    searchValues: SearchFieldValues,
    selectedStatuses: string[],
    selectedCaseTagKeys: string[],
    hasApiColumnConfig: boolean,
    allStatuses: InternalCaseStatus[]
  ): Observable<{
    documents: Documents | SpecifiedDocuments;
    hasApiColumnConfig: boolean;
    isSearchResult: boolean;
    allStatuses: InternalCaseStatus[];
    assigneeFilter: AssigneeFilter;
  }> {
    const statusKeys: (string | null)[] =
      allStatuses.length === 1
        ? []
        : selectedStatuses.map((statusKey: string) =>
            statusKey === CASES_WITHOUT_STATUS_KEY ? null : statusKey
          );

    const searchFilters =
      (Object.keys(searchValues) || []).length > 0
        ? this.searchService.mapSearchValuesToFilters(searchValues)
        : undefined;

    const documentsObs = !hasApiColumnConfig
      ? this.documentService.getDocumentsSearch(
          documentSearchRequest,
          'AND',
          assigneeFilter,
          searchFilters,
          statusKeys,
          selectedCaseTagKeys
        )
      : this.documentService.getSpecifiedDocumentsSearch(
          documentSearchRequest,
          'AND',
          assigneeFilter,
          searchFilters,
          statusKeys,
          selectedCaseTagKeys
        );

    return forkJoin({
      documents: documentsObs,
      hasApiColumnConfig: of(hasApiColumnConfig),
      isSearchResult: of(!!searchFilters),
      allStatuses: of(allStatuses),
      assigneeFilter: of(assigneeFilter),
    });
  }

  private checkDocumentPermissions(res: {
    documents: Documents | SpecifiedDocuments;
    hasApiColumnConfig: boolean;
    isSearchResult: boolean;
    allStatuses: InternalCaseStatus[];
    assigneeFilter: AssigneeFilter;
  }): Observable<[typeof res, boolean[], string[], string[]]> {
    return combineLatest([
      of(res),
      forkJoin(
        res.documents.content.map(document =>
          this.permissionService
            .requestPermission(CAN_VIEW_CASE_PERMISSION, {
              resource: CASE_DETAIL_PERMISSION_RESOURCE.jsonSchemaDocument,
              identifier: document.id,
            })
            .pipe(take(1))
        )
      ).pipe(defaultIfEmpty([] as boolean[])),
      this._internalStatusKeys$,
      this._caseTagsKeys$,
    ]);
  }

  private mapDocumentsToItems([res, documentsAuthorization, statusColumnKeys, caseTagsKeys]: [
    {
      documents: Documents | SpecifiedDocuments;
      hasApiColumnConfig: boolean;
      isSearchResult: boolean;
      allStatuses: InternalCaseStatus[];
      assigneeFilter: AssigneeFilter;
    },
    boolean[],
    string[],
    string[],
  ]): {
    data: any[];
    statuses: InternalCaseStatus[];
    statusColumnKeys: string[];
    caseTagsKeys: string[];
    isSearchResult: boolean;
    assigneeFilter: AssigneeFilter;
  } {
    const documentsWithLock = {
      ...res.documents,
      content: res.documents.content.map((document, index) => ({
        ...document,
        locked: !documentsAuthorization[index],
      })),
    };

    this.paginationService.setCollectionSize(documentsWithLock);
    this.paginationService.checkPage(documentsWithLock);

    return {
      data: this.listService.mapDocuments(documentsWithLock, res.hasApiColumnConfig),
      statuses: res.allStatuses,
      statusColumnKeys,
      caseTagsKeys,
      isSearchResult: res.isSearchResult,
      assigneeFilter: res.assigneeFilter,
    };
  }

  private mapStatusAndTagColumns(res: {
    data: any[];
    statuses: InternalCaseStatus[];
    statusColumnKeys: string[];
    caseTagsKeys: string[];
    isSearchResult: boolean;
    assigneeFilter: AssigneeFilter;
  }): any[] {
    if (!Array.isArray(res.data)) return res.data;

    this.updateNoResultsMessage(res.isSearchResult, res.assigneeFilter as CaseListTab);
    this.disableExportButton$.next(res.data.length === 0);

    return res.data.map(item => {
      const mappedInternalStatusColumns = res.statusColumnKeys.reduce((acc, curr) => {
        const status = res.statuses.find(
          (s: InternalCaseStatus) => s.key === item[curr] || s.key === item.status
        );
        return !status
          ? acc
          : {
              ...acc,
              [curr]: {
                content: status.title,
                type: InternalCaseStatusUtils.getTagTypeFromInternalCaseStatusColor(status.color),
              },
            };
      }, {});

      const mappedTagColumns = res.caseTagsKeys.reduce((acc, curr) => {
        if (item[curr]) {
          return {
            ...acc,
            [curr]: item[curr].map(tag => ({
              content: tag.title,
              type: CaseTagsUtils.getTagTypeFromCaseTagColor(tag.color),
            })),
          };
        }
        return acc;
      }, {});

      return {
        ...item,
        ...mappedInternalStatusColumns,
        ...mappedTagColumns,
      };
    });
  }
}
