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

import {CaseListTab} from '@valtimo/config';
import {CarbonListNoResultsMessage, CarbonListTranslations} from '@valtimo/components';

const DEFAULT_CASE_LIST_TABS: CaseListTab[] = [
  CaseListTab.ALL,
  CaseListTab.MINE,
  CaseListTab.OPEN,
];

const CASE_LIST_TABLE_TRANSLATIONS: CarbonListTranslations = {
  select: {
    single: 'case.select.single',
    multiple: 'case.select.multiple',
  },
  pagination: {
    itemsPerPage: 'case.pagination.itemsPerPage',
    totalItem: 'case.pagination.totalItem',
    totalItems: 'case.pagination.totalItems',
  },
};

const CASE_LIST_NO_RESULTS_MESSAGE: CarbonListNoResultsMessage = {
  description: 'case.noResults.ALL.description',
  isSearchResult: false,
  title: 'case.noResults.ALL.title',
};

export {
  DEFAULT_CASE_LIST_TABS,
  CASE_LIST_TABLE_TRANSLATIONS,
  CASE_LIST_NO_RESULTS_MESSAGE,
};
