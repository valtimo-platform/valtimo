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
import {TranslateModule} from '@ngx-translate/core';
import {
  CarbonMultiInputModule,
  ConfirmationModalModule,
  DropzoneModule,
  ListModule,
  ModalModule,
  MultiselectDropdownModule,
  SpinnerModule,
  ValtimoIbmModalDirectiveModule,
  WidgetModule,
} from '@valtimo/components';
import {ConfigModule} from '@valtimo/config';
import {DossierManagementConnectModalComponent} from './dossier-management-connect-modal/dossier-management-connect-modal.component';
import {DossierManagementDetailComponent} from './dossier-management-detail-container/tabs/dossier-management-detail/dossier-management-detail.component';
import {DossierManagementListComponent} from './dossier-management-list/dossier-management-list.component';
import {DossierManagementRoutingModule} from './dossier-management-routing.module';
import {DossierManagementUploadComponent} from './dossier-management-upload/dossier-management-upload.component';
import {DossierManagementRemoveModalComponent} from './dossier-management-remove-modal/dossier-management-remove-modal.component';
import {NgbTooltipModule} from '@ng-bootstrap/ng-bootstrap';
import {DossierManagementRolesComponent} from './dossier-management-roles/dossier-management-roles.component';
import {DossierManagementLinkProcessComponent} from './dossier-management-link-process/dossier-management-link-process.component';
import {
  FormModule,
  InputModule,
  MultiInputModule,
  ParagraphModule,
  SelectModule,
  TableModule,
  TooltipIconModule,
} from '@valtimo/user-interface';
import {DossierManagementSearchFieldsComponent} from './dossier-management-detail-container/tabs/dossier-management-search-fields/dossier-management-search-fields.component';
import {DossierManagementDetailContainerComponent} from './dossier-management-detail-container/dossier-management-detail-container.component';
import {DossierManagementAssigneeComponent} from './dossier-management-assignee/dossier-management-assignee.component';
import {DossierManagementListColumnsComponent} from './dossier-management-detail-container/tabs/dossier-management-list-columns/dossier-management-list-columns.component';
import {
  ButtonModule,
  CheckboxModule,
  DropdownModule,
  IconModule,
  InputModule as CarbonInputModule,
  LinkModule,
  LoadingModule,
  ModalModule as CarbonModalModule,
  NotificationModule,
} from 'carbon-components-angular';

@NgModule({
  declarations: [
    DossierManagementListComponent,
    DossierManagementDetailComponent,
    DossierManagementConnectModalComponent,
    DossierManagementRemoveModalComponent,
    DossierManagementUploadComponent,
    DossierManagementRolesComponent,
    DossierManagementLinkProcessComponent,
    DossierManagementSearchFieldsComponent,
    DossierManagementDetailContainerComponent,
    DossierManagementAssigneeComponent,
    DossierManagementListColumnsComponent,
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
    MultiInputModule,
    TableModule,
    ValtimoIbmModalDirectiveModule,
  ],
  exports: [],
})
export class DossierManagementModule {}
