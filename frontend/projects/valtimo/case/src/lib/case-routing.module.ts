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
import {CaseDetailComponent} from './components/case-detail/case-detail.component';
import {CaseUpdateComponent} from './components/case-update/case-update.component';
import {ROLE_USER} from '@valtimo/shared';
import {CaseListComponent} from './components/case-list/case-list.component';
import {pendingChangesGuard} from '@valtimo/components';

const routes: Routes = [
  {
    path: 'cases/:caseDefinitionKey',
    component: CaseListComponent,
    canActivate: [AuthGuardService],
    data: {title: 'Cases', roles: [ROLE_USER], customPageTitle: true},
  },
  {
    path: 'cases/:caseDefinitionKey/document/:documentId/:tab',
    component: CaseDetailComponent,
    canActivate: [AuthGuardService],
    canDeactivate: [pendingChangesGuard],
    data: {
      title: 'Case details',
      parentPath: 'cases/:caseDefinitionKey',
      roles: [ROLE_USER],
    },
  },
  {
    path: 'cases/:caseDefinitionKey/document/:documentId',
    component: CaseDetailComponent,
    canActivate: [AuthGuardService],
    data: {
      title: 'Case details',
      parentPath: 'cases/:caseDefinitionKey',
      roles: [ROLE_USER],
    },
  },
  {
    path: 'cases/:caseDefinitionKey/document/:documentId/:tab/tasks/:taskId',
    component: CaseUpdateComponent,
    canActivate: [AuthGuardService],
    data: {
      title: 'Task details',
      parentPath: 'cases/:caseDefinitionKey/document/:documentId/:tab',
      roles: [ROLE_USER],
    },
  },
];

@NgModule({
  imports: [CommonModule, RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CaseRoutingModule {}
