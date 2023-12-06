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
  WidgetModule,
} from '@valtimo/components';
import {ConfigModule} from '@valtimo/config';
import {
  ButtonModule,
  CheckboxModule,
  ComboBoxModule,
  DialogModule,
  DropdownModule,
  IconModule,
  InputModule as CarbonInputModule,
  LinkModule,
  LoadingModule,
  ModalModule as CarbonModalModule,
  NotificationModule,
} from 'carbon-components-angular';
import {DossierManagementAssigneeComponent} from './components/dossier-management-assignee/dossier-management-assignee.component';
import {DossierManagementConnectModalComponent} from './components/dossier-management-connect-modal/dossier-management-connect-modal.component';
import {DossierManagementDetailContainerComponent} from './components/dossier-management-detail-container/dossier-management-detail-container.component';
import {DossierManagementDetailComponent} from './components/dossier-management-detail/dossier-management-detail.component';
import {DossierManagementLinkProcessComponent} from './components/dossier-management-link-process/dossier-management-link-process.component';
import {DossierManagementListColumnsComponent} from './components/dossier-management-list-columns/dossier-management-list-columns.component';
import {DossierManagementListComponent} from './components/dossier-management-list/dossier-management-list.component';
import {DossierManagementRemoveModalComponent} from './components/dossier-management-remove-modal/dossier-management-remove-modal.component';
import {DossierManagementSearchFieldsComponent} from './components/dossier-management-search-fields/dossier-management-search-fields.component';
import {DossierManagementAddTabModalComponent} from './components/dossier-management-tabs/dossier-management-add-tab-modal/dossier-management-add-tab-modal.component';
import {DossierManagementTabsComponent} from './components/dossier-management-tabs/dossier-management-tabs.component';
import {TabFormComponent} from './components/dossier-management-tabs/tab-form/tab-form.component';
import {DossierManagementUploadComponent} from './components/dossier-management-upload/dossier-management-upload.component';
import {DossierManagementRoutingModule} from './dossier-management-routing.module';
import {TabManagementService} from './services';
import {DossierManagementEditTabModalComponent} from './components/dossier-management-tabs/dossier-management-edit-tab-modal/dossier-management-edit-tab-modal.component';
import {DossierManagementDetailContainerActionsComponent} from './components/dossier-management-detail-container-actions/dossier-management-detail-container-actions';
import {DossierManagementDocumentDefinitionComponent} from './components/dossier-management-document-definition/dossier-management-document-definition';

@NgModule({
  declarations: [
    DossierManagementListComponent,
    DossierManagementDetailComponent,
    DossierManagementConnectModalComponent,
    DossierManagementRemoveModalComponent,
    DossierManagementUploadComponent,
    DossierManagementLinkProcessComponent,
    DossierManagementSearchFieldsComponent,
    DossierManagementDetailContainerComponent,
    DossierManagementAssigneeComponent,
    DossierManagementListColumnsComponent,
    DossierManagementTabsComponent,
    DossierManagementAddTabModalComponent,
    TabFormComponent,
    DossierManagementEditTabModalComponent,
    DossierManagementDetailContainerActionsComponent,
    DossierManagementDocumentDefinitionComponent,
  ],
  imports: [
    CommonModule,
    WidgetModule,
    DropzoneModule,
    ListModule,
    DossierManagementRoutingModule,
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
    CarbonMultiInputModule,
    TableModule,
    ValtimoCdsModalDirectiveModule,
    CarbonListModule,
    ComboBoxModule,
    RenderInPageHeaderDirectiveModule,
    DialogModule,
    ValtimoCdsOverflowButtonDirectiveModule,
    NotificationModule,
    EditorModule,
  ],
  providers: [TabManagementService],
})
export class DossierManagementModule {}
