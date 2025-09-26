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
import {ProcessManagementRoutingModule} from './process-management-routing';
import {CommonModule} from '@angular/common';
import {CarbonListModule, ListModule, WidgetModule} from '@valtimo/components';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {ProcessLinkModule} from '@valtimo/process-link';
import {
  ProcessManagementBuilderComponent,
  ProcessManagementComponent,
  ProcessManagementListComponent,
  ProcessManagementUploadComponent,
} from './components';
import {
  ButtonModule,
  DropdownModule,
  FileUploaderModule,
  IconModule,
  LayerModule,
  ModalModule,
  NotificationModule,
  RadioModule,
} from 'carbon-components-angular';

@NgModule({
  declarations: [
    ProcessManagementComponent,
    ProcessManagementListComponent,
    ProcessManagementUploadComponent,
  ],
  imports: [
    CommonModule,
    ProcessManagementRoutingModule,
    WidgetModule,
    ListModule,
    FormsModule,
    TranslateModule,
    ProcessLinkModule,
    ProcessManagementBuilderComponent,
    CarbonListModule,
    ButtonModule,
    IconModule,
    DropdownModule,
    ModalModule,
    NotificationModule,
    RadioModule,
    ReactiveFormsModule,
    ModalModule,
    FileUploaderModule,
    LayerModule,
  ],
  exports: [
    ProcessManagementComponent,
    ProcessManagementListComponent,
    ProcessManagementUploadComponent,
  ],
})
export class ProcessManagementModule {}
