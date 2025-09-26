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

import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {CommonModule} from '@angular/common';
import {AuthGuardService} from '@valtimo/security';
import {ROLE_ADMIN} from '@valtimo/shared';
import {DecisionModelerComponent} from './decision-modeler/decision-modeler.component';
import {DecisionDisplayComponent} from './decision-display/decision-display.component';
import {DecisionManagementRouteData} from './models/decision-management.model';
import {DecisionListComponent} from './decision-list/decision-list.component';

const routes: Routes = [
  {
    path: 'decision-tables',
    component: DecisionListComponent,
    canActivate: [AuthGuardService],
    data: {
      title: 'Decision tables',
      roles: [ROLE_ADMIN],
      context: 'independent',
    } as DecisionManagementRouteData,
  },
  {
    path: 'decision-tables/:id',
    component: DecisionDisplayComponent,
    canActivate: [AuthGuardService],
    data: {
      title: 'Decision tables',
      roles: [ROLE_ADMIN],
      context: 'independent',
    } as DecisionManagementRouteData,
  },
  {
    path: 'decision-tables/edit/:id',
    component: DecisionModelerComponent,
    canActivate: [AuthGuardService],
    data: {
      title: 'Edit decision table',
      roles: [ROLE_ADMIN],
      customPageTitle: true,
      context: 'independent',
    } as DecisionManagementRouteData,
  },
  {
    path: 'decision-tables/edit/create',
    component: DecisionModelerComponent,
    canActivate: [AuthGuardService],
    data: {
      title: 'Create decision table',
      roles: [ROLE_ADMIN],
      context: 'independent',
    } as DecisionManagementRouteData,
  },
];

@NgModule({
  declarations: [],
  imports: [CommonModule, RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DecisionRoutingModule {}
