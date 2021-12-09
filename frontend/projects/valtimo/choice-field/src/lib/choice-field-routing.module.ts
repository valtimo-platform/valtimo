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
import {ChoiceFieldListComponent} from './choice-field-list/choice-field-list.component';
import {ChoiceFieldDetailComponent} from './choice-field-detail/choice-field-detail.component';
import {ChoiceFieldCreateComponent} from './choice-field-create/choice-field-create.component';
import {ChoiceFieldValueCreateComponent} from './choice-field-value-create/choice-field-value-create.component';
import {ChoiceFieldValueDetailComponent} from './choice-field-value-detail/choice-field-value-detail.component';
import {ROLE_ADMIN} from '@valtimo/contract';

const routes: Routes = [
  {
    path: 'choice-fields',
    data: {
      title: 'Choice fields',
      roles: [ROLE_ADMIN]
    },
    component: ChoiceFieldListComponent,
    canActivate: [AuthGuardService]
  },
  {
    path: 'choice-fields/field/:id',
    data: {
      title: 'Choice field details',
      roles: [ROLE_ADMIN]
    },
    component: ChoiceFieldDetailComponent,
    canActivate: [AuthGuardService]
  },
  {
    path: 'choice-fields/create',
    data: {
      title: 'Create new Choice field',
      roles: [ROLE_ADMIN]
    },
    component: ChoiceFieldCreateComponent,
    canActivate: [AuthGuardService]
  },
  {
    path: 'choice-fields/field/:id/create-value',
    data: {
      title: 'Create new Choice field value',
      roles: [ROLE_ADMIN]
    },
    component: ChoiceFieldValueCreateComponent,
    canActivate: [AuthGuardService]
  },
  {
    path: 'choice-fields/field/:id/value/:valueId',
    data: {
      title: 'Choice field value details',
      roles: [ROLE_ADMIN]
    },
    component: ChoiceFieldValueDetailComponent,
    canActivate: [AuthGuardService]
  }
];

@NgModule({
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
  ],
  exports: [RouterModule]
})
export class ChoiceFieldRoutingModule {
}
