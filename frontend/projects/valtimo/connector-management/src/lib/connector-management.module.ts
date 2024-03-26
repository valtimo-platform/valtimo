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
import {ConnectorManagementRoutingModule} from './connector-management-routing';
import {CommonModule} from '@angular/common';
import {TranslateModule} from '@ngx-translate/core';
import {
  FormIoModule,
  ListModule,
  ModalModule,
  SpinnerModule,
  WidgetModule,
  ButtonModule,
  VCardModule,
  InputModule,
  VModalModule,
  PageModule,
  ParagraphModule,
  StepperModule,
  TableModule,
  TitleModule,
} from '@valtimo/components';
import {ConnectorManagementStateService} from './services/connector-management-state/connector-management-state.service';
import {ConnectorManagementComponent} from './components/connector-management/connector-management.component';
import {ConnectorLinkExtensionModalComponent} from './components/connector-link-extension-modal/connector-link-extension-modal.component';
import {AddConnectorSelectComponent} from './components/add-connector-select/add-connector-select.component';
import {ModifyConnectorComponent} from './components/modify-connector/modify-connector.component';
import {ConnectorModalComponent} from './components/connector-modal/connector-modal.component';
import {EditConnectorPropertiesComponent} from './components/edit-connector-properties/edit-connector-properties.component';
import {ConnectorLinkExtensionComponent} from './components/connector-link-extension/connector-link-extension.component';
import {MultiValueConnectorPropertyComponent} from './components/multi-value-connector-property/multi-value-connector-property.component';
import {EditProductAanvragenConnectorComponent} from './components/edit-product-aanvragen-connector/edit-product-aanvragen-connector.component';
import {EditConnectorFormComponent} from './components/edit-connector-form/edit-connector-form.component';
import {EditTaakConnectorComponent} from './components/edit-taak-connector/edit-taak-connector.component';
import {AddConnectorConfigureComponent} from './components/add-connector-configure/add-connector-configure.component';

/**
 * @deprecated Use the new plugin framework
 */
@NgModule({
  providers: [ConnectorManagementStateService],
  declarations: [
    ConnectorManagementComponent,
    AddConnectorSelectComponent,
    AddConnectorConfigureComponent,
    ConnectorModalComponent,
    ModifyConnectorComponent,
    EditConnectorPropertiesComponent,
    MultiValueConnectorPropertyComponent,
    ConnectorLinkExtensionComponent,
    ConnectorLinkExtensionModalComponent,
    EditProductAanvragenConnectorComponent,
    EditConnectorFormComponent,
    EditTaakConnectorComponent,
  ],
  imports: [
    CommonModule,
    ConnectorManagementRoutingModule,
    TranslateModule,
    WidgetModule,
    ListModule,
    SpinnerModule,
    ModalModule,
    FormIoModule,
    ButtonModule,
    TableModule,
    VModalModule,
    StepperModule,
    VCardModule,
    TitleModule,
    InputModule,
    PageModule,
    ParagraphModule,
  ],
  exports: [
    ConnectorManagementComponent,
    AddConnectorSelectComponent,
    AddConnectorConfigureComponent,
    ConnectorModalComponent,
    ModifyConnectorComponent,
    EditConnectorPropertiesComponent,
    MultiValueConnectorPropertyComponent,
    ConnectorLinkExtensionComponent,
    ConnectorLinkExtensionModalComponent,
    EditProductAanvragenConnectorComponent,
    EditTaakConnectorComponent,
  ],
})
export class ConnectorManagementModule {}
