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
import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {pendingChangesGuard} from '@valtimo/components';
import {ROLE_ADMIN} from '@valtimo/config';
import {AuthGuardService} from '@valtimo/security';
import {DossierManagementDetailContainerComponent} from './components/dossier-management-detail-container/dossier-management-detail-container.component';
import {DossierManagementListComponent} from './components/dossier-management-list/dossier-management-list.component';
import {DossierManagementWidgetTabComponent} from './components/dossier-management-widget-tab/dossier-management-widget-tab.component';

const routes: Routes = [
  {
    path: 'dossier-management',
    component: DossierManagementListComponent,
    canActivate: [AuthGuardService],
    data: {title: 'Dossiers', roles: [ROLE_ADMIN]},
  },
  {
    path: 'dossier-management/dossier/:name/widget-tab/:key',
    component: DossierManagementWidgetTabComponent,
    canActivate: [AuthGuardService],
    canDeactivate: [pendingChangesGuard],
    data: {
      title: 'Widget tab',
      roles: [ROLE_ADMIN],
      customPageTitle: true,
      customPageSubtitle: true,
    },
  },
  {
    path: 'dossier-management/dossier/:name',
    component: DossierManagementDetailContainerComponent,
    canActivate: [AuthGuardService],
    canDeactivate: [pendingChangesGuard],
    data: {title: 'Dossier details', roles: [ROLE_ADMIN], customPageTitle: true},
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
  declarations: [],
})
export class DossierManagementRoutingModule {}
