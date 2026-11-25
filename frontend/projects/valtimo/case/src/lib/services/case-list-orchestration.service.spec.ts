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

import {HttpErrorResponse} from '@angular/common/http';
import {fakeAsync, tick} from '@angular/core/testing';
import {CaseStatusService, CaseTagService} from '@valtimo/document';
import {BehaviorSubject, NEVER, of, throwError} from 'rxjs';
import {CaseListContext} from '../models';
import {CaseListCaseTagService} from './case-list-case-tag.service';
import {CaseListOrchestrationService} from './case-list-orchestration.service';
import {CaseListService} from './case-list.service';
import {CaseListStatusService} from './case-list-status.service';

describe('CaseListOrchestrationService', () => {
  let listService: CaseListService;
  let hiddenColumnsService: jasmine.SpyObj<any>;
  let documentService: jasmine.SpyObj<any>;
  let pinnedItemsService: jasmine.SpyObj<any>;
  let columnService: jasmine.SpyObj<any>;
  let pageTitleService: jasmine.SpyObj<any>;
  let service: CaseListOrchestrationService;

  const groupContext: CaseListContext = {type: 'group', key: 'my_group'};
  const definitionContext: CaseListContext = {type: 'definition', key: 'house'};

  beforeEach(() => {
    hiddenColumnsService = jasmine.createSpyObj('CaseListHiddenColumnsService', [
      'getHiddenColumns',
      'saveHiddenColumns',
    ]);
    hiddenColumnsService.getHiddenColumns.and.returnValue(of([]));
    hiddenColumnsService.saveHiddenColumns.and.returnValue(of([]));
    documentService = jasmine.createSpyObj('DocumentService', [
      'getCaseDefinitionGroup',
      'getDocumentDefinition',
      'getActiveCaseDefinition',
      'searchGroupCases',
    ]);
    documentService.getCaseDefinitionGroup.and.returnValue(
      of({key: 'my_group', title: 'My group', order: 0})
    );
    documentService.searchGroupCases.and.returnValue(of({content: []}));
    documentService.invalidSearchFields$ = of([]);
    listService = new CaseListService(documentService);
    pinnedItemsService = jasmine.createSpyObj('PinnedItemsService', ['refresh']);
    columnService = jasmine.createSpyObj('CaseColumnService', ['getColumnsForContext']);
    columnService.getColumnsForContext.and.returnValue(NEVER);

    pageTitleService = jasmine.createSpyObj('PageTitleService', ['setCustomPageTitle']);

    const stream = <T>(value: T) => new BehaviorSubject<T>(value);

    service = new CaseListOrchestrationService(
      {canHaveAssignee$: stream(false), assigneeFilter$: stream('ALL')} as any,
      {
        caseTags$: stream([]),
        selectedCaseTagKeys$: stream([]),
        showCaseTagsSelector$: stream(false),
      } as any,
      hiddenColumnsService,
      columnService,
      {onDestroy: () => () => {}} as any,
      documentService,
      {showToast: () => {}} as any,
      listService,
      pageTitleService,
      {pagination$: NEVER, setPagination: () => {}} as any,
      {searchFieldValues$: stream({})} as any,
      {requestPermission: () => of(true)} as any,
      pinnedItemsService,
      {documentSearchFields$: stream(null), globalSearchFilter$: stream('')} as any,
      {
        caseStatuses$: stream([]),
        selectedCaseStatuses$: stream([]),
        showStatusSelector$: stream(false),
      } as any,
      {
        stream: () => NEVER,
        instant: (key: string) => key,
        get: () => of('Dossiergroep niet beschikbaar'),
      } as any,
      {initParams: () => {}} as any
    );
  });

  it('reads the hidden columns of a group through the group context', () => {
    listService.setContext(groupContext);

    service.hiddenColumns$.subscribe();

    expect(hiddenColumnsService.getHiddenColumns).toHaveBeenCalledWith(groupContext);
  });

  it('keeps the list usable when the hidden columns of a group cannot be read', () => {
    hiddenColumnsService.getHiddenColumns.and.returnValue(
      throwError(() => new HttpErrorResponse({status: 404}))
    );
    listService.setContext(groupContext);
    let emitted: any[] | undefined;

    service.hiddenColumns$.subscribe(columns => (emitted = columns));

    expect(emitted).toEqual([]);
  });

  it('saves hidden columns of a group through the group context', () => {
    listService.setContext(groupContext);

    service.saveHiddenColumns([{columnKey: 'name'}]);

    expect(hiddenColumnsService.saveHiddenColumns).toHaveBeenCalledWith(groupContext, [
      {columnKey: 'name'},
    ]);
  });

  it('saves hidden columns of a case definition through the definition context', () => {
    listService.setContext(definitionContext);

    service.saveHiddenColumns([{columnKey: 'name'}]);

    expect(hiddenColumnsService.saveHiddenColumns).toHaveBeenCalledWith(definitionContext, [
      {columnKey: 'name'},
    ]);
  });

  it('reports an unknown group and refreshes the pinned items', () => {
    documentService.getCaseDefinitionGroup.and.returnValue(
      throwError(() => new HttpErrorResponse({status: 404}))
    );
    listService.setContext(groupContext);
    let notFound = false;
    service.groupNotFound$.subscribe(value => (notFound = value));

    service.schema$.subscribe();

    expect(notFound).toBeTrue();
    expect(pinnedItemsService.refresh).toHaveBeenCalled();
  });

  it('resolves the page title when the group is unknown', () => {
    documentService.getCaseDefinitionGroup.and.returnValue(
      throwError(() => new HttpErrorResponse({status: 404}))
    );
    listService.setContext(groupContext);

    service.schema$.subscribe();

    expect(pageTitleService.setCustomPageTitle).toHaveBeenCalledWith(
      'Dossiergroep niet beschikbaar',
      true
    );
  });

  it('does not request columns, statuses, hidden columns or search for an unknown group', () => {
    documentService.getCaseDefinitionGroup.and.returnValue(
      throwError(() => new HttpErrorResponse({status: 404}))
    );
    listService.setContext(groupContext);

    service.schema$.subscribe();
    service.fields$.subscribe();
    service.hiddenColumns$.subscribe();
    service.groupNotFound$.subscribe();

    expect(columnService.getColumnsForContext).not.toHaveBeenCalled();
    expect(hiddenColumnsService.getHiddenColumns).not.toHaveBeenCalled();
    expect(documentService.searchGroupCases).not.toHaveBeenCalled();
    expect(documentService.getCaseDefinitionGroup).toHaveBeenCalledTimes(1);
  });

  it('requests the columns and hidden columns once for a known group', () => {
    listService.setContext(groupContext);

    service.schema$.subscribe();
    service.fields$.subscribe();

    expect(columnService.getColumnsForContext).toHaveBeenCalledTimes(1);
    expect(hiddenColumnsService.getHiddenColumns).toHaveBeenCalledTimes(1);
    expect(documentService.getCaseDefinitionGroup).toHaveBeenCalledTimes(1);
  });

  const searchGroup = (sort: any): any => {
    (service as any)
      .fetchDocuments({page: 0, size: 10, sort}, groupContext, 'ALL', {}, [], [], true, [])
      .subscribe();
    return documentService.searchGroupCases.calls.mostRecent().args[2];
  };

  it('does not send a sort to the group search when not sorting', () => {
    const params = searchGroup({isSorting: false, state: {name: 'naam', direction: 'DESC'}});

    expect('sort' in params).toBeFalse();
  });

  it('does not send a sort to the group search without a sort state', () => {
    const params = searchGroup(undefined);

    expect('sort' in params).toBeFalse();
  });

  it('sends the sort to the group search when sorting', () => {
    const params = searchGroup({isSorting: true, state: {name: 'created', direction: 'ASC'}});

    expect(params.sort).toBe('created,ASC');
  });

  it('does not report other group errors as an unknown group', () => {
    documentService.getCaseDefinitionGroup.and.returnValue(
      throwError(() => new HttpErrorResponse({status: 500}))
    );
    listService.setContext(groupContext);
    let notFound = false;
    let failed = false;
    service.groupNotFound$.subscribe({next: value => (notFound = value), error: () => {}});

    service.schema$.subscribe({error: () => (failed = true)});

    expect(notFound).toBeFalse();
    expect(failed).toBeTrue();
    expect(pinnedItemsService.refresh).not.toHaveBeenCalled();
  });
});

