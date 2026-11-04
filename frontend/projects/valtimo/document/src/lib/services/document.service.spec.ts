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
import {DocumentService} from './document.service';

describe('DocumentService case group calls', () => {
  let service: DocumentService;
  let httpMock: HttpTestingController;
  const base = '/api/v1/case-definition-group/my_group';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        DocumentService,
        {provide: ConfigService, useValue: {config: {valtimoApi: {endpointUri: '/api/'}}}},
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(DocumentService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  const expectSkip = (url: string, method: string, skip: string) => {
    const request = httpMock.expectOne(req => req.url === url && req.method === method);
    expect(request.request.headers.get('X-Skip-Interceptor')).toBe(skip);
    request.flush([]);
  };

  it('skips the error toast for 403 and 404 on the group', () => {
    service.getCaseDefinitionGroup('my_group').subscribe();
    expectSkip(base, 'GET', '403,404');
  });

  it('skips the error toast for 403 and 404 on the members', () => {
    service.getCaseDefinitionGroupMembers('my_group').subscribe();
    expectSkip(`${base}/member`, 'GET', '403,404');
  });

  it('skips the error toast for 403 and 404 on the list columns', () => {
    service.getGroupListColumns('my_group').subscribe();
    expectSkip(`${base}/list-column`, 'GET', '403,404');
  });

  it('skips the error toast for 403 and 404 on the search fields', () => {
    service.getGroupSearchFields('my_group').subscribe();
    expectSkip(`${base}/search-field`, 'GET', '403,404');
  });

  it('skips the error toast for 400, 403, 404 and 500 on the group search', () => {
    service.searchGroupCases('my_group', {}).subscribe();
    expectSkip(`${base}/search`, 'POST', '400,403,404,500');
  });
});
