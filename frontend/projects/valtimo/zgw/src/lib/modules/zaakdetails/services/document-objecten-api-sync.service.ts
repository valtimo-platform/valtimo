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
import {BaseApiService, ConfigService} from '@valtimo/config';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {
  DocumentObjectenApiSync,
  DocumentObjectenApiSyncRequest,
  ObjectManagementConfiguration,
} from '../models';
import {DocumentDefinition} from '@valtimo/document/public_api';

@Injectable({
  providedIn: 'root',
})
export class DocumentObjectenApiSyncService extends BaseApiService {
  constructor(
    protected readonly httpClient: HttpClient,
    protected readonly configService: ConfigService
  ) {
    super(httpClient, configService);
  }

  public getDocumentDefinition(documentDefinitionName: string): Observable<DocumentDefinition> {
    return this.httpClient.get<DocumentDefinition>(
      this.getApiUrl(`/v1/document-definition/${documentDefinitionName}`)
    );
  }

  public getObjectManagementConfigurations(): Observable<Array<ObjectManagementConfiguration>> {
    return this.httpClient.get<Array<ObjectManagementConfiguration>>(
      this.getApiUrl(`/management/v1/object/management/configuration`)
    );
  }

  public getDocumentObjectenApiSync(
    documentDefinitionName: string,
    documentDefinitionVersion: number
  ): Observable<DocumentObjectenApiSync> {
    return this.httpClient.get<DocumentObjectenApiSync>(
      this.getApiUrl(
        `/management/v1/document-definition/${documentDefinitionName}/version/${documentDefinitionVersion}/objecten-api-sync`
      )
    );
  }

  public updateDocumentObjectenApiSync(
    documentDefinitionName: string,
    documentDefinitionVersion: number,
    request: {
      objectManagementConfigurationId: string;
      enabled: boolean;
    }
  ): Observable<void> {
    return this.httpClient.put<void>(
      this.getApiUrl(
        `/management/v1/document-definition/${documentDefinitionName}/version/${documentDefinitionVersion}/objecten-api-sync`
      ),
      request
    );
  }

  public deleteDocumentObjectenApiSync(
    documentDefinitionName: string,
    documentDefinitionVersion: number
  ): Observable<void> {
    return this.httpClient.delete<void>(
      this.getApiUrl(
        `/management/v1/document-definition/${documentDefinitionName}/version/${documentDefinitionVersion}/objecten-api-sync`
      )
    );
  }
}
