/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
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

import {Component} from '@angular/core';
import {ConfigService, UploadProvider} from '@valtimo/config';

@Component({
  selector: 'valtimo-dossier-detail-tab-documents',
  templateUrl: './documents.component.html',
  styleUrls: ['./documents.component.css'],
})
export class DossierDetailTabDocumentsComponent {
  openZaakUploadProvider!: boolean;
  s3UploadProvider!: boolean;

  constructor(private readonly configService: ConfigService) {
    this.setUploaderProvider(configService.config.uploadProvider);
  }

  private setUploaderProvider(uploadProvider: UploadProvider): void {
    this.openZaakUploadProvider = uploadProvider === UploadProvider.OPEN_ZAAK;
    this.s3UploadProvider = uploadProvider === UploadProvider.S3;
  }
}
