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
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {NgbTooltipModule} from '@ng-bootstrap/ng-bootstrap';
import {TranslateModule} from '@ngx-translate/core';
import {
  CarbonListModule,
  CarbonMultiInputModule,
  ConfirmationModalModule,
  DropzoneModule,
  EditorModule,
  EllipsisPipe,
  FormModule,
  InputModule,
  ModalModule,
  MultiselectDropdownModule,
  MuuriDirectiveModule,
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
import {FormManagementComponent} from '@valtimo/form-management';
import {ConfigModule} from '@valtimo/shared';
import {
  ButtonModule,
  CheckboxModule,
  ComboBoxModule,
  DialogModule,
  DropdownModule,
  FileUploaderModule,
  IconModule,
  InputModule as CarbonInputModule,
  LayerModule,
  LinkModule,
  LoadingModule,
  ModalModule as CarbonModalModule,
  NotificationModule,
  NumberModule,
  ProgressBarModule,
  TabsModule,
  TagModule,
  ToggleModule,
  TooltipModule,
} from 'carbon-components-angular';
import {CaseManagementRoutingModule} from './case-management-routing.module';
import {CaseManagementAssigneeComponent} from './components/case-management-assignee/case-management-assignee.component';
import {CaseManagementCaseDetailComponent} from './components/case-management-case-detail/case-management-case-detail.component';
import {CaseManagementCaseListComponent} from './components/case-management-case-list/case-management-case-list.component';
import {CaseManagementConnectModalComponent} from './components/case-management-connect-modal/case-management-connect-modal.component';
import {CaseManagementCreateDraftVersionComponent} from './components/case-management-create-draft-version/case-management-create-draft-version.component';
import {CaseManagementCreateComponent} from './components/case-management-create/case-management-create.component';
import {CaseManagementDeploymentComponent} from './components/case-management-deployment/case-management-deployment.component';
import {CaseManagementDetailActionsComponent} from './components/case-management-detail-actions/case-management-detail-actions.component';
import {CaseManagementDetailComponent} from './components/case-management-detail/case-management-detail.component';
import {CaseManagementDocumentDefinitionComponent} from './components/case-management-detail/tabs/case-management-document-definition/case-management-document-definition.component';
import {CaseManagementGeneralComponent} from './components/case-management-detail/tabs/case-management-general/case-management-general.component';
import {CaseManagementCaseHandlerComponent} from './components/case-management-detail/tabs/case-management-general/components/case-management-case-handler/case-management-case-handler.component';
import {CaseManagementExternalStartFormComponent} from './components/case-management-detail/tabs/case-management-general/components/case-management-external-start-form/case-management-external-start-form.component';
import {CaseManagementListColumnsComponent} from './components/case-management-detail/tabs/case-management-list-columns/case-management-list-columns.component';
import {CaseManagementSearchFieldsComponent} from './components/case-management-detail/tabs/case-management-search-fields/case-management-search-fields.component';
import {CaseManagementStatusModalComponent} from './components/case-management-detail/tabs/case-management-statuses/case-management-status-modal/case-management-status-modal.component';
import {CaseManagementStatusesComponent} from './components/case-management-detail/tabs/case-management-statuses/case-management-statuses.component';
import {CaseManagementAddTabModalComponent} from './components/case-management-detail/tabs/case-management-tabs/case-management-add-tab-modal/case-management-add-tab-modal.component';
import {CaseManagementEditTabModalComponent} from './components/case-management-detail/tabs/case-management-tabs/case-management-edit-tab-modal/case-management-edit-tab-modal.component';
import {CaseManagementTabsComponent} from './components/case-management-detail/tabs/case-management-tabs/case-management-tabs.component';
import {TabFormComponent} from './components/case-management-detail/tabs/case-management-tabs/tab-form/tab-form.component';
import {CaseManagementWidgetsEditorComponent} from './components/case-management-detail/tabs/case-management-tabs/widget-tab/case-management-widget-tab/editor/case-management-widgets-editor.component';
import {CaseManagementTagsModalComponent} from './components/case-management-detail/tabs/case-management-tags/case-management-tags-modal/case-management-tags-modal.component';
import {CaseManagementTagsComponent} from './components/case-management-detail/tabs/case-management-tags/case-management-tags.component';
import {CaseManagementListComponent} from './components/case-management-list/case-management-list.component';
import {CaseManagementRemoveModalComponent} from './components/case-management-remove-modal/case-management-remove-modal.component';
import {CaseManagementSelectVersionModalComponent} from './components/case-management-select-version-modal/case-management-select-version-modal.component';
import {CaseManagementUploadComponent} from './components/case-management-upload/case-management-upload.component';
import {CaseManagementUploadStepComponent} from './components/case-management-upload/step/case-management-upload-step.component';
import {TabManagementService} from './services';

@NgModule({
  declarations: [
    CaseManagementListComponent,
    CaseManagementConnectModalComponent,
    CaseManagementRemoveModalComponent,
    CaseManagementSelectVersionModalComponent,
    CaseManagementUploadComponent,
    CaseManagementSearchFieldsComponent,
    CaseManagementDetailComponent,
    CaseManagementAssigneeComponent,
    CaseManagementListColumnsComponent,
    CaseManagementTabsComponent,
    CaseManagementAddTabModalComponent,
    TabFormComponent,
    CaseManagementEditTabModalComponent,
    CaseManagementDetailActionsComponent,
    CaseManagementDocumentDefinitionComponent,
    CaseManagementUploadStepComponent,
    CaseManagementStatusesComponent,
    CaseManagementStatusModalComponent,
    CaseManagementCreateComponent,
    CaseManagementGeneralComponent,
    CaseManagementCaseHandlerComponent,
    CaseManagementExternalStartFormComponent,
    CaseManagementDeploymentComponent,
    CaseManagementTagsComponent,
    CaseManagementTagsModalComponent,
    CaseManagementCreateDraftVersionComponent,
    CaseManagementCaseListComponent,
    CaseManagementCaseDetailComponent,
  ],
  imports: [
    CommonModule,
    WidgetModule,
    DropzoneModule,
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
    LayerModule,
    FormManagementComponent,
    EllipsisPipe,
    MuuriDirectiveModule,
    NumberModule,
  ],
  providers: [TabManagementService],
})
export class CaseManagementModule {}
