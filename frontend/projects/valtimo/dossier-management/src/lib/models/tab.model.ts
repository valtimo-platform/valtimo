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

import {DossierManagementSearchFieldsComponent} from '../components/dossier-management-search-fields/dossier-management-search-fields.component';
import {DossierManagementDetailComponent} from '../components/dossier-management-detail/dossier-management-detail.component';
import {DossierManagementDocumentDefinitionComponent} from '../components/dossier-management-document-definition/dossier-management-document-definition.component';
import {DossierManagementTabsComponent} from '../components/dossier-management-tabs/dossier-management-tabs.component';
import {DossierManagementStatusesComponent} from '../components/dossier-management-statuses/dossier-management-statuses.component';
import {DossierManagementListColumnsComponent} from '../components/dossier-management-list-columns/dossier-management-list-columns.component';
import {CaseManagementProcessesComponent} from '../components/case-management-processes/case-management-processes.component';
import {Routes} from '@angular/router';
import {pendingChangesGuard} from '@valtimo/components';

export enum TabEnum {
  DOCUMENT = 'document',
  CASE = 'case',
  PROCESSES = 'processes',
  SEARCH = 'search',
  LIST = 'list',
  TABS = 'tabs',
  STATUSES = 'statuses',
}

export const CASE_MANAGEMENT_CHILDREN: Routes = [
  {
    path: TabEnum.DOCUMENT,
    component: DossierManagementDocumentDefinitionComponent,
  },
  {
    path: TabEnum.CASE,
    component: DossierManagementDetailComponent,
  },
  {
    path: TabEnum.PROCESSES,
    component: CaseManagementProcessesComponent,
    canDeactivate: [pendingChangesGuard],
  },
  {
    path: TabEnum.SEARCH,
    component: DossierManagementSearchFieldsComponent,
  },
  {
    path: TabEnum.LIST,
    component: DossierManagementListColumnsComponent,
  },
  {
    path: TabEnum.TABS,
    component: DossierManagementTabsComponent,
  },
  {
    path: TabEnum.STATUSES,
    component: DossierManagementStatusesComponent,
  },
];
