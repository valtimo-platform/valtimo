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
import {HttpClientTestingModule, HttpTestingController} from '@angular/common/http/testing';
import {ConfigService, InterceptorSkip} from '@valtimo/shared';
import {BuildingBlockManagementApiService} from './building-block-management-api.service';

describe('BuildingBlockManagementApiService', () => {
  let service: BuildingBlockManagementApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        {
          provide: ConfigService,
          useValue: {config: {valtimoApi: {endpointUri: '/api/'}}},
        },
      ],
    });

    service = TestBed.inject(BuildingBlockManagementApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('skips the interceptor for 409 when deleting a building block form definition', () => {
    service.deleteBuildingBlockFormDefinition('case-review', '1.0.0', 'form-1').subscribe();

    const request = httpMock.expectOne(req => req.url.endsWith(
      'management/v1/building-block/case-review/version/1.0.0/form/form-1'
    ));

    expect(request.request.method).toBe('DELETE');
    expect(request.request.headers.get(InterceptorSkip)).toBe('409');
    request.flush(null);
  });
});
