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
import {FormLinkProcessDiagramComponent} from './components/form-link-process-diagram/form-link-process-diagram.component';
import {CommonModule} from '@angular/common';
import {ProcessLinkRoutingModule} from './process-link-routing.module';
import {FormsModule} from '@angular/forms';
import {
  ButtonModule,
  FormIoModule,
  ModalModule,
  ParagraphModule,
  RenderInPageHeaderDirectiveModule,
  SearchableDropdownSelectModule,
  StepperModule,
  TitleModule,
  TooltipIconModule,
  TooltipModule,
  ValtimoCdsModalDirectiveModule,
  VCardModule,
  VModalModule,
} from '@valtimo/components';
import {TranslateModule} from '@ngx-translate/core';
import {SelectPluginConfigurationComponent} from './components/select-plugin-configuration/select-plugin-configuration.component';
import {SelectPluginActionComponent} from './components/select-plugin-action/select-plugin-action.component';
import {PluginConfigurationContainerModule, PluginTranslatePipeModule} from '@valtimo/plugin';
import {PluginActionConfigurationComponent} from './components/plugin-action-configuration/plugin-action-configuration.component';
import {ProcessLinkComponent} from './components/process-link/process-link.component';
import {ProcessLinkModalComponent} from './components/process-link-modal/process-link-modal.component';
import {
  ButtonModule as CarbonButtonModule,
  ComboBoxModule,
  IconModule,
  InputModule,
  LoadingModule,
  ModalModule as CarbonModalModule,
  ProgressIndicatorModule,
  SelectModule,
  StructuredListModule,
  TilesModule,
} from 'carbon-components-angular';
import {ChooseProcessLinkTypeComponent} from './components/choose-process-link-type';
import {SelectFormComponent} from './components/select-form';
import {FormFlowComponent} from './components/form-flow/form-flow.component';
import {SelectFormFlowComponent} from './components/select-form-flow';
import {FormFlowConfigurationContainerComponent} from './components/form-flow-configuration-container';

@NgModule({
  declarations: [
    ProcessLinkComponent,
    FormLinkProcessDiagramComponent,
    SelectPluginConfigurationComponent,
    SelectPluginActionComponent,
    PluginActionConfigurationComponent,
    ProcessLinkModalComponent,
    ChooseProcessLinkTypeComponent,
    SelectFormComponent,
    FormFlowComponent,
    SelectFormFlowComponent,
    FormFlowConfigurationContainerComponent,
  ],
  imports: [
    CommonModule,
    ProcessLinkRoutingModule,
    FormsModule,
    ModalModule,
    SearchableDropdownSelectModule,
    TranslateModule,
    StepperModule,
    VModalModule,
    VCardModule,
    PluginTranslatePipeModule,
    ParagraphModule,
    PluginConfigurationContainerModule,
    ButtonModule,
    TitleModule,
    CarbonModalModule,
    ProgressIndicatorModule,
    CarbonButtonModule,
    IconModule,
    TooltipModule,
    ComboBoxModule,
    InputModule,
    TooltipIconModule,
    LoadingModule,
    FormIoModule,
    ValtimoCdsModalDirectiveModule,
    StructuredListModule,
    TilesModule,
    RenderInPageHeaderDirectiveModule,
    SelectModule,
  ],
  exports: [
    ProcessLinkComponent,
    SelectPluginConfigurationComponent,
    SelectPluginActionComponent,
    PluginActionConfigurationComponent,
    ProcessLinkModalComponent,
    FormFlowComponent,
  ],
})
export class ProcessLinkModule {}
