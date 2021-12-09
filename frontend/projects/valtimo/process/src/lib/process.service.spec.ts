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
import {ProcessService} from './process.service';

describe('ProcessService', () => {

  let mockConfig;
  let httpTestingController: HttpTestingController;
  let service: ProcessService;

  beforeEach(() => {
    mockConfig = {endpointUri: '/api/'};

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ProcessService]
    });

    httpTestingController = TestBed.inject(HttpTestingController);
    service = TestBed.inject(ProcessService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getProcessDefinition', () => {
    it('should call request method get with the correct url', () => {
      service.getProcessDefinition('some-key-mock').subscribe();
      const req = httpTestingController.expectOne(mockConfig.endpointUri + 'process/definition/some-key-mock');
      expect(req.request.method).toBe('GET');
      req.flush({
        id: 'some-id-mock',
        key: 'some-key-mock',
        name: 'ProcessDefinitionTestName'
      });
      httpTestingController.verify();
    });
  });

  describe('getProcessDefinitionStartFormData', () => {
    it('should call request method get with the correct url', () => {
      service.getProcessDefinitionStartFormData('some-key-mock').subscribe();
      const req = httpTestingController.expectOne(mockConfig.endpointUri + 'process/definition/some-key-mock/start-form');
      expect(req.request.method).toBe('GET');
      req.flush({
        id: 'some-id-mock',
        key: 'some-key-mock',
        formFields: [],
        formLocation: 'formLocation',
        genericForm: 'genericForm',
      });
      httpTestingController.verify();
    });
  });

  describe('startProcesInstance', () => {
    it('should call request method post with the correct url', () => {
      service.startProcesInstance('some-key-mock', 'businessKey', null).subscribe();
      const req = httpTestingController.expectOne(mockConfig.endpointUri + 'process/definition/some-key-mock/businessKey/start');
      expect(req.request.method).toBe('POST');
      req.flush({
        businessKey: 'businessKey',
        key: 'some-key-mock',
        formFields: [],
        formLocation: 'formLocation',
        genericForm: 'genericForm',
      });
      httpTestingController.verify();
    });
  });
});
