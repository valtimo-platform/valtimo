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

import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {ConfigService} from '@valtimo/shared';
import {CaseListHiddenColumnsService} from './case-list-hidden-columns.service';

describe('CaseListHiddenColumnsService', () => {
  let service: CaseListHiddenColumnsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CaseListHiddenColumnsService,
        {provide: ConfigService, useValue: {config: {valtimoApi: {endpointUri: '/api/'}}}},
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(CaseListHiddenColumnsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('reads hidden columns of a case definition', () => {
    service.getHiddenColumns({type: 'definition', key: 'house'}).subscribe();

    const request = httpMock.expectOne({
      method: 'GET',
      url: '/api/v1/case/house/hidden-list-column',
    });
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });

  it('reads hidden columns of a case group', () => {
    service.getHiddenColumns({type: 'group', key: 'my_group'}).subscribe();

    const request = httpMock.expectOne({
      method: 'GET',
      url: '/api/v1/case-definition-group/my_group/hidden-list-column',
    });
    expect(request.request.headers.get('X-Skip-Interceptor')).toBe('403,404');
    request.flush([]);
  });

  it('saves hidden columns of a case group', () => {
    service.saveHiddenColumns({type: 'group', key: 'my_group'}, [{columnKey: 'name'}]).subscribe();

    const request = httpMock.expectOne({
      method: 'POST',
      url: '/api/v1/case-definition-group/my_group/hidden-list-column',
    });
    expect(request.request.body).toEqual([{columnKey: 'name'}]);
    request.flush([]);
  });
});
