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
  CreateObjectSyncConfigRequest,
  CreateObjectSyncConfigResult,
  ObjectSyncConfig,
} from '../../models';

@Injectable({
  providedIn: 'root',
})
export class ObjectApiSyncService {
  private valtimoApiConfig: any;

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.valtimoApiConfig = configService.config.valtimoApi;
  }

  getObjectSyncConfigs(documentDefinitionName: string): Observable<Array<ObjectSyncConfig>> {
    return this.http.get<Array<ObjectSyncConfig>>(
      `${this.valtimoApiConfig.endpointUri}v1/object/sync/config`,
      {params: {documentDefinitionName}}
    );
  }

  createObjectSyncConfig(
    request: CreateObjectSyncConfigRequest
  ): Observable<CreateObjectSyncConfigResult> {
    return this.http.post<CreateObjectSyncConfigResult>(
      `${this.valtimoApiConfig.endpointUri}v1/object/sync/config`,
      request
    );
  }

  modifyObjectSyncConfig(request: ObjectSyncConfig): Observable<CreateObjectSyncConfigResult> {
    return this.http.put<CreateObjectSyncConfigResult>(
      `${this.valtimoApiConfig.endpointUri}v1/object/sync/config`,
      request
    );
  }

  deleteObjectSyncConfig(configId: string): Observable<any> {
    return this.http.delete<any>(
      `${this.valtimoApiConfig.endpointUri}v1/object/sync/config/${configId}`
    );
  }
}
