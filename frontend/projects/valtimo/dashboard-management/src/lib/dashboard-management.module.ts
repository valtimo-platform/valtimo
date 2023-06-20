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
import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {ReactiveFormsModule} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {
  CarbonTableModule,
  ConfirmationModalModule,
  ListModule,
  SpinnerModule,
} from '@valtimo/components';
import {
  ButtonModule,
  DropdownModule,
  IconModule,
  InputModule,
  ModalModule,
} from 'carbon-components-angular';
import {DashboardDetailsComponent} from './components/dashboard-details/dashboard-details.component';
import {DashboardManagementComponent} from './components/dashboard-management/dashboard-management.component';
import {DashboardManagementRoutingModule} from './dashboard-management-routing.module';

@NgModule({
  declarations: [DashboardManagementComponent, DashboardDetailsComponent],
  imports: [
    ButtonModule,
    CarbonTableModule,
    CommonModule,
    TranslateModule,
    ConfirmationModalModule,
    DashboardManagementRoutingModule,
    DropdownModule,
    IconModule,
    InputModule,
    ListModule,
    ModalModule,
    ReactiveFormsModule,
    SpinnerModule,
  ],
  exports: [],
})
export class DashboardManagementModule {}
