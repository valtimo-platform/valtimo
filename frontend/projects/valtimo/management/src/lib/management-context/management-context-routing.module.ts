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
import {CommonModule} from '@angular/common';
import {AuthGuardService} from '@valtimo/security';
import {ContextListComponent} from './context-list/context-list.component';
import {ContextEditComponent} from './context-edit/context-edit.component';
import {ROLE_ADMIN} from '@valtimo/contract';

const routes: Routes = [
  {
    path: 'contexts',
    component: ContextListComponent,
    canActivate: [AuthGuardService],
    data: {title: 'Contexts', roles: [ROLE_ADMIN]}
  },
  {
    path: 'contexts/create',
    component: ContextEditComponent,
    canActivate: [AuthGuardService],
    data: {title: 'Create new Context', roles: [ROLE_ADMIN]}
  },
  {
    path: 'contexts/detail/:id',
    component: ContextEditComponent,
    canActivate: [AuthGuardService],
    data: {title: 'Context details', roles: [ROLE_ADMIN]}
  }
];

@NgModule({
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
  ],
  exports: [RouterModule]
})
export class ManagementContextRoutingModule {
}