describe('CaseListOrchestrationService document pipeline resilience', () => {
  const definitionContext: CaseListContext = {type: 'definition', key: 'house'};

  const buildService = (
    documentService: any,
    paginationService: any,
    listService: CaseListService
  ): CaseListOrchestrationService => {
    const parameterStub = {
      queryStatusParams$: of(null),
      queryCaseTagsParams$: of(null),
      searchFieldValues$: new BehaviorSubject({}),
      setStatusParameter: () => {},
      setCaseTagParameter: () => {},
    };
    const caseStatusService = jasmine.createSpyObj('CaseStatusService', [
      'getInternalCaseStatuses',
      'getGroupInternalCaseStatuses',
    ]) as jasmine.SpyObj<CaseStatusService>;
    caseStatusService.getInternalCaseStatuses.and.returnValue(
      throwError(() => new HttpErrorResponse({status: 500}))
    );
    const caseTagService = jasmine.createSpyObj('CaseTagService', [
      'getCaseTags',
    ]) as jasmine.SpyObj<CaseTagService>;
    caseTagService.getCaseTags.and.returnValue(throwError(() => new HttpErrorResponse({status: 500})));

    const statusService = new CaseListStatusService(
      listService,
      caseStatusService,
      parameterStub as any
    );
    const caseTagListService = new CaseListCaseTagService(
      listService,
      caseTagService,
      parameterStub as any
    );

    return new CaseListOrchestrationService(
      {
        canHaveAssignee$: new BehaviorSubject(false),
        assigneeFilter$: new BehaviorSubject('ALL'),
      } as any,
      caseTagListService,
      {getHiddenColumns: () => of([]), saveHiddenColumns: () => of([])} as any,
      {getColumnsForContext: () => NEVER} as any,
      {onDestroy: () => () => {}} as any,
      documentService,
      {showToast: () => {}} as any,
      listService,
      {setCustomPageTitle: () => {}} as any,
      paginationService,
      parameterStub as any,
      {requestPermission: () => of(true)} as any,
      {refresh: () => {}} as any,
      {
        documentSearchFields$: new BehaviorSubject(null),
        globalSearchFilter$: new BehaviorSubject(''),
        mapSearchValuesToFilters: () => [],
      } as any,
      statusService,
      {stream: () => NEVER, instant: (key: string) => key, get: () => of('x')} as any,
      {initParams: () => {}} as any
    );
  };

  it('recovers document items after a search error and degraded statuses and tags', fakeAsync(() => {
    const page = {
      content: [{id: 'doc-1', content: {name: 'Case A'}}],
      empty: false,
      first: true,
      last: true,
      number: 0,
      numberOfElements: 1,
      size: 10,
      sort: false,
      totalElements: 1,
      totalPages: 1,
    };
    let searchResponse: any = throwError(() => new HttpErrorResponse({status: 500}));
    const documentService = {
      getDocumentsSearch: jasmine
        .createSpy('getDocumentsSearch')
        .and.callFake(() => searchResponse),
      invalidSearchFields$: of([]),
    };
    const paginationService = {
      pagination$: new BehaviorSubject({page: 1, size: 10, collectionSize: 0}),
      setPagination: () => {},
      setCollectionSize: jasmine.createSpy('setCollectionSize'),
      checkPage: jasmine.createSpy('checkPage'),
    };
    const listService = new CaseListService(documentService as any);
    const service = buildService(documentService, paginationService, listService);

    const emissions: Array<any[] | null> = [];
    service.documentItems$.subscribe(items => emissions.push(items));

    listService.setContext(definitionContext);
    tick(50);

    expect(documentService.getDocumentsSearch).toHaveBeenCalledTimes(1);
    expect(emissions[emissions.length - 1]).toEqual([]);

    searchResponse = of(page);
    listService.forceRefresh();
    tick(50);

    expect(documentService.getDocumentsSearch).toHaveBeenCalledTimes(2);
    const latest = emissions[emissions.length - 1];
    expect(latest?.length).toBe(1);
    expect(latest?.[0]).toEqual(jasmine.objectContaining({id: 'doc-1', name: 'Case A'}));
  }));
});
