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
import {HttpClientTestingModule, HttpTestingController} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {ConfigService, InterceptorSkip} from '@valtimo/shared';
import {FormManagementService} from './form-management.service';

describe('FormManagementService', () => {
  let service: FormManagementService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        {provide: ConfigService, useValue: {config: {valtimoApi: {endpointUri: '/api/'}}}},
      ],
    });
    service = TestBed.inject(FormManagementService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const expectHeader = (method: string, value: string | null): void => {
    const req = http.expectOne(r => r.method === method);
    expect(req.request.headers.get(InterceptorSkip)).toBe(value);
    req.flush(null);
  };

  it('skips the 409 interceptor on deleteFormDefinition', () => {
    service.deleteFormDefinition('id').subscribe();
    expectHeader('DELETE', '409');
  });

  it('skips the 409 interceptor on deleteFormDefinitionCase', () => {
    service.deleteFormDefinitionCase('k', '1.0.0', 'id').subscribe();
    expectHeader('DELETE', '409');
  });

  it('skips the 409 interceptor on deleteFormDefinitionBuildingBlock', () => {
    service.deleteFormDefinitionBuildingBlock('k', '1.0.0', 'id').subscribe();
    expectHeader('DELETE', '409');
  });

  it('does not skip the 409 interceptor on getFormDefinitionBuildingBlock', () => {
    service.getFormDefinitionBuildingBlock('k', '1.0.0', 'id').subscribe();
    expectHeader('GET', null);
  });
});
