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

import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {DocumentenApiConfigurationComponent} from './components/documenten-api-configuration/documenten-api-configuration.component';
import {PluginTranslatePipeModule} from '../../pipes';
import {FormModule, InputModule, ParagraphModule, RadioModule, SelectModule} from '@valtimo/components';
import {StoreTempDocumentConfigurationComponent} from './components/store-temp-document/store-temp-document-configuration.component';
import {StoreUploadedDocumentConfigurationComponent} from './components/store-uploaded-document/store-uploaded-document-configuration.component';
import {DownloadDocumentConfigurationComponent} from './components/download-document/download-document-configuration.component';
import {StoreUploadedDocumentInPartsConfigurationComponent} from './components/store-uploaded-document-in-parts/store-uploaded-document-in-parts-configuration.component';
import {LinkDocumentToObjectConfigurationComponent} from './components/link-document-to-object/link-document-to-object-configuration.component';
import {DeleteDocumentLinkConfigurationComponent} from './components/delete-document-link/delete-document-link-configuration.component';
import {GetAuditTrailConfigurationComponent} from './components/get-audit-trail/get-audit-trail-configuration.component';

@NgModule({
  declarations: [
    DocumentenApiConfigurationComponent,
    StoreTempDocumentConfigurationComponent,
    StoreUploadedDocumentConfigurationComponent,
    StoreUploadedDocumentInPartsConfigurationComponent,
    DownloadDocumentConfigurationComponent,
    LinkDocumentToObjectConfigurationComponent,
    DeleteDocumentLinkConfigurationComponent,
    GetAuditTrailConfigurationComponent,
  ],
  imports: [
    CommonModule,
    PluginTranslatePipeModule,
    FormModule,
    InputModule,
    SelectModule,
    ParagraphModule,
    RadioModule,
  ],
  exports: [
    DocumentenApiConfigurationComponent,
    StoreTempDocumentConfigurationComponent,
    StoreUploadedDocumentConfigurationComponent,
    StoreUploadedDocumentInPartsConfigurationComponent,
    DownloadDocumentConfigurationComponent,
    LinkDocumentToObjectConfigurationComponent,
    DeleteDocumentLinkConfigurationComponent,
    GetAuditTrailConfigurationComponent,
  ],
})
export class DocumentenApiPluginModule {}
