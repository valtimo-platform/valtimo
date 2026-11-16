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

import {Params, ParamMap} from '@angular/router';
import {ExchangeCatalogParams, ExchangePublicationType, ExchangeSort} from '../models';

const DEFAULT_SIZE = 20;
const PAGE_SIZE_OPTIONS = [20, 40, 60];
const PUBLICATION_TYPES: ReadonlyArray<ExchangePublicationType> = [
  'CaseDefinition',
  'BuildingBlock',
  'Plugin',
];

const positiveInt = (value: string | null, fallback: number): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const parseCatalogParams = (paramMap: ParamMap): ExchangeCatalogParams => {
  const size = positiveInt(paramMap.get('size'), DEFAULT_SIZE);

  return {
    q: paramMap.get('q') ?? '',
    types: PUBLICATION_TYPES.filter(type => paramMap.getAll('type').includes(type)),
    tags: paramMap.getAll('tag'),
    sort: (paramMap.get('sort') as ExchangeSort) === 'recent' ? 'recent' : 'nameAsc',
    page: positiveInt(paramMap.get('page'), 1),
    size: PAGE_SIZE_OPTIONS.includes(size) ? size : DEFAULT_SIZE,
  };
};

/** Defaults and empty values become null so a merging navigation removes them from the URL. */
const toCatalogQueryParams = (params: ExchangeCatalogParams): Params => ({
  q: params.q || null,
  type: params.types.length ? [...params.types] : null,
  tag: params.tags.length ? [...params.tags] : null,
  sort: params.sort === 'nameAsc' ? null : params.sort,
  page: params.page > 1 ? params.page : null,
  size: params.size === DEFAULT_SIZE ? null : params.size,
});

export {
  DEFAULT_SIZE,
  PAGE_SIZE_OPTIONS,
  PUBLICATION_TYPES,
  parseCatalogParams,
  toCatalogQueryParams,
};
