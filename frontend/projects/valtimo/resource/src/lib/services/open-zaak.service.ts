/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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
import {HttpClient, HttpHeaders} from '@angular/common/http';
import {ConfigService, InterceptorSkip, Page} from '@valtimo/shared';
import {map, Observable} from 'rxjs';
import {
  CreateZaakTypeLinkRequest,
  DocumentenApiFileReference,
  ResourceDto,
  ResourceReference,
  ZaakType,
  ZaakTypeLink,
} from '../models';

@Injectable({
  providedIn: 'root',
})
export class OpenZaakService {
  private valtimoApiConfig: any;

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.valtimoApiConfig = this.configService.config.valtimoApi;
  }

  public getResource(resourceId: string): Observable<ResourceDto> {
    return this.http.get<ResourceDto>(
      `${this.valtimoApiConfig.endpointUri}v1/resource/${resourceId}`
    );
  }

  public getResources(documentId: string): Observable<Array<ResourceReference>> {
    return this.http
      .get<
        Page<any>
      >(`${this.valtimoApiConfig.endpointUri}v2/zaken-api/document/${documentId}/files`)
      .pipe(
        map(page =>
          page.content.map(file => ({
            filename: file.bestandsnaam,
            id: file.fileId,
          }))
        )
      );
  }

  public getZaakTypes(): Observable<ZaakType[]> {
    return this.http.get<ZaakType[]>(
      `${this.valtimoApiConfig.endpointUri}management/v1/zgw/zaaktype`
    );
  }

  public getZaakTypeLink(
    caseDefinitionKey: string,
    caseVersionTag: string
  ): Observable<ZaakTypeLink> {
    return this.http.get<ZaakTypeLink>(
      `${this.valtimoApiConfig.endpointUri}management/v1/case-definition/${caseDefinitionKey}/version/${caseVersionTag}/zaak-type-link`
    );
  }

  public createZaakTypeLink(request: CreateZaakTypeLinkRequest): Observable<any> {
    return this.http.post<any>(
      `${this.valtimoApiConfig.endpointUri}management/v1/case-definition/${request.caseDefinitionKey}/version/${request.caseVersionTag}/zaak-type-link`,
      request
    );
  }
  public deleteZaakTypeLink(caseDefinitionKey: string, caseVersionTag: string): Observable<any> {
    return this.http.delete<any>(
      `${this.valtimoApiConfig.endpointUri}management/v1/case-definition/${caseDefinitionKey}/version/${caseVersionTag}/zaak-type-link`
    );
  }

  public getZaakTypeLinkListByProcess(
    processDefinitionKey: string
  ): Observable<Array<ZaakTypeLink>> {
    return this.http.get<Array<ZaakTypeLink>>(
      `${this.valtimoApiConfig.endpointUri}management/v1/zaak-type-link/process/${processDefinitionKey}`
    );
  }

  public upload(file: File, caseDefinitionKey: string): Observable<DocumentenApiFileReference> {
    return this.uploadTempFileWithMetadata(file, {caseDefinitionKey});
  }

  public uploadWithMetadata(
    file: File,
    documentId: string,
    metadata: {[key: string]: any}
  ): Observable<void> {
    const formData: FormData = new FormData();
    formData.append('file', file);
    formData.append('documentId', documentId);

    Object.keys(metadata).forEach(metaDataKey => {
      const metadataValue = metadata[metaDataKey];

      if (metadataValue) {
        formData.append(metaDataKey, metadataValue);
      }
    });

    return this.http.post<void>(`${this.valtimoApiConfig.endpointUri}v1/resource/temp`, formData, {
      reportProgress: true,
      responseType: 'json',
      headers: new HttpHeaders().set(InterceptorSkip, '403'),
    });
  }

  public uploadTempFileWithMetadata(
    file: File,
    metadata: {[key: string]: any}
  ): Observable<DocumentenApiFileReference> {
    const formData: FormData = new FormData();
    formData.append('file', file);

    Object.keys(metadata).forEach(metaDataKey => {
      const metadataValue = metadata[metaDataKey];

      if (metadataValue) {
        formData.append(metaDataKey, metadataValue);
      }
    });

    return this.http.post<DocumentenApiFileReference>(
      `${this.valtimoApiConfig.endpointUri}v1/resource/temp`,
      formData,
      {
        reportProgress: true,
        responseType: 'json',
        headers: new HttpHeaders().set(InterceptorSkip, '403'),
      }
    );
  }
}
