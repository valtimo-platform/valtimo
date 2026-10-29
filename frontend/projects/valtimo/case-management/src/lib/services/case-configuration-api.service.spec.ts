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

import {provideHttpClient, withInterceptorsFromDi} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {VALTIMO_CONFIG} from '@valtimo/shared';
import {environment} from '@src/environments/environment';
import {CaseConfigurationApiService} from './case-configuration-api.service';

describe('CaseConfigurationApiService', () => {
  const PARAMS = {caseDefinitionKey: 'permit', caseDefinitionVersionTag: '1.0.0'};
  const BASE = '/management/v1/case-definition/permit/version/1.0.0/configuration';
  const ITEM = {key: 'api-url', defaultValue: 'https://a', environmentValue: null};

  let service: CaseConfigurationApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CaseConfigurationApiService,
        {provide: VALTIMO_CONFIG, useValue: environment},
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(CaseConfigurationApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getConfigurations GETs the version configuration list', () => {
    service.getConfigurations(PARAMS).subscribe(items => expect(items).toEqual([ITEM]));

    const req = httpMock.expectOne(request => request.url.endsWith(BASE));
    expect(req.request.method).toBe('GET');
    req.flush([ITEM]);
  });

  it('createConfiguration POSTs key and default value', () => {
    service.createConfiguration(PARAMS, {key: 'api-url', defaultValue: 'https://a'}).subscribe();

    const req = httpMock.expectOne(request => request.url.endsWith(BASE));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({key: 'api-url', defaultValue: 'https://a'});
    req.flush(ITEM);
  });

  it('updateConfiguration PUTs the default value to the key', () => {
    service.updateConfiguration(PARAMS, 'api-url', {defaultValue: 'https://b'}).subscribe();

    const req = httpMock.expectOne(request => request.url.endsWith(`${BASE}/api-url`));
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({defaultValue: 'https://b'});
    req.flush(ITEM);
  });

  it('deleteConfiguration DELETEs the key', () => {
    service.deleteConfiguration(PARAMS, 'api-url').subscribe();

    const req = httpMock.expectOne(request => request.url.endsWith(`${BASE}/api-url`));
    expect(req.request.method).toBe('DELETE');
    req.flush(null, {status: 204, statusText: 'No Content'});
  });

  it('setEnvironmentValue PUTs the value to the environment-value endpoint', () => {
    service.setEnvironmentValue(PARAMS, 'api-url', {value: 'https://env'}).subscribe();

    const req = httpMock.expectOne(request =>
      request.url.endsWith(`${BASE}/api-url/environment-value`)
    );
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({value: 'https://env'});
    req.flush({...ITEM, environmentValue: 'https://env'});
  });

  it('clearEnvironmentValue DELETEs the environment-value endpoint', () => {
    service.clearEnvironmentValue(PARAMS, 'api-url').subscribe();

    const req = httpMock.expectOne(request =>
      request.url.endsWith(`${BASE}/api-url/environment-value`)
    );
    expect(req.request.method).toBe('DELETE');
    req.flush(null, {status: 204, statusText: 'No Content'});
  });
});
