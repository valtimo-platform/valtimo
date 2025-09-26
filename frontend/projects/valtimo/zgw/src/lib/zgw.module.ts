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
import {
  CustomerModule,
  DocumentenApiMetadataModalComponent,
  DocumentenApiUploaderComponent,
  DocumentenApiVersionComponent,
  DossierDetailTabDocumentenApiDocumentsComponent,
  DossierDetailTabObjectTypeComponent,
  DossierManagementLinkProcessComponent,
  DocumentObjectenApiSyncComponent,
  ZakenApiZaaktypeLinkComponent,
} from './modules';
import {
  ZGW_CASE_CONFIGURATION_EXTENSIONS_TOKEN,
  ZGW_DOCUMENTEN_API_DOCUMENTS_COMPONENT_TOKEN,
  ZGW_OBJECT_TYPE_COMPONENT_TOKEN,
} from '@valtimo/config';
import {CommonModule} from '@angular/common';
import {FormioModule} from '@formio/angular';
import {TranslateModule} from '@ngx-translate/core';
import {RouterModule} from '@angular/router';
import {DropzoneModule, FileSizeModule} from '@valtimo/components';
import {DocumentModule} from '@valtimo/document';
import {ResourceModule} from '@valtimo/resource';

@NgModule({
  imports: [
    CommonModule,
    FormioModule,
    DropzoneModule,
    TranslateModule,
    DocumentModule,
    FileSizeModule,
    ResourceModule,
    RouterModule,
    DocumentenApiMetadataModalComponent,
    CustomerModule,
  ],
  declarations: [DocumentenApiUploaderComponent],
  exports: [DocumentenApiUploaderComponent],
  providers: [
    {
      provide: ZGW_OBJECT_TYPE_COMPONENT_TOKEN,
      useValue: DossierDetailTabObjectTypeComponent,
    },
    {
      provide: ZGW_DOCUMENTEN_API_DOCUMENTS_COMPONENT_TOKEN,
      useValue: DossierDetailTabDocumentenApiDocumentsComponent,
    },
    {
      provide: ZGW_CASE_CONFIGURATION_EXTENSIONS_TOKEN,
      useValue: [
        DossierManagementLinkProcessComponent,
        DocumentenApiVersionComponent,
        DocumentObjectenApiSyncComponent,
        ZakenApiZaaktypeLinkComponent,
      ],
    },
  ],
})
export class ZgwModule {}
