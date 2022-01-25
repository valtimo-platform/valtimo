/*
 * Copyright 2020 Dimpact.
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
  InformatieObjectType,
  InformatieObjectTypeLink,
  OpenZaakConfig,
  OpenZaakResource,
  ResourceDto,
  ServiceTaskHandlerRequest,
  ZaakType,
  ZaakTypeLink,
  ZaakTypeRequest,
} from '@valtimo/contract';

@Injectable({
  providedIn: 'root',
})
export class OpenZaakService {
  private valtimoApiConfig: any;
  private catalogus: string;

  constructor(private http: HttpClient, private configService: ConfigService) {
    this.valtimoApiConfig = configService.config.valtimoApi;
    this.catalogus = configService.config.openZaak.catalogus;
  }

  getOpenZaakConfig(): Observable<OpenZaakConfig> {
    return this.http.get<OpenZaakConfig>(`${this.valtimoApiConfig.endpointUri}openzaak/config`);
  }

  getResource(resourceId: string): Observable<ResourceDto> {
    return this.http.get<ResourceDto>(`${this.valtimoApiConfig.endpointUri}resource/${resourceId}`);
  }

  getZaakTypes(): Observable<ZaakType[]> {
    return this.http.get<ZaakType[]>(`${this.valtimoApiConfig.endpointUri}openzaak/zaaktype`);
  }

  getInformatieObjectTypes(): Observable<InformatieObjectType[]> {
    return this.http.get<InformatieObjectType[]>(
      `${this.valtimoApiConfig.endpointUri}openzaak/informatie-object-typen/${this.catalogus}`
    );
  }

  getZaakTypeLink(id: string): Observable<ZaakTypeLink> {
    return this.http.get<ZaakTypeLink>(`${this.valtimoApiConfig.endpointUri}openzaak/link/${id}`);
  }

  getInformatieObjectTypeLink(id: string): Observable<InformatieObjectTypeLink> {
    return this.http.get<InformatieObjectTypeLink>(
      `${this.valtimoApiConfig.endpointUri}openzaak/informatie-object-type-link/${id}`
    );
  }

  createZaakTypeLink(request: CreateZaakTypeLinkRequest): Observable<any> {
    return this.http.post<any>(`${this.valtimoApiConfig.endpointUri}openzaak/link`, request);
  }

  createInformatieObjectTypeLink(request: CreateInformatieObjectTypeLinkRequest): Observable<any> {
    return this.http.post<any>(
      `${this.valtimoApiConfig.endpointUri}openzaak/informatie-object-type-link`,
      request
    );
  }

  deleteZaakTypeLink(id: string): Observable<any> {
    return this.http.delete<any>(`${this.valtimoApiConfig.endpointUri}openzaak/link/${id}`);
  }

  deleteInformatieObjectTypeLink(id: string): Observable<any> {
    return this.http.delete<any>(
      `${this.valtimoApiConfig.endpointUri}openzaak/informatie-object-type-link/${id}`
    );
  }

  getZaakTypeLinkListByProcess(processDefinitionKey: string): Observable<any> {
    return this.http.get(
      `${this.valtimoApiConfig.endpointUri}openzaak/link/process/${processDefinitionKey}`
    );
  }

  getStatusTypes(zaakTypeRequest: ZaakTypeRequest): Observable<any> {
    return this.http.post(`${this.valtimoApiConfig.endpointUri}openzaak/status`, zaakTypeRequest);
  }

  getStatusResults(zaakTypeRequest): Observable<any> {
    return this.http.post(
      `${this.valtimoApiConfig.endpointUri}openzaak/resultaat`,
      zaakTypeRequest
    );
  }

  createServiceTaskHandler(id: string, request: ServiceTaskHandlerRequest): Observable<any> {
    return this.http.post<any>(
      `${this.valtimoApiConfig.endpointUri}openzaak/link/${id}/service-handler`,
      request
    );
  }

  modifyServiceTaskHandler(id: string, request: ServiceTaskHandlerRequest): Observable<any> {
    return this.http.put<any>(
      `${this.valtimoApiConfig.endpointUri}openzaak/link/${id}/service-handler`,
      request
    );
  }

  deleteServiceTaskHandler(
    id: string,
    processDefinitionKey: string,
    serviceTaskId: string
  ): Observable<any> {
    return this.http.delete<any>(
      `${this.valtimoApiConfig.endpointUri}openzaak/link/${id}/service-handler/${processDefinitionKey}/${serviceTaskId}`
    );
  }

  upload(file: File, documentDefinitionName: string): Observable<OpenZaakResource> {
    const formData: FormData = new FormData();
    formData.append('file', file);
    formData.append('documentDefinitionName', documentDefinitionName);

    return this.http.post<OpenZaakResource>(
      `${this.valtimoApiConfig.endpointUri}resource/upload-open-zaak`,
      formData,
      {
        reportProgress: true,
        responseType: 'json',
      }
    );
  }
}
