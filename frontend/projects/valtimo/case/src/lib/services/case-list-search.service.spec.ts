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
import {DocumentService} from '@valtimo/document';
import {BehaviorSubject, firstValueFrom, of, throwError} from 'rxjs';
import {CaseListContext} from '../models';
import {CaseListSearchService} from './case-list-search.service';
import {CaseListService} from './case-list.service';
import {CaseParameterService} from './case-parameter.service';

describe('CaseListSearchService', () => {
  const context$ = new BehaviorSubject<CaseListContext | null>({type: 'group', key: 'my_group'});
  let documentService: jasmine.SpyObj<DocumentService>;
  let service: CaseListSearchService;

  const setup = () => {
    TestBed.configureTestingModule({
      providers: [
        CaseListSearchService,
        {provide: CaseListService, useValue: {context$, checkRefresh: () => {}}},
        {provide: DocumentService, useValue: documentService},
        {provide: CaseParameterService, useValue: {}},
      ],
    });
    service = TestBed.inject(CaseListSearchService);
  };

  beforeEach(() => {
    documentService = jasmine.createSpyObj('DocumentService', ['getGroupSearchFields']);
  });

  it('yields no search fields when the group is not found', async () => {
    documentService.getGroupSearchFields.and.returnValue(
      throwError(() => new HttpErrorResponse({status: 404}))
    );
    setup();

    expect(await firstValueFrom(service.documentSearchFields$)).toEqual([]);
  });

  it('yields no search fields when the group is forbidden', async () => {
    documentService.getGroupSearchFields.and.returnValue(
      throwError(() => new HttpErrorResponse({status: 403}))
    );
    setup();

    expect(await firstValueFrom(service.documentSearchFields$)).toEqual([]);
  });

  it('maps the search fields of an available group', async () => {
    documentService.getGroupSearchFields.and.returnValue(
      of([{key: 'a', title: 'A', dataType: 'text', fieldType: 'single', matchType: 'exact'}] as any)
    );
    setup();

    const fields = await firstValueFrom(service.documentSearchFields$);
    expect(fields?.map(f => f.key)).toEqual(['a']);
  });
});
