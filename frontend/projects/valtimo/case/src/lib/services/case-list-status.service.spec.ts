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
import {TestBed} from '@angular/core/testing';
import {CaseStatusService} from '@valtimo/document';
import {BehaviorSubject, firstValueFrom, of, throwError} from 'rxjs';
import {CASE_WITHOUT_STATUS_STATUS} from '../constants';
import {CaseListContext} from '../models';
import {CaseListStatusService} from './case-list-status.service';
import {CaseListService} from './case-list.service';
import {CaseParameterService} from './case-parameter.service';

describe('CaseListStatusService', () => {
  const context$ = new BehaviorSubject<CaseListContext | null>({type: 'group', key: 'my_group'});
  let caseStatusService: jasmine.SpyObj<CaseStatusService>;
  let service: CaseListStatusService;

  beforeEach(() => {
    caseStatusService = jasmine.createSpyObj('CaseStatusService', ['getGroupInternalCaseStatuses']);
    TestBed.configureTestingModule({
      providers: [
        CaseListStatusService,
        {provide: CaseListService, useValue: {context$}},
        {provide: CaseStatusService, useValue: caseStatusService},
        {
          provide: CaseParameterService,
          useValue: {queryStatusParams$: of(null), setStatusParameter: () => {}},
        },
      ],
    });
    service = TestBed.inject(CaseListStatusService);
  });

  it('yields only the without-status entry when the group is not found', async () => {
    caseStatusService.getGroupInternalCaseStatuses.and.returnValue(
      throwError(() => new HttpErrorResponse({status: 404}))
    );

    expect(await firstValueFrom(service.caseStatuses$)).toEqual([CASE_WITHOUT_STATUS_STATUS]);
  });
});
