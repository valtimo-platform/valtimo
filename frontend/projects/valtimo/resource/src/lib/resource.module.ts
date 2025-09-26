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
import {OpenZaakUploadService} from './services/open-zaak-upload.service';
import {S3UploadService} from './services/s3-upload.service';
import {UploadProviderService} from './services/upload-provider.service';
import {OpenZaakService} from './services/open-zaak.service';
import {S3Service} from './services/s3.service';
import {DownloadService} from './services/download.service';

@NgModule({
  declarations: [],
  imports: [],
  exports: [],
  providers: [
    OpenZaakUploadService,
    S3UploadService,
    UploadProviderService,
    OpenZaakService,
    S3Service,
    DownloadService,
  ],
})
export class ResourceModule {}
