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

import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {ActivatedRoute, Router} from '@angular/router';
import {TranslateModule} from '@ngx-translate/core';
import {
  BreadcrumbService,
  PageTitleService,
  QUICK_SEARCH_SERVICE,
  QuickSearchStateService,
} from '@valtimo/components';
import {ConfigService} from '@valtimo/shared';
import {TeamsApiService} from '@valtimo/teams';
import {of} from 'rxjs';
import {
  CaseBulkAssignService,
  CaseColumnService,
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
import {CaseListComponent} from './case-list.component';
import {silentStub} from '../../testing/silent-stub';

describe('CaseListComponent', () => {
  let fixture: ComponentFixture<CaseListComponent>;

  const render = (canHaveAssignee: boolean, canAssign: boolean): void => {
    TestBed.configureTestingModule({
      declarations: [CaseListComponent],
      imports: [TranslateModule.forRoot()],
      providers: [
        {provide: ActivatedRoute, useValue: {params: of({caseDefinitionKey: 'bezwaar'})}},
        {provide: BreadcrumbService, useValue: silentStub()},
        {provide: CaseBulkAssignService, useValue: silentStub()},
        {provide: ConfigService, useValue: {config: {featureToggles: {}}}},
        {provide: PageTitleService, useValue: silentStub()},
        {provide: QuickSearchStateService, useValue: silentStub()},
        {provide: Router, useValue: silentStub()},
        {provide: TeamsApiService, useValue: silentStub({getCurrentUserTeams: () => of([])})},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });

    TestBed.overrideComponent(CaseListComponent, {
      set: {
        providers: [
          {provide: CaseListService, useValue: silentStub()},
          {provide: CaseColumnService, useValue: silentStub()},
          {
            provide: CaseListAssigneeService,
            useValue: silentStub({canHaveAssignee$: of(canHaveAssignee)}),
          },
          {provide: CaseParameterService, useValue: silentStub()},
          {provide: CaseListPaginationService, useValue: silentStub()},
          {provide: CaseListSearchService, useValue: silentStub()},
          {provide: CaseListStatusService, useValue: silentStub()},
          {provide: CaseListCaseTagService, useValue: silentStub()},
          {provide: CaseExportService, useValue: silentStub()},
          {
            provide: CaseListOrchestrationService,
            useValue: silentStub({
              canAssignCase$: of(canAssign),
              loaded$: of(true),
              noResultsMessage$: of({isSearchResult: false, title: '', description: ''}),
              pagination$: of({collectionSize: 0, page: 1, size: 10}),
            }),
          },
          {provide: QUICK_SEARCH_SERVICE, useValue: silentStub()},
        ],
      },
    });

    fixture = TestBed.createComponent(CaseListComponent);
    fixture.detectChanges();
  };

  const caseList = () => fixture.debugElement.query(By.css('valtimo-carbon-list'));
  const assignButton = () =>
    fixture.debugElement
      .queryAll(By.css('button'))
      .find(button => button.nativeElement.textContent.includes('case.bulkAssign.assign'));
  const assigneeTabs = () => fixture.debugElement.query(By.css('valtimo-case-list-tabs'));

  it('hides the row selection and the assign button when the user may not assign cases', () => {
    render(true, false);

    expect(caseList().properties['showSelectionColumn']).toBeFalse();
    expect(assignButton()).toBeUndefined();
  });

  it('shows the row selection and the assign button when the user may assign cases', () => {
    render(true, true);

    expect(caseList().properties['showSelectionColumn']).toBeTrue();
    expect(assignButton()).toBeDefined();
  });

  it('keeps the assignee tabs for a user who may not assign cases', () => {
    render(true, false);

    expect(assigneeTabs()).not.toBeNull();
  });
});
