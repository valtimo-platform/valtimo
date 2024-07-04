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
import {CommonModule} from '@angular/common';
import {AuthGuardService} from '@valtimo/security';
import {MilestoneComponent} from './milestone.component';
import {MilestoneSetCreateComponent} from './milestone-set-create/milestone-set-create.component';
import {MilestoneCreateComponent} from './milestone-create/milestone-create.component';
import {MilestoneSetEditComponent} from './milestone-set-edit/milestone-set-edit.component';
import {MilestoneEditComponent} from './milestone-edit/milestone-edit.component';
import {ROLE_ADMIN} from '@valtimo/config';

const routes: Routes = [
  {
    path: 'milestones',
    component: MilestoneComponent,
    canActivate: [AuthGuardService],
    data: {title: 'Milestones', roles: [ROLE_ADMIN]},
  },
  {
    path: 'milestones/sets/create',
    component: MilestoneSetCreateComponent,
    canActivate: [AuthGuardService],
    data: {title: 'Create new Milestone Set', roles: [ROLE_ADMIN]},
  },
  {
    path: 'milestones/create',
    component: MilestoneCreateComponent,
    canActivate: [AuthGuardService],
    data: {title: 'Create new Milestone', roles: [ROLE_ADMIN]},
  },
  {
    path: 'milestones/sets/set/:id',
    component: MilestoneSetEditComponent,
    canActivate: [AuthGuardService],
    data: {title: 'Milestone Set details', roles: [ROLE_ADMIN]},
  },
  {
    path: 'milestones/milestone/:id',
    component: MilestoneEditComponent,
    canActivate: [AuthGuardService],
    data: {title: 'Milestone details', roles: [ROLE_ADMIN]},
  },
];

@NgModule({
  declarations: [],
  imports: [CommonModule, RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MilestoneRoutingModule {}
