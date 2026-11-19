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

import {DefaultUrlSerializer} from '@angular/router';
import {of} from 'rxjs';
import {CaseParameters} from '../models';
import {CaseParameterService} from './case-parameter.service';

describe('CaseParameterService', () => {
  let service: CaseParameterService;

  beforeEach(() => {
    const serializer = new DefaultUrlSerializer();
    const router = {
      url: '/groups/my_group',
      parseUrl: (url: string) => serializer.parse(url),
      navigate: jasmine.createSpy('navigate'),
    };

    service = new CaseParameterService(router as any, {queryParams: of({})} as any);
  });

  const latestParameters = (): CaseParameters => {
    let parameters: CaseParameters;
    service.caseParameters$.subscribe(value => (parameters = value));
    return parameters;
  };

  it('does not write the sort state when not sorting', () => {
    service.setPaginationParameters({
      collectionSize: 30,
      page: 1,
      size: 10,
      sort: {isSorting: false, state: {name: 'naam', direction: 'DESC'}},
    });

    const parameters = latestParameters();

    expect(parameters.isSorting).toBe('false');
    expect(parameters.sortStateName).toBeUndefined();
    expect(parameters.sortStateDirection).toBeUndefined();
  });

  it('writes the sort state when sorting', () => {
    service.setPaginationParameters({
      collectionSize: 30,
      page: 1,
      size: 10,
      sort: {isSorting: true, state: {name: 'created', direction: 'ASC'}},
    });

    const parameters = latestParameters();

    expect(parameters.isSorting).toBe('true');
    expect(parameters.sortStateName).toBe('created');
    expect(parameters.sortStateDirection).toBe('ASC');
  });
});
