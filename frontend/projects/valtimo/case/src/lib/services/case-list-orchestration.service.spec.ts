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
import {BehaviorSubject, NEVER, of, throwError} from 'rxjs';
import {CaseListContext} from '../models';
import {CaseListOrchestrationService} from './case-list-orchestration.service';
import {CaseListService} from './case-list.service';

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
    listService = new CaseListService();
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
    documentService.searchGroupCases.and.returnValue(of({content: []}));
    documentService.invalidSearchFields$ = of([]);
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
      {stream: () => NEVER, instant: (key: string) => key} as any,
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
      'case.noResults.groupNotFound.title',
      true
    );
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
    service.groupNotFound$.subscribe(value => (notFound = value));

    service.schema$.subscribe({error: () => (failed = true)});

    expect(notFound).toBeFalse();
    expect(failed).toBeTrue();
    expect(pinnedItemsService.refresh).not.toHaveBeenCalled();
  });
});
