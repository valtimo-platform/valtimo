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

import {Injectable, Injector} from '@angular/core';
import {NGXLogger} from 'ngx-logger';
import {DocumentenApiFileReference, ResourceDto, ResourceFile, UploadService} from '../models';
import {ConfigService, UploadProvider} from '@valtimo/config';
import {Observable, of} from 'rxjs';
import {OpenZaakUploadService} from './open-zaak-upload.service';
import {S3UploadService} from './s3-upload.service';

@Injectable({
  providedIn: 'root',
})
export class UploadProviderService implements UploadService {
  private readonly uploadService: UploadService;

  constructor(
    private configService: ConfigService,
    private injector: Injector,
    private logger: NGXLogger
  ) {
    let uploadService: UploadService;

    switch (configService.config.uploadProvider) {
      case UploadProvider.S3:
        uploadService = injector.get<UploadService>(S3UploadService);
        break;
      case UploadProvider.OPEN_ZAAK:
        uploadService = injector.get<UploadService>(OpenZaakUploadService);
        break;
      case UploadProvider.DOCUMENTEN_API:
        uploadService = injector.get<UploadService>(OpenZaakUploadService);
        break;
    }

    this.uploadService = uploadService;
    this.logger.debug('Loading UploadService as', this.uploadService);
  }

  uploadFile(
    file: File,
    documentDefinitionName?: string,
    documentId?: string
  ): Observable<ResourceFile> {
    return this.uploadService.uploadFile(file, documentDefinitionName, documentId);
  }

  getResource(resourceId: string): Observable<ResourceDto> {
    return this.uploadService.getResource(resourceId);
  }

  checkUploadProcessLink(caseDefinitionKey: string): Observable<boolean> {
    if (this.uploadService.checkUploadProcessLink) {
      return this.uploadService.checkUploadProcessLink(caseDefinitionKey);
    }

    return of(false);
  }

  uploadFileWithMetadata(
    file: File,
    documentId: string,
    metadata: {[key: string]: any}
  ): Observable<void> {
    if (this.uploadService.uploadFileWithMetadata) {
      return this.uploadService.uploadFileWithMetadata(file, documentId, metadata);
    }

    return of(null);
  }

  uploadTempFileWithMetadata(
    file: File,
    metadata: {[key: string]: any}
  ): Observable<DocumentenApiFileReference> {
    if (this.uploadService.uploadTempFileWithMetadata) {
      return this.uploadService.uploadTempFileWithMetadata(file, metadata);
    }

    return of(null);
  }
}
