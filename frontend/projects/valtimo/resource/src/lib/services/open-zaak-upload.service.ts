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

import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {ConfigService} from '@valtimo/config';
import {Observable} from 'rxjs';
import {
  DocumentenApiFileReference,
  OpenZaakResource,
  ResourceDto,
  ResourceFile,
  UploadService,
} from '../models';
import {OpenZaakService} from './open-zaak.service';
import {map} from 'rxjs/operators';

@Injectable()
export class OpenZaakUploadService implements UploadService {
  private valtimoApiConfig: any;

  constructor(
    private readonly openZaakService: OpenZaakService,
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.valtimoApiConfig = configService.config.valtimoApi;
  }

  uploadFile(file: File, documentDefinitionName: string): Observable<ResourceFile> {
    return this.openZaakService
      .upload(new File([file], file.name, {type: file.type}), documentDefinitionName)
      .pipe(map(result => this.getResourceFile(result)));
  }

  uploadFileWithMetadata(
    file: File,
    documentId: string,
    metadata: {[key: string]: any}
  ): Observable<void> {
    return this.openZaakService.uploadWithMetadata(
      new File([file], file.name, {type: file.type}),
      documentId,
      metadata
    );
  }

  uploadTempFileWithMetadata(
    file: File,
    metadata: {[key: string]: any}
  ): Observable<DocumentenApiFileReference> {
    return this.openZaakService.uploadTempFileWithMetadata(
      new File([file], file.name, {type: file.type}),
      metadata
    );
  }

  getResource(resourceId: string): Observable<ResourceDto> {
    return this.openZaakService.getResource(resourceId);
  }

  checkUploadProcessLink(caseDefinitionKey: string): Observable<boolean> {
    return this.http
      .get<{
        processCaseLinkExists: boolean;
      }>(
        `${this.valtimoApiConfig.endpointUri}v1/uploadprocess/case/${caseDefinitionKey}/check-link`
      )
      .pipe(map(res => res.processCaseLinkExists));
  }

  private getResourceFile(result: OpenZaakResource): ResourceFile {
    return {
      customUpload: true,
      originalName: result.name,
      size: result.sizeInBytes,
      url: '/api/resource/' + result.resourceId + '/download',
      storage: 'openZaak',
      type: result.extension,
      data: {
        createdOn: result.createdOn as any as string,
        name: result.name,
        sizeInBytes: result.sizeInBytes,
        resourceId: result.resourceId,
        extension: result.extension,
      },
    };
  }
}
