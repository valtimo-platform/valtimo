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
import {of, Subject, throwError} from 'rxjs';
import {CaseListContext} from '../models';
import {CaseListService} from './case-list.service';

describe('CaseListService', () => {
  let documentService: jasmine.SpyObj<any>;
  let service: CaseListService;

  const group = {key: 'my_group', title: 'My group', order: 0};

  beforeEach(() => {
    documentService = jasmine.createSpyObj('DocumentService', ['getCaseDefinitionGroup']);
    service = new CaseListService(documentService);
  });

  it('emits a definition context immediately without a group lookup', () => {
    const emitted: CaseListContext[] = [];
    service.context$.subscribe(context => emitted.push(context));

    service.setCaseDefinitionKey('house');

    expect(emitted).toEqual([{type: 'definition', key: 'house'}]);
    expect(documentService.getCaseDefinitionGroup).not.toHaveBeenCalled();
  });

  it('emits a group context only after the lookup succeeds', () => {
    const lookup$ = new Subject<any>();
    documentService.getCaseDefinitionGroup.and.returnValue(lookup$);
    const emitted: CaseListContext[] = [];
    service.context$.subscribe(context => emitted.push(context));

    service.setContext({type: 'group', key: 'my_group'});
    expect(emitted).toEqual([]);

    lookup$.next(group);
    expect(emitted).toEqual([{type: 'group', key: 'my_group'}]);
  });

  it('flags an unknown group and emits no context', () => {
    documentService.getCaseDefinitionGroup.and.returnValue(
      throwError(() => new HttpErrorResponse({status: 404}))
    );
    const emitted: CaseListContext[] = [];
    let notFound = false;
    service.context$.subscribe(context => emitted.push(context));
    service.groupNotFound$.subscribe(value => (notFound = value));

    service.setContext({type: 'group', key: 'nope'});

    expect(notFound).toBeTrue();
    expect(emitted).toEqual([]);
  });

  it('propagates other lookup errors', () => {
    documentService.getCaseDefinitionGroup.and.returnValue(
      throwError(() => new HttpErrorResponse({status: 500}))
    );
    let failed = false;
    service.context$.subscribe({error: () => (failed = true)});

    service.setContext({type: 'group', key: 'my_group'});

    expect(failed).toBeTrue();
  });

  it('looks the group up once for several subscribers', () => {
    documentService.getCaseDefinitionGroup.and.returnValue(of(group));
    service.context$.subscribe();
    service.group$.subscribe();
    service.groupNotFound$.subscribe();

    service.setContext({type: 'group', key: 'my_group'});

    expect(documentService.getCaseDefinitionGroup).toHaveBeenCalledTimes(1);
  });
});
