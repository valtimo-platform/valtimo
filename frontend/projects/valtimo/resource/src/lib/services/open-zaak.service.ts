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
  CreateInformatieObjectTypeLinkRequest,
  CreateZaakTypeLinkRequest,
  DocumentenApiFileReference,
  InformatieObjectType,
  InformatieObjectTypeLink,
  OpenZaakConfig,
  OpenZaakResource,
  ResourceDto,
  ZaakType,
  ZaakTypeLink,
  ZaakTypeRequest,
} from '../models';

@Injectable({
  providedIn: 'root',
})
export class OpenZaakService {
  private valtimoApiConfig: any;
  private catalogus: string;

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.valtimoApiConfig = configService.config.valtimoApi;
    this.catalogus = configService.config.openZaak.catalogus;
  }

  getOpenZaakConfig(): Observable<OpenZaakConfig> {
    return this.http.get<OpenZaakConfig>(`${this.valtimoApiConfig.endpointUri}v1/openzaak/config`);
  }

  getResource(resourceId: string): Observable<ResourceDto> {
    return this.http.get<ResourceDto>(
      `${this.valtimoApiConfig.endpointUri}v1/resource/${resourceId}`
    );
  }

  getZaakTypes(): Observable<ZaakType[]> {
    return this.http.get<ZaakType[]>(
      `${this.valtimoApiConfig.endpointUri}management/v1/zgw/zaaktype`
    );
  }

  getBesluittypen(): Observable<any> {
    return this.http.get(`${this.valtimoApiConfig.endpointUri}v1/besluittype`);
  }

  getInformatieObjectTypes(): Observable<InformatieObjectType[]> {
    return this.http.get<InformatieObjectType[]>(
      `${this.valtimoApiConfig.endpointUri}v1/openzaak/informatie-object-typen/${this.catalogus}`
    );
  }

  getZaakTypeLink(documentDefinitionName: string): Observable<ZaakTypeLink> {
    return this.http.get<ZaakTypeLink>(
      `${this.valtimoApiConfig.endpointUri}management/v1/zaak-type-link/${documentDefinitionName}`
    );
  }

  /**
   * @deprecated This method will be removed in the future.
   */
  getInformatieObjectTypeLink(id: string): Observable<InformatieObjectTypeLink> {
    return this.http.get<InformatieObjectTypeLink>(
      `${this.valtimoApiConfig.endpointUri}v1/openzaak/informatie-object-type-link/${id}`
    );
  }

  createZaakTypeLink(request: CreateZaakTypeLinkRequest): Observable<any> {
    return this.http.post<any>(
      `${this.valtimoApiConfig.endpointUri}management/v1/zaak-type-link`,
      request
    );
  }

  /**
   * @deprecated This method will be removed in the future.
   */
  createInformatieObjectTypeLink(request: CreateInformatieObjectTypeLinkRequest): Observable<any> {
    return this.http.post<any>(
      `${this.valtimoApiConfig.endpointUri}v1/openzaak/informatie-object-type-link`,
      request
    );
  }

  deleteZaakTypeLink(documentDefinitionName: string): Observable<any> {
    return this.http.delete<any>(
      `${this.valtimoApiConfig.endpointUri}management/v1/zaak-type-link/${documentDefinitionName}`
    );
  }

  /**
   * @deprecated This method will be removed in the future.
   */
  deleteInformatieObjectTypeLink(id: string): Observable<any> {
    return this.http.delete<any>(
      `${this.valtimoApiConfig.endpointUri}v1/openzaak/informatie-object-type-link/${id}`
    );
  }

  getZaakTypeLinkListByProcess(processDefinitionKey: string): Observable<Array<ZaakTypeLink>> {
    return this.http.get<Array<ZaakTypeLink>>(
      `${this.valtimoApiConfig.endpointUri}management/v1/zaak-type-link/process/${processDefinitionKey}`
    );
  }

  getStatusTypes(zaakTypeRequest: ZaakTypeRequest): Observable<any> {
    return this.http.post(
      `${this.valtimoApiConfig.endpointUri}v1/openzaak/status`,
      zaakTypeRequest
    );
  }

  getStatusResults(zaakTypeRequest): Observable<any> {
    return this.http.post(
      `${this.valtimoApiConfig.endpointUri}v1/openzaak/resultaat`,
      zaakTypeRequest
    );
  }

  upload(file: File, documentDefinitionName: string): Observable<OpenZaakResource> {
    const formData: FormData = new FormData();
    formData.append('file', file);
    formData.append('documentDefinitionName', documentDefinitionName);

    return this.http.post<OpenZaakResource>(
      `${this.valtimoApiConfig.endpointUri}v1/resource/upload-open-zaak`,
      formData,
      {
        reportProgress: true,
        responseType: 'json',
      }
    );
  }

  uploadWithMetadata(
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
    });
  }

  uploadTempFileWithMetadata(
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
      }
    );
  }
}
