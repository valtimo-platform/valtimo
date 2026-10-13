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
import {TranslateService} from '@ngx-translate/core';
import {PermissionService} from '@valtimo/access-control';
import {PageTitleService, QUICK_SEARCH_SERVICE} from '@valtimo/components';
import {DocumentService} from '@valtimo/document';
import {of, Subject} from 'rxjs';
import {CAN_ASSIGN_CASE_PERMISSION, CASE_DETAIL_PERMISSION_RESOURCE} from '../permissions';
import {CaseColumnService} from './case-column.service';
import {CaseListAssigneeService} from './case-list-assignee.service';
import {CaseListCaseTagService} from './case-list-case-tag.service';
import {CaseListHiddenColumnsService} from './case-list-hidden-columns.service';
import {CaseListOrchestrationService} from './case-list-orchestration.service';
import {CaseListPaginationService} from './case-list-pagination.service';
import {CaseListSearchService} from './case-list-search.service';
import {CaseListStatusService} from './case-list-status.service';
import {CaseListService} from './case-list.service';
import {CaseParameterService} from './case-parameter.service';
import {silentStub} from '../testing/silent-stub';

describe('CaseListOrchestrationService', () => {
  let caseDefinitionKey$: Subject<string>;
  let permissionService: jasmine.SpyObj<PermissionService>;
  let service: CaseListOrchestrationService;

  beforeEach(() => {
    caseDefinitionKey$ = new Subject<string>();
    permissionService = jasmine.createSpyObj('PermissionService', ['requestPermission']);

    TestBed.configureTestingModule({
      providers: [
        CaseListOrchestrationService,
        {provide: CaseListAssigneeService, useValue: silentStub()},
        {provide: CaseListCaseTagService, useValue: silentStub()},
        {provide: CaseListHiddenColumnsService, useValue: silentStub()},
        {provide: CaseColumnService, useValue: silentStub()},
        {provide: DocumentService, useValue: silentStub()},
        {provide: CaseListService, useValue: silentStub({caseDefinitionKey$})},
        {provide: PageTitleService, useValue: silentStub()},
        {provide: CaseListPaginationService, useValue: silentStub()},
        {provide: CaseParameterService, useValue: silentStub()},
        {provide: PermissionService, useValue: permissionService},
        {provide: CaseListSearchService, useValue: silentStub()},
        {provide: CaseListStatusService, useValue: silentStub()},
        {provide: TranslateService, useValue: silentStub()},
        {provide: QUICK_SEARCH_SERVICE, useValue: silentStub({initParams: () => undefined})},
      ],
    });

    service = TestBed.inject(CaseListOrchestrationService);
  });

  describe('canAssignCase$', () => {
    it('asks for the assign permission on cases in the context of the case definition', () => {
      permissionService.requestPermission.and.returnValue(of(false));
      const results: boolean[] = [];

      service.canAssignCase$.subscribe(canAssign => results.push(canAssign));
      caseDefinitionKey$.next('bezwaar');

      expect(permissionService.requestPermission).toHaveBeenCalledOnceWith(
        CAN_ASSIGN_CASE_PERMISSION,
        {
          resource: CASE_DETAIL_PERMISSION_RESOURCE.jsonSchemaDocumentDefinition,
          identifier: 'bezwaar',
        }
      );
      expect(results).toEqual([false]);
    });

    it('emits true when the user may assign cases of the case definition', () => {
      permissionService.requestPermission.and.returnValue(of(true));
      const results: boolean[] = [];

      service.canAssignCase$.subscribe(canAssign => results.push(canAssign));
      caseDefinitionKey$.next('bezwaar');

      expect(results).toEqual([true]);
    });

    it('emits false without asking when there is no case definition key', () => {
      const results: boolean[] = [];

      service.canAssignCase$.subscribe(canAssign => results.push(canAssign));
      caseDefinitionKey$.next('');

      expect(permissionService.requestPermission).not.toHaveBeenCalled();
      expect(results).toEqual([false]);
    });
  });
});
