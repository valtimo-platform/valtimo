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
import {ProcessDefinition, UploadProcessLink} from '../models';

@Injectable({
  providedIn: 'root',
})
export class DocumentenApiLinkProcessService extends BaseApiService {
  constructor(
    protected readonly httpClient: HttpClient,
    protected readonly configService: ConfigService
  ) {
    super(httpClient, configService);
  }

  public getProcessDefinitions(): Observable<ProcessDefinition[]> {
    return this.httpClient.get<ProcessDefinition[]>(this.getApiUrl('/v1/process/definition'));
  }

  public getLinkedUploadProcess(documentDefinitionName: string): Observable<UploadProcessLink> {
    return this.httpClient.get<UploadProcessLink>(
      this.getApiUrl(`/v1/process-document/demo/${documentDefinitionName}/process`)
    );
  }

  public updateLinkedUploadProcess(
    documentDefinitionName: string,
    processDefinitionKey: string
  ): Observable<UploadProcessLink> {
    return this.httpClient.put<UploadProcessLink>(
      this.getApiUrl(`/v1/process-document/demo/${documentDefinitionName}/process`),
      {
        processDefinitionKey,
        linkType: 'DOCUMENT_UPLOAD',
      }
    );
  }

  public deleteLinkedUploadProcess(documentDefinitionName: string): Observable<void> {
    return this.httpClient.delete<void>(
      this.getApiUrl(`/v1/process-document/demo/${documentDefinitionName}/process`)
    );
  }
}
