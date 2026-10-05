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

import {TestBed} from '@angular/core/testing';
import {Router} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {
  BreadcrumbService,
  CaseOpeningPreferenceService,
  PageTitleService,
  QUICK_SEARCH_SERVICE,
  QuickSearchStateService,
} from '@valtimo/components';
import {DocumentService} from '@valtimo/document';
import {ConfigService} from '@valtimo/shared';
import {TeamsApiService} from '@valtimo/teams';
import {of} from 'rxjs';
import {
  CaseBulkAssignService,
  CaseExportService,
  CaseListAssigneeService,
  CaseListCaseTagService,
  CaseListOrchestrationService,
  CaseListPaginationService,
  CaseListSearchService,
  CaseListService,
  CaseListStatusService,
  CaseParameterService,
} from '../../services';
import {GenericCaseListComponent} from './generic-case-list.component';

describe('GenericCaseListComponent', () => {
  const CASE_URL = '/cases/bezwaar/document/doc-1';
  const ROW = {id: 'doc-1', definitionName: 'bezwaar'};

  let component: GenericCaseListComponent;
  let router: jasmine.SpyObj<Router>;
  let windowOpen: jasmine.Spy;
  let calls: string[];

  beforeEach(() => {
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    windowOpen = spyOn(window, 'open');
    calls = [];
    const record =
      (name: string) =>
      (...args: unknown[]): void => {
        calls.push(`${name}(${JSON.stringify(args)})`);
      };

    TestBed.configureTestingModule({
      providers: [
        {provide: Router, useValue: router},
        {provide: BreadcrumbService, useValue: {}},
        {
          provide: DocumentService,
          useValue: {getAllDefinitions: () => of({content: []}), invalidSearchFields$: of([])},
        },
        {provide: TranslateService, useValue: {stream: () => of(null), instant: k => k}},
        {
          provide: CaseListService,
          useValue: {setCaseDefinitionKey: record('setCaseDefinitionKey')},
        },
        {
          provide: CaseListAssigneeService,
          useValue: {resetAssigneeFilter: () => {}, canHaveAssignee$: of(true)},
        },
        {provide: CaseBulkAssignService, useValue: {}},
        {provide: CaseExportService, useValue: {}},
        {
          provide: CaseListCaseTagService,
          useValue: {setSelectedCaseTags: record('setSelectedCaseTags')},
        },
        {provide: PageTitleService, useValue: {enableReset: () => {}}},
        {provide: CaseListPaginationService, useValue: {clearPagination: () => {}}},
        {
          provide: CaseParameterService,
          useValue: {clearParameters: () => {}, clearSearchFieldValues: () => {}},
        },
        {provide: QuickSearchStateService, useValue: {}},
        {provide: CaseListSearchService, useValue: {setGlobalSearchFilter: () => {}}},
        {
          provide: CaseListStatusService,
          useValue: {setSelectedStatuses: record('setSelectedStatuses')},
        },
        {provide: QUICK_SEARCH_SERVICE, useValue: {}},
        {provide: ConfigService, useValue: {config: {}}},
        {provide: TeamsApiService, useValue: {}},
        {
          provide: CaseListOrchestrationService,
          useValue: {
            setLoading: () => {},
            setLoadingSearchFields: () => {},
            pagination$: of(null),
            searchFields$: of([]),
          },
        },
      ],
    });
    TestBed.overrideComponent(GenericCaseListComponent, {set: {template: '', providers: []}});

    component = TestBed.createComponent(GenericCaseListComponent).componentInstance;
  });

  const setPreference = (openCasesInNewTab: boolean): void =>
    TestBed.inject(CaseOpeningPreferenceService).setOpenCasesInNewTab(openCasesInNewTab);

  it('opens the case in the same tab when the preference is off', () => {
    setPreference(false);

    component.rowClick({...ROW, ctrlClick: false});

    expect(router.navigate).toHaveBeenCalledOnceWith([CASE_URL]);
    expect(windowOpen).not.toHaveBeenCalled();
  });

  it('opens the case in a new tab when the preference is on', () => {
    setPreference(true);

    component.rowClick({...ROW, ctrlClick: false});

    expect(windowOpen).toHaveBeenCalledOnceWith(CASE_URL, '_blank');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('opens the case in a new tab on a ctrl/cmd or middle click, whatever the preference', () => {
    [false, true].forEach(openCasesInNewTab => {
      setPreference(openCasesInNewTab);

      component.rowClick({...ROW, ctrlClick: true});
    });

    expect(windowOpen.calls.allArgs()).toEqual([
      [CASE_URL, '_blank'],
      [CASE_URL, '_blank'],
    ]);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('resets the status and case tag filters before switching from all cases to a case definition', () => {
    component.setCaseDefinition({item: {id: 'bezwaar'}});

    expect(calls).toEqual([
      'setSelectedStatuses([[]])',
      'setSelectedCaseTags([[]])',
      'setCaseDefinitionKey(["bezwaar"])',
    ]);
  });
});
