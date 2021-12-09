/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
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
import {AuthGuardService} from '@valtimo/security';
import {DossierManagementDetailComponent} from './dossier-management-detail/dossier-management-detail.component';
import {DossierManagementListComponent} from './dossier-management-list/dossier-management-list.component';
import {ROLE_ADMIN} from '@valtimo/contract';

const routes: Routes = [
  {
    path: 'dossier-management',
    component: DossierManagementListComponent,
    canActivate: [AuthGuardService],
    data: {title: 'Dossiers', roles: [ROLE_ADMIN]}
  },
  {
    path: 'dossier-management/dossier/:name',
    component: DossierManagementDetailComponent,
    canActivate: [AuthGuardService],
    data: {title: 'Dossier details', roles: [ROLE_ADMIN]}
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes)
  ],
  exports: [
    RouterModule
  ],
  declarations: []
})
export class DossierManagementRoutingModule {
}
