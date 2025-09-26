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
import {
  CarbonListModule,
  ConfirmationModalModule,
  EditorModule,
  RenderInPageHeaderDirectiveModule,
} from '@valtimo/components';
import {TemplateManagementRoutingModule} from './template-management-routing.module';
import {TemplateOverviewComponent} from './components/overview/template-overview.component';
import {
  ButtonModule,
  DialogModule,
  IconModule,
  InputModule,
  LoadingModule,
  ModalModule,
  NotificationModule,
} from 'carbon-components-angular';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {TemplateEditorComponent} from './components/editor/template-editor.component';
import {DeleteTemplateModalComponent} from './components/delete-template-modal/delete-template-modal.component';
import {TemplateMetadataModalComponent} from './components/template-metadata-modal/template-metadata-modal.component';

@NgModule({
  declarations: [
    TemplateOverviewComponent,
    TemplateEditorComponent,
    DeleteTemplateModalComponent,
    TemplateMetadataModalComponent,
  ],
  imports: [
    CommonModule,
    TemplateManagementRoutingModule,
    ButtonModule,
    FormsModule,
    ModalModule,
    TranslateModule,
    ReactiveFormsModule,
    InputModule,
    IconModule,
    ConfirmationModalModule,
    EditorModule,
    RenderInPageHeaderDirectiveModule,
    LoadingModule,
    IconModule,
    DialogModule,
    NotificationModule,
    CarbonListModule,
  ],
})
export class TemplateManagementModule {}
