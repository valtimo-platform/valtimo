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

import {convertToParamMap} from '@angular/router';
import {parseCatalogParams, toCatalogQueryParams} from './exchange-catalog-params';

describe('exchange catalog params', () => {
  it('uses defaults for an empty query', () => {
    expect(parseCatalogParams(convertToParamMap({}))).toEqual({
      q: '',
      types: [],
      tags: [],
      sort: 'nameAsc',
      page: 1,
      size: 20,
    });
  });

  it('reads repeated type and tag params and a 1-based page', () => {
    const params = parseCatalogParams(
      convertToParamMap({
        q: 'energie',
        type: ['CaseDefinition', 'Plugin', 'Bogus'],
        tag: ['finance', 'hr'],
        sort: 'recent',
        page: '3',
        size: '40',
      })
    );

    expect(params).toEqual({
      q: 'energie',
      types: ['CaseDefinition', 'Plugin'],
      tags: ['finance', 'hr'],
      sort: 'recent',
      page: 3,
      size: 40,
    });
  });

  it('falls back on invalid page, size and sort', () => {
    const params = parseCatalogParams(convertToParamMap({page: '-2', size: '33', sort: 'weird'}));

    expect(params.page).toBe(1);
    expect(params.size).toBe(20);
    expect(params.sort).toBe('nameAsc');
  });

  it('turns defaults into null query params', () => {
    expect(
      toCatalogQueryParams({q: '', types: [], tags: [], sort: 'nameAsc', page: 1, size: 20})
    ).toEqual({q: null, type: null, tag: null, sort: null, page: null, size: null});
  });

  it('keeps non-default values', () => {
    expect(
      toCatalogQueryParams({
        q: 'x',
        types: ['BuildingBlock'],
        tags: ['hr'],
        sort: 'recent',
        page: 2,
        size: 60,
      })
    ).toEqual({q: 'x', type: ['BuildingBlock'], tag: ['hr'], sort: 'recent', page: 2, size: 60});
  });
});
