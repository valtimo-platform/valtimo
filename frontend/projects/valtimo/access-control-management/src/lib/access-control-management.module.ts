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
import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {
  CarbonListModule,
  ConfirmationModalModule,
  FitPageDirective,
  OverflowMenuComponent,
  OverflowMenuOptionComponent,
  OverflowMenuTriggerComponent,
  RenderInPageHeaderDirective,
  SelectModule,
  TooltipIconModule,
} from '@valtimo/components';
import {AccessControlManagementRoutingModule} from './access-control-management-routing.module';
import {AccessControlOverviewComponent} from './components/overview/access-control-overview.component';
import {RoleMetadataModalComponent} from './components/role-metadata-modal/role-metadata-modal.component';
import {
  AccordionModule,
  ButtonModule,
  CheckboxModule,
  IconModule,
  InputModule,
  LayerModule,
  LoadingModule,
  ModalModule,
  NotificationModule,
  TabsModule,
  TagModule,
  ToggleModule,
} from 'carbon-components-angular';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {AccessControlEditorComponent} from './components/editor/access-control-editor.component';
import {AccessControlFormEditorTabComponent} from './components/access-control-form-editor-tab/access-control-form-editor-tab.component';
import {AccessControlJsonEditorTabComponent} from './components/access-control-json-editor-tab/access-control-json-editor-tab.component';
import {AccessControlOverviewTabComponent} from './components/access-control-overview-tab/access-control-overview-tab.component';
import {ConditionTreeComponent} from './components/condition-tree/condition-tree.component';
import {DeleteRoleModalComponent} from './components/delete-role-modal/delete-role-modal.component';
import {ExportRoleModalComponent} from './components/export-role-modal/export-role-modal.component';
import {PermissionFormComponent} from './components/permission-form/permission-form.component';
import {ActionLabelPipe} from './pipes';

@NgModule({
  declarations: [
    AccessControlOverviewComponent,
    RoleMetadataModalComponent,
    AccessControlEditorComponent,
    AccessControlFormEditorTabComponent,
    ConditionTreeComponent,
    DeleteRoleModalComponent,
    ExportRoleModalComponent,
    PermissionFormComponent,
  ],
  imports: [
    CommonModule,
    AccessControlManagementRoutingModule,
    ButtonModule,
    FormsModule,
    ModalModule,
    TranslateModule,
    ReactiveFormsModule,
    InputModule,
    IconModule,
    ConfirmationModalModule,
    RenderInPageHeaderDirective,
    FitPageDirective,
    LoadingModule,
    IconModule,
    OverflowMenuComponent,
    OverflowMenuOptionComponent,
    OverflowMenuTriggerComponent,
    NotificationModule,
    CarbonListModule,
    SelectModule,
    TooltipIconModule,
    TabsModule,
    ToggleModule,
    AccordionModule,
    CheckboxModule,
    LayerModule,
    TagModule,
    AccessControlJsonEditorTabComponent,
    AccessControlOverviewTabComponent,
    ActionLabelPipe,
  ],
})
export class AccessControlManagementModule {}
