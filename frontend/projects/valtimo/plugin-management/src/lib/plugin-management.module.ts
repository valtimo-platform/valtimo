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
import {PluginManagementRoutingModule} from './plugin-management-routing';
import {CommonModule} from '@angular/common';
import {TranslateModule} from '@ngx-translate/core';
import {PluginManagementComponent} from './components/plugin-management/plugin-management.component';
import {PluginAddModalComponent} from './components/plugin-add-modal/plugin-add-modal.component';
import {PluginManagementStateService} from './services';
import {PluginAddSelectComponent} from './components/plugin-add-select/plugin-add-select.component';
import {PluginConfigureComponent} from './components/plugin-configure/plugin-configure.component';
import {PluginConfigurationContainerModule, PluginTranslatePipeModule} from '@valtimo/plugin';
import {PluginEditModalComponent} from './components/plugin-edit-modal/plugin-edit-modal.component';
import {PluginEditComponent} from './components/plugin-edit/plugin-edit.component';
import {
  ButtonModule,
  CarbonListModule,
  PageModule,
  ParagraphModule,
  StepperModule,
  TableModule,
  TitleModule,
  ValtimoCdsModalDirectiveModule,
  VCardModule,
  VModalModule,
} from '@valtimo/components';
import {
  ButtonModule as CarbonButtonModule,
  IconModule,
  ModalModule as CarbonModalModule,
} from 'carbon-components-angular';

@NgModule({
  providers: [PluginManagementStateService],
  declarations: [
    PluginManagementComponent,
    PluginAddModalComponent,
    PluginAddSelectComponent,
    PluginConfigureComponent,
    PluginEditModalComponent,
    PluginEditComponent,
  ],
  imports: [
    CommonModule,
    PluginManagementRoutingModule,
    TranslateModule,
    PageModule,
    ParagraphModule,
    TitleModule,
    TableModule,
    StepperModule,
    VModalModule,
    ButtonModule,
    VCardModule,
    PluginTranslatePipeModule,
    PluginConfigurationContainerModule,
    CarbonButtonModule,
    CarbonListModule,
    CarbonModalModule,
    IconModule,
    ValtimoCdsModalDirectiveModule,
  ],
  exports: [
    PluginManagementComponent,
    PluginAddModalComponent,
    PluginAddSelectComponent,
    PluginConfigureComponent,
    PluginEditModalComponent,
    PluginEditComponent,
  ],
})
export class PluginManagementModule {}
