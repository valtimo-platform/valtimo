/*
 * Copyright 2015-2023 Ritense BV, the Netherlands.
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
import {TranslateModule} from '@ngx-translate/core';
import {CarbonTableModule, ConfirmationModalModule} from '@valtimo/components';
import {AccessControlManagementRoutingModule} from './access-control-management-routing.module';
import {AccessControlOverviewComponent} from './components/overview/access-control-overview.component';
import {AddRoleModalComponent} from './components/add-role-modal/add-role-modal.component';
import {ButtonModule, IconModule, InputModule, ModalModule} from 'carbon-components-angular';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';

@NgModule({
  declarations: [AccessControlOverviewComponent, AddRoleModalComponent],
  imports: [
    AccessControlManagementRoutingModule,
    ButtonModule,
    CarbonTableModule,
    CommonModule,
    FormsModule,
    ModalModule,
    TranslateModule,
    ReactiveFormsModule,
    InputModule,
    IconModule,
    ConfirmationModalModule,
  ],
})
export class AccessControlManagementModule {}
