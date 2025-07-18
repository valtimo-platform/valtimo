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
import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {AuthGuardService} from '@valtimo/security';
import {IkoListComponent} from './components/iko-list/iko-list.component';
import {IkoSearchComponent} from './components/iko-search/iko-search.component';
import {IkoDetailsComponent} from './components/iko-details/iko-details.component';
import {IkoManagementComponent} from './components/iko-management/iko-management.component';
import {ROLE_ADMIN} from '@valtimo/shared';
import {IkoManagementDetailsComponent} from './components/iko-management-details/iko-management-details.component';

const routes: Routes = [
  {
    path: 'iko/:key',
    component: IkoSearchComponent,
    canActivate: [AuthGuardService],
    data: {
      title: 'Iko',
      customPageTitle: true,
    },
  },
  {
    path: 'iko/:key/:searchKey',
    component: IkoListComponent,
    canActivate: [AuthGuardService],
    data: {
      title: 'interface.results',
    },
  },
  {
    path: 'iko/:key/:searchKey/details/:id',
    component: IkoDetailsComponent,
    canActivate: [AuthGuardService],
    data: {
      title: 'interface.details',
      customPageTitle: true,
    },
  },
  {
    path: 'iko-management',
    component: IkoManagementComponent,
    canActivate: [AuthGuardService],
    data: {
      title: 'Iko',
      roles: [ROLE_ADMIN],
    },
  },
  {
    path: 'iko-management/:key/:tabKey',
    component: IkoManagementDetailsComponent,
    canActivate: [AuthGuardService],
    data: {
      customPageTitle: true,
      title: 'IKO Details',
      roles: [ROLE_ADMIN],
    },
  },
];

@NgModule({
  declarations: [],
  imports: [CommonModule, RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class IkoRoutingModule {}
