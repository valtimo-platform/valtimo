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
import {DossierDetailComponent} from './components/dossier-detail/dossier-detail.component';
import {DossierUpdateComponent} from './components/dossier-update/dossier-update.component';
import {ROLE_USER} from '@valtimo/config';
import {DossierListComponent} from './components/dossier-list/dossier-list.component';
import {pendingChangesGuard} from '@valtimo/components';

const routes: Routes = [
  {
    path: 'dossiers/:documentDefinitionName',
    component: DossierListComponent,
    canActivate: [AuthGuardService],
    data: {title: 'Dossiers', roles: [ROLE_USER], customPageTitle: true},
  },
  {
    path: 'dossiers/:documentDefinitionName/document/:documentId/:tab',
    component: DossierDetailComponent,
    canActivate: [AuthGuardService],
    canDeactivate: [pendingChangesGuard],
    data: {
      title: 'Dossier details',
      parentPath: 'dossiers/:documentDefinitionName',
      roles: [ROLE_USER],
    },
  },
  {
    path: 'dossiers/:documentDefinitionName/document/:documentId',
    component: DossierDetailComponent,
    canActivate: [AuthGuardService],
    data: {
      title: 'Dossier details',
      parentPath: 'dossiers/:documentDefinitionName',
      roles: [ROLE_USER],
    },
  },
  {
    path: 'dossiers/:documentDefinitionName/document/:documentId/:tab/tasks/:taskId',
    component: DossierUpdateComponent,
    canActivate: [AuthGuardService],
    data: {
      title: 'Task details',
      parentPath: 'dossiers/:documentDefinitionName/document/:documentId/:tab',
      roles: [ROLE_USER],
    },
  },
];

@NgModule({
  imports: [CommonModule, RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DossierRoutingModule {}
