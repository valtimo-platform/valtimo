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

import {Injectable, Injector} from '@angular/core';
import {NGXLogger} from 'ngx-logger';
import {ResourceFile, UploadProvider, UploadService, ResourceDto} from '@valtimo/contract';
import {ConfigService} from '@valtimo/config';
import {Observable} from 'rxjs';
import {OpenZaakUploadService} from './open-zaak-upload.service';
import {S3UploadService} from './s3-upload.service';

@Injectable({
  providedIn: 'root'
})
export class UploadProviderService implements UploadService {

  private readonly uploadService: UploadService;

  constructor(
    private configService: ConfigService,
    private injector: Injector,
    private logger: NGXLogger
  ) {
    this.uploadService = configService.config.uploadProvider === UploadProvider.S3 ?
      injector.get<UploadService>(S3UploadService)
      : injector.get<UploadService>(OpenZaakUploadService);
    this.logger.debug('Loading UploadService as', this.uploadService);
  }

  uploadFile(file: File, documentDefinitionName?: string): Observable<ResourceFile> {
    return this.uploadService.uploadFile(file, documentDefinitionName);
  }

  getResource(resourceId: string): Observable<ResourceDto> {
    return this.uploadService.getResource(resourceId);
  }
}
