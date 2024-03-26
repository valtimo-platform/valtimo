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
import {AuthGuardService} from '@valtimo/security';
import {ROLE_ADMIN} from '@valtimo/config';
import {DashboardManagementComponent} from './components/dashboard-management/dashboard-management.component';
import {DashboardDetailsComponent} from './components/dashboard-details/dashboard-details.component';

const routes: Routes = [
  {
    path: 'dashboard-management',
    component: DashboardManagementComponent,
    canActivate: [AuthGuardService],
    data: {title: 'Dashboard configuration', roles: [ROLE_ADMIN]},
  },
  {
    path: 'dashboard-management/:id',
    component: DashboardDetailsComponent,
    canActivate: [AuthGuardService],
    data: {
      title: 'Dashboard details',
      roles: [ROLE_ADMIN],
      customPageTitle: true,
      customPageSubtitle: true,
    },
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
  declarations: [],
})
export class DashboardManagementRoutingModule {}
