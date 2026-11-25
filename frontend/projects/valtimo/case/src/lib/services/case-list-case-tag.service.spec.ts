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
import {CaseTagService} from '@valtimo/document';
import {BehaviorSubject, firstValueFrom, of, throwError} from 'rxjs';
import {CaseListContext} from '../models';
import {CaseListCaseTagService} from './case-list-case-tag.service';
import {CaseListService} from './case-list.service';
import {CaseParameterService} from './case-parameter.service';

describe('CaseListCaseTagService', () => {
  const context$ = new BehaviorSubject<CaseListContext | null>({type: 'definition', key: 'house'});
  let caseTagService: jasmine.SpyObj<CaseTagService>;
  let service: CaseListCaseTagService;

  beforeEach(() => {
    context$.next({type: 'definition', key: 'house'});
    caseTagService = jasmine.createSpyObj('CaseTagService', ['getCaseTags']);
    TestBed.configureTestingModule({
      providers: [
        CaseListCaseTagService,
        {provide: CaseListService, useValue: {context$}},
        {provide: CaseTagService, useValue: caseTagService},
        {
          provide: CaseParameterService,
          useValue: {queryCaseTagsParams$: of(null), setCaseTagParameter: () => {}},
        },
      ],
    });
    service = TestBed.inject(CaseListCaseTagService);
  });

  it('degrades to an empty list when the case tags cannot be read', async () => {
    caseTagService.getCaseTags.and.returnValue(
      throwError(() => new HttpErrorResponse({status: 500}))
    );

    expect(await firstValueFrom(service.caseTags$)).toEqual([]);
  });
});
