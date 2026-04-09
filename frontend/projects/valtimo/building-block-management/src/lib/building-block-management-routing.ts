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
import {BuildingBlockManagementListComponent} from './components/building-block-management-list/building-block-management-list.component';
import {BuildingBlockManagementDetailComponent} from './components/building-block-management-detail/building-block-management-detail.component';
import {BUILDING_BLOCK_MANAGEMENT_TABS} from './constants';
import {
  ProcessManagementBuilderComponent,
  ProcessManagementRouteData,
} from '@valtimo/process-management';
import {FormManagementEditComponent} from '@valtimo/form-management';
import {FormFlowEditorComponent} from '@valtimo/form-flow-management';
import {DecisionModelerComponent} from '@valtimo/decision';

const routes: Routes = [
  {
    path: 'building-block-management',
    component: BuildingBlockManagementListComponent,
    canActivate: [AuthGuardService],
    data: {title: 'buildingBlockManagement.title', roles: [ROLE_ADMIN]},
  },
  {
    path: 'building-block-management/building-block/:buildingBlockDefinitionKey/version/:buildingBlockDefinitionVersionTag/:tabKey',
    component: BuildingBlockManagementDetailComponent,
    canActivate: [AuthGuardService],
    data: {
      title: 'buildingBlockManagement.detail.title',
      roles: [ROLE_ADMIN],
      customPageTitle: true,
      context: 'buildingBlock',
    },
  },
  {
    path: `building-block-management/building-block/:buildingBlockDefinitionKey/version/:buildingBlockDefinitionVersionTag/${BUILDING_BLOCK_MANAGEMENT_TABS.PROCESSES}/create`,
    component: ProcessManagementBuilderComponent,
    canActivate: [AuthGuardService],
    data: {
      title: 'Create new Process',
      roles: [ROLE_ADMIN],
      context: 'buildingBlock',
    } as ProcessManagementRouteData,
  },
  {
    path: `building-block-management/building-block/:buildingBlockDefinitionKey/version/:buildingBlockDefinitionVersionTag/${BUILDING_BLOCK_MANAGEMENT_TABS.PROCESSES}/:processDefinitionKey`,
    component: ProcessManagementBuilderComponent,
    canActivate: [AuthGuardService],
    data: {
      title: 'Process details',
      roles: [ROLE_ADMIN],
      customPageTitle: true,
      context: 'buildingBlock',
    },
  },
  {
    path: `building-block-management/building-block/:buildingBlockDefinitionKey/version/:buildingBlockDefinitionVersionTag/${BUILDING_BLOCK_MANAGEMENT_TABS.FORMS}/:formDefinitionId`,
    component: FormManagementEditComponent,
    canActivate: [AuthGuardService],
    data: {
      title: 'formManagement.edit.title',
      roles: [ROLE_ADMIN],
      customPageTitle: true,
      context: 'buildingBlock',
    },
  },
  {
    path: `building-block-management/building-block/:buildingBlockDefinitionKey/version/:buildingBlockDefinitionVersionTag/${BUILDING_BLOCK_MANAGEMENT_TABS.FORM_FLOWS}/:formFlowDefinitionKey`,
    component: FormFlowEditorComponent,
    canActivate: [AuthGuardService],
    data: {
      title: 'formFlow.title',
      roles: [ROLE_ADMIN],
      customPageTitle: true,
      context: 'buildingBlock',
    },
  },
  {
    path: `building-block-management/building-block/:buildingBlockDefinitionKey/version/:buildingBlockDefinitionVersionTag/${BUILDING_BLOCK_MANAGEMENT_TABS.DECISIONS}/:id`,
    component: DecisionModelerComponent,
    canActivate: [AuthGuardService],
    data: {
      title: 'Decision table',
      roles: [ROLE_ADMIN],
      customPageTitle: true,
      context: 'buildingBlock',
    },
  },
];

@NgModule({
  declarations: [],
  imports: [CommonModule, RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class BuildingBlockManagementRouting {}
