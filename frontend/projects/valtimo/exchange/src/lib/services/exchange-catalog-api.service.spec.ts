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

import {
  HttpClient,
  HttpInterceptorFn,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {ConfigService, ExchangeConfiguration} from '@valtimo/shared';
import {BehaviorSubject} from 'rxjs';
import {ExchangeRequestError} from '../models';
import {ExchangeCatalogApiService} from './exchange-catalog-api.service';

describe('ExchangeCatalogApiService', () => {
  const EXCHANGE_URL = 'https://exchange.example';
  const configuration$ = new BehaviorSubject<ExchangeConfiguration | null>({
    enabled: true,
    url: EXCHANGE_URL,
    assetOrigins: [],
  });
  const addAuthorization: HttpInterceptorFn = (request, next) =>
    next(request.clone({setHeaders: {Authorization: 'Bearer valtimo-token'}}));

  let service: ExchangeCatalogApiService;
  let controller: HttpTestingController;

  beforeEach(() => {
    configuration$.next({enabled: true, url: EXCHANGE_URL, assetOrigins: []});

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([addAuthorization])),
        provideHttpClientTesting(),
        ExchangeCatalogApiService,
        {provide: ConfigService, useValue: {exchangeConfiguration$: configuration$}},
      ],
    });

    service = TestBed.inject(ExchangeCatalogApiService);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('sends no Authorization header while a regular HttpClient would', () => {
    service.getTags().subscribe();
    const exchangeRequest = controller.expectOne(`${EXCHANGE_URL}/api/v1/publications/tags`);
    expect(exchangeRequest.request.headers.has('Authorization')).toBeFalse();
    exchangeRequest.flush({tags: []});

    TestBed.inject(HttpClient).get('/valtimo').subscribe();
    const valtimoRequest = controller.expectOne('/valtimo');
    expect(valtimoRequest.request.headers.get('Authorization')).toBe('Bearer valtimo-token');
    valtimoRequest.flush({});
  });

  it('searches with repeated type and tag params', () => {
    service
      .search({
        name: 'energie',
        types: ['CaseDefinition', 'BuildingBlock'],
        tags: ['finance', 'hr'],
        sort: 'recent',
        page: 2,
        size: 40,
      })
      .subscribe();

    const request = controller.expectOne(
      req => req.url === `${EXCHANGE_URL}/api/v1/publications/search`
    );
    expect(request.request.params.get('name')).toBe('energie');
    expect(request.request.params.getAll('publicationType')).toEqual([
      'CaseDefinition',
      'BuildingBlock',
    ]);
    expect(request.request.params.getAll('tag')).toEqual(['finance', 'hr']);
    expect(request.request.params.get('sort')).toBe('recent');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('size')).toBe('40');
    request.flush({content: [], page: 2, size: 40, totalElements: 0});
  });

  it('omits an empty name', () => {
    service.search({name: '', types: [], tags: [], sort: 'nameAsc', page: 0, size: 20}).subscribe();

    const request = controller.expectOne(
      req => req.url === `${EXCHANGE_URL}/api/v1/publications/search`
    );
    expect(request.request.params.has('name')).toBeFalse();
    expect(request.request.params.has('publicationType')).toBeFalse();
    request.flush({content: [], page: 0, size: 20, totalElements: 0});
  });

  it('encodes the publication id', () => {
    service.getPublication('a/b').subscribe();

    const request = controller.expectOne(`${EXCHANGE_URL}/api/v1/publications/a%2Fb`);
    expect(request.request.method).toBe('GET');
    request.flush({});
  });

  it('maps a 404 to notFound', done => {
    service.getPublication('missing').subscribe({
      error: (error: ExchangeRequestError) => {
        expect(error.kind).toBe('notFound');
        done();
      },
    });

    controller
      .expectOne(`${EXCHANGE_URL}/api/v1/publications/missing`)
      .flush(null, {status: 404, statusText: 'Not Found'});
  });

  it('maps other failures to unavailable', done => {
    service.getTags().subscribe({
      error: (error: ExchangeRequestError) => {
        expect(error.kind).toBe('unavailable');
        done();
      },
    });

    controller
      .expectOne(`${EXCHANGE_URL}/api/v1/publications/tags`)
      .error(new ProgressEvent('error'), {status: 0});
  });

  it('fails with notConfigured without an Exchange url', done => {
    configuration$.next(null);

    service.getTags().subscribe({
      error: (error: ExchangeRequestError) => {
        expect(error.kind).toBe('notConfigured');
        done();
      },
    });

    controller.expectNone(`${EXCHANGE_URL}/api/v1/publications/tags`);
  });
});
