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

import {ActivatedRoute, convertToParamMap, ParamMap, Router} from '@angular/router';
import {VersionService} from '@valtimo/components';
import {ConfigService} from '@valtimo/shared';
import {BehaviorSubject, of, throwError} from 'rxjs';
import {ExchangeRequestError, ExchangeSearchResultDto} from '../../models';
import {ExchangeCatalogApiService} from '../../services/exchange-catalog-api.service';
import {ExchangeCatalogService} from './exchange-catalog.service';

describe('ExchangeCatalogService', () => {
  const emptyResult: ExchangeSearchResultDto = {content: [], page: 0, size: 20, totalElements: 0};

  let queryParamMap$: BehaviorSubject<ParamMap>;
  let router: jasmine.SpyObj<Router>;
  let api: jasmine.SpyObj<ExchangeCatalogApiService>;
  let service: ExchangeCatalogService;

  const create = (
    configuration: unknown = {enabled: true, url: 'https://exchange.example', assetOrigins: []}
  ): void => {
    const route = {
      queryParamMap: queryParamMap$.asObservable(),
      snapshot: {
        get queryParamMap() {
          return queryParamMap$.value;
        },
      },
    } as unknown as ActivatedRoute;
    const config = {exchangeConfiguration$: of(configuration)} as unknown as ConfigService;
    const version = {
      getVersion: () => of({title: 'Valtimo', version: '13.53.0'}),
    } as VersionService;

    service = new ExchangeCatalogService(route, router, api, config, version);
    service.init();
  };

  beforeEach(() => {
    queryParamMap$ = new BehaviorSubject<ParamMap>(convertToParamMap({}));
    router = jasmine.createSpyObj('Router', ['navigate']);
    router.navigate.and.returnValue(Promise.resolve(true));
    api = jasmine.createSpyObj('ExchangeCatalogApiService', ['search', 'getTags']);
    api.search.and.returnValue(of(emptyResult));
    api.getTags.and.returnValue(of({tags: ['b-tag', 'a-tag']}));
  });

  const lastNavigation = (): Record<string, unknown> =>
    router.navigate.calls.mostRecent().args[1]?.queryParams as Record<string, unknown>;

  it('maps query params to a zero-based search request with repeated params', () => {
    queryParamMap$.next(
      convertToParamMap({
        q: 'energie',
        type: ['CaseDefinition', 'Plugin'],
        tag: ['finance'],
        sort: 'recent',
        page: '3',
        size: '40',
      })
    );
    create();

    expect(api.search).toHaveBeenCalledWith({
      name: 'energie',
      types: ['CaseDefinition', 'Plugin'],
      tags: ['finance'],
      sort: 'recent',
      page: 2,
      size: 40,
    });
    expect(service.$state()).toBe('ready');
  });

  it('sorts tags alphabetically', () => {
    create();

    expect(service.$tags()).toEqual(['a-tag', 'b-tag']);
  });

  it('resets the page when a filter changes', () => {
    queryParamMap$.next(convertToParamMap({page: '4'}));
    create();

    service.setTypes(['BuildingBlock']);

    expect(lastNavigation()['type']).toEqual(['BuildingBlock']);
    expect(lastNavigation()['page']).toBeNull();
  });

  it('keeps the search text when clearing filters', () => {
    queryParamMap$.next(convertToParamMap({q: 'energie', type: 'Plugin', tag: 'hr', page: '2'}));
    create();

    service.clearFilters();

    expect(lastNavigation()['q']).toBe('energie');
    expect(lastNavigation()['type']).toBeNull();
    expect(lastNavigation()['tag']).toBeNull();
    expect(lastNavigation()['page']).toBeNull();
  });

  it('writes the page 1-based', () => {
    create();

    service.setPage(3);

    expect(lastNavigation()['page']).toBe(3);
  });

  it('is in the error state when the search fails and retries', () => {
    api.search.and.returnValue(throwError(() => new ExchangeRequestError('unavailable')));
    create();
    expect(service.$state()).toBe('error');

    api.search.and.returnValue(of(emptyResult));
    service.retry();

    expect(service.$state()).toBe('ready');
  });

  it('is not configured without an Exchange configuration', () => {
    create(null);

    expect(service.$state()).toBe('notConfigured');
    expect(api.search).not.toHaveBeenCalled();
  });
});
