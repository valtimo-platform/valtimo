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
import {ROLE_ADMIN, RouterUtils} from '@valtimo/shared';
import {AuthGuardService} from '@valtimo/security';
import {FormManagementComponent} from './components/form-management/form-management.component';
import {FormManagementRouteData} from './models';
import {FormManagementEditComponent} from './components';
import {pendingChangesGuard} from '@valtimo/components';

const routes: Routes = [
  {
    path: 'form-management',
    component: FormManagementComponent,
    canActivate: [AuthGuardService],
    data: {title: 'Forms', roles: [ROLE_ADMIN], context: 'independent'} as FormManagementRouteData,
  },
  {
    path: 'form-management/:formDefinitionId',
    component: FormManagementEditComponent,
    canActivate: [AuthGuardService],
    canDeactivate: [pendingChangesGuard],
    data: {
      title: 'Forms',
      roles: [ROLE_ADMIN],
      context: 'independent',
      customPageTitle: true,
    } as FormManagementRouteData,
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, RouterUtils.getRouterExtraOptions())],
  exports: [RouterModule],
})
export class FormManagementRoutingModule {}

@NgModule({
  imports: [FormManagementComponent, FormManagementRoutingModule],
})
export class FormManagementModule {}
