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
import {ViewConfiguratorService} from './view-configurator.service';

describe('ViewConfiguratorService', () => {

  let mockConfig;
  let httpTestingController: HttpTestingController;
  let service: ViewConfiguratorService;

  beforeEach(() => {
    mockConfig = {endpointUri: '/api/'};

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ViewConfiguratorService]
    });

    httpTestingController = TestBed.inject(HttpTestingController);
    service = TestBed.inject(ViewConfiguratorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getViewConfig', () => {
    it('should call request method get with the correct url', () => {
      service.getViewConfig('some-processDefinitionId').subscribe();
      const req = httpTestingController.expectOne(mockConfig.endpointUri + 'viewconfig/some-processDefinitionId');
      expect(req.request.method).toBe('GET');
      req.flush({
        processDefinitionId: 'some-processDefinitionId'
      });
      httpTestingController.verify();
    });
  });
});
