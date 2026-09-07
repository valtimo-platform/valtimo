/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

import {provideHttpClient, withInterceptorsFromDi} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {VALTIMO_CONFIG} from '@valtimo/shared';
import {environment} from '@src/environments/environment';
import {ProcessLinkBuildingBlockApiService} from './process-link-building-block-api.service';

describe('ProcessLinkBuildingBlockApiService', () => {
  let service: ProcessLinkBuildingBlockApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ProcessLinkBuildingBlockApiService,
        {provide: VALTIMO_CONFIG, useValue: environment},
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(ProcessLinkBuildingBlockApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getAllVersionsForBuildingBlock asks the backend to bypass paging', () => {
    service.getAllVersionsForBuildingBlock('my-block').subscribe();

    const req = httpMock.expectOne(request =>
      request.url.endsWith('/management/v1/building-block/my-block/version')
    );
    expect(req.request.params.get('all')).toBe('true');
    req.flush({content: []});
  });

  it('getVersionsForBuildingBlock sends page and size as separate parameters', () => {
    service.getVersionsForBuildingBlock('my-block', 2, 20).subscribe();

    const req = httpMock.expectOne(request =>
      request.url.endsWith('/management/v1/building-block/my-block/version')
    );
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('20');
    expect(req.request.params.get('all')).toBe('false');
    req.flush({content: []});
  });
});
