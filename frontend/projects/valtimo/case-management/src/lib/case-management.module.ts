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
import {CommonModule} from '@angular/common';
import {NgModule} from '@angular/core';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {NgbTooltipModule} from '@ng-bootstrap/ng-bootstrap';
import {TranslateModule} from '@ngx-translate/core';
import {
  CarbonListModule,
  CarbonMultiInputModule,
  ConfirmationModalModule,
  DropzoneModule,
  EditorModule,
  FormModule,
  InputModule,
  ListModule,
  ModalModule,
  MultiselectDropdownModule,
  ParagraphModule,
  RenderInPageHeaderDirectiveModule,
  SelectModule,
  SpinnerModule,
  TableModule,
  TooltipIconModule,
  ValtimoCdsModalDirectiveModule,
  ValtimoCdsOverflowButtonDirectiveModule,
  ValuePathSelectorComponent,
  WidgetModule,
} from '@valtimo/components';
import {ConfigModule} from '@valtimo/config';
import {
  ButtonModule,
  CheckboxModule,
  ComboBoxModule,
  DialogModule,
  DropdownModule,
  FileUploaderModule,
  IconModule,
  InputModule as CarbonInputModule,
  LinkModule,
  LoadingModule,
  ModalModule as CarbonModalModule,
  NotificationModule,
  ProgressBarModule,
  TabsModule,
  TagModule,
  ToggleModule,
  TooltipModule,
} from 'carbon-components-angular';

import {CaseManagementAssigneeComponent} from './components/case-management-assignee/case-management-assignee.component';
import {CaseManagementConnectModalComponent} from './components/case-management-connect-modal/case-management-connect-modal.component';
import {CaseManagementDetailContainerActionsComponent} from './components/case-management-detail-container-actions/case-management-detail-container-actions.component';
import {CaseManagementDetailContainerComponent} from './components/case-management-detail-container/case-management-detail-container.component';
import {CaseManagementDetailComponent} from './components/case-management-detail/case-management-detail.component';
import {CaseManagementDocumentDefinitionComponent} from './components/case-management-document-definition/case-management-document-definition.component';
import {CaseManagementListColumnsComponent} from './components/case-management-list-columns/case-management-list-columns.component';
import {CaseManagementListComponent} from './components/case-management-list/case-management-list.component';
import {CaseManagementRemoveModalComponent} from './components/case-management-remove-modal/case-management-remove-modal.component';
import {CaseManagementSearchFieldsComponent} from './components/case-management-search-fields/case-management-search-fields.component';
import {CaseManagementAddTabModalComponent} from './components/case-management-tabs/case-management-add-tab-modal/case-management-add-tab-modal.component';
import {CaseManagementEditTabModalComponent} from './components/case-management-tabs/case-management-edit-tab-modal/case-management-edit-tab-modal.component';
import {CaseManagementTabsComponent} from './components/case-management-tabs/case-management-tabs.component';
import {TabFormComponent} from './components/case-management-tabs/tab-form/tab-form.component';
import {CaseManagementUploadComponent} from './components/case-management-upload/case-management-upload.component';
import {CaseManagementUploadStepComponent} from './components/case-management-upload/step/case-management-upload-step.component';
import {CaseManagementRoutingModule} from './case-management-routing.module';
import {TabManagementService} from './services';
import {CaseManagementStatusesComponent} from './components/case-management-statuses/case-management-statuses.component';
import {CaseManagementStatusModalComponent} from './components/case-management-statuses/case-management-status-modal/case-management-status-modal.component';
import {CaseManagementCreateComponent} from './components/case-management-create/case-management-create.component';
import {CaseManagementWidgetsEditorComponent} from './components/case-management-widget-tab/editor/case-management-widgets-editor.component';
import { CaseManagementProcessesComponent } from './components/case-management-processes/case-management-processes.component';

@NgModule({
  declarations: [
    CaseManagementListComponent,
    CaseManagementDetailComponent,
    CaseManagementConnectModalComponent,
    CaseManagementRemoveModalComponent,
    CaseManagementUploadComponent,
    CaseManagementSearchFieldsComponent,
    CaseManagementDetailContainerComponent,
    CaseManagementAssigneeComponent,
    CaseManagementListColumnsComponent,
    CaseManagementTabsComponent,
    CaseManagementAddTabModalComponent,
    TabFormComponent,
    CaseManagementEditTabModalComponent,
    CaseManagementDetailContainerActionsComponent,
    CaseManagementDocumentDefinitionComponent,
    CaseManagementUploadStepComponent,
    CaseManagementStatusesComponent,
    CaseManagementStatusModalComponent,
    CaseManagementCreateComponent,
  ],
  imports: [
    CommonModule,
    WidgetModule,
    DropzoneModule,
    ListModule,
    CaseManagementRoutingModule,
    FormsModule,
    TranslateModule,
    ModalModule,
    ConfigModule,
    NgbTooltipModule,
    MultiselectDropdownModule,
    ParagraphModule,
    SelectModule,
    SpinnerModule,
    InputModule,
    SelectModule,
    FormModule,
    NotificationModule,
    ButtonModule,
    IconModule,
    CarbonModalModule,
    CarbonInputModule,
    ReactiveFormsModule,
    DropdownModule,
    CheckboxModule,
    TooltipIconModule,
    CarbonMultiInputModule,
    LoadingModule,
    LinkModule,
    ConfirmationModalModule,
    TableModule,
    ValtimoCdsModalDirectiveModule,
    CarbonListModule,
    ComboBoxModule,
    RenderInPageHeaderDirectiveModule,
    DialogModule,
    ValtimoCdsOverflowButtonDirectiveModule,
    NotificationModule,
    EditorModule,
    CarbonListModule,
    TabsModule,
    TagModule,
    FileUploaderModule,
    ProgressBarModule,
    ConfirmationModalModule,
    ToggleModule,
    TooltipModule,
    CaseManagementWidgetsEditorComponent,
    ValuePathSelectorComponent,
    CaseManagementProcessesComponent
  ],
  providers: [TabManagementService],
})
export class CaseManagementModule {}
