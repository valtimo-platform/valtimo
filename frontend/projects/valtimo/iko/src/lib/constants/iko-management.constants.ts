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

import {IkoManagementTab, IkoManagementTabType} from '../models';
import {IkoManagementSearchFieldsComponent} from '../components/iko-management-details/components/search-fields/iko-management-search-fields.component';
import {IkoManagementListComponent} from '../components/iko-management-details/components/list/iko-management-list.component';
import {IkoManagementTabsComponent} from '../components/iko-management-details/components/tabs/iko-management-tabs.component';

const IKO_MANAGEMENT_TABS: IkoManagementTab[] = [
  {
    key: IkoManagementTabType.SEARCH_FIELDS,
    title: 'ikoManagement.searchFields',
    component: IkoManagementSearchFieldsComponent,
  },
  {
    key: IkoManagementTabType.LIST,
    title: 'ikoManagement.list',
    component: IkoManagementListComponent,
  },
  {
    key: IkoManagementTabType.TABS,
    title: 'ikoManagement.tabs',
    component: IkoManagementTabsComponent,
  },
];

export {IKO_MANAGEMENT_TABS};
