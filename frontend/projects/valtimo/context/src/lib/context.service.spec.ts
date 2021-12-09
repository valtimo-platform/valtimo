/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
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
import {ContextService} from './context.service';

describe('ContextService', () => {
  let mockConfig;
  let httpTestingController: HttpTestingController;
  let service: ContextService;

  beforeEach(() => {
    mockConfig = {endpointUri: '/api/'};

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ContextService]
    });

    httpTestingController = TestBed.inject(HttpTestingController);
    service = TestBed.inject(ContextService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getUserContextProceses', () => {
    it('should call request method get with the correct url', () => {
      service.getUserContextProceses().subscribe();
      const req = httpTestingController.expectOne(mockConfig.endpointUri + 'user/context/processes');
      expect(req.request.method).toBe('GET');
      httpTestingController.verify();
    });
  });

  describe('getUserContextProcessesActive', () => {
    it('should call request method get with the correct url', () => {
      service.getUserContextProcessesActive().subscribe();
      const req = httpTestingController.expectOne(mockConfig.endpointUri + 'context/process/user/active');
      expect(req.request.method).toBe('GET');
      httpTestingController.verify();
    });
  });

});
