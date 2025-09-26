/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

import {DossierListTab} from '@valtimo/config';
import {CarbonListNoResultsMessage, CarbonListTranslations} from '@valtimo/components';

const DEFAULT_DOSSIER_LIST_TABS: DossierListTab[] = [
  DossierListTab.ALL,
  DossierListTab.MINE,
  DossierListTab.OPEN,
];

const DOSSIER_LIST_TABLE_TRANSLATIONS: CarbonListTranslations = {
  select: {
    single: 'dossier.select.single',
    multiple: 'dossier.select.multiple',
  },
  pagination: {
    itemsPerPage: 'dossier.pagination.itemsPerPage',
    totalItem: 'dossier.pagination.totalItem',
    totalItems: 'dossier.pagination.totalItems',
  },
};

const DOSSIER_LIST_NO_RESULTS_MESSAGE: CarbonListNoResultsMessage = {
  description: 'dossier.noResults.ALL.description',
  isSearchResult: false,
  title: 'dossier.noResults.ALL.title',
};

export {
  DEFAULT_DOSSIER_LIST_TABS,
  DOSSIER_LIST_TABLE_TRANSLATIONS,
  DOSSIER_LIST_NO_RESULTS_MESSAGE,
};
