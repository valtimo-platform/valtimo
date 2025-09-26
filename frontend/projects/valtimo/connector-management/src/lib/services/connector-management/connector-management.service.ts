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
import {
  ConfigService,
  ConnectorInstance,
  ConnectorInstanceCreateRequest,
  ConnectorInstanceUpdateRequest,
  ConnectorType,
} from '@valtimo/config';
import {Observable} from 'rxjs';
import {Page} from '@valtimo/document';

@Injectable({
  providedIn: 'root',
})
export class ConnectorManagementService {
  private valtimoApiConfig: any;

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.valtimoApiConfig = configService.config.valtimoApi;
  }

  getConnectorInstances(params?: any): Observable<Page<ConnectorInstance>> {
    return this.http.get<Page<ConnectorInstance>>(
      `${this.valtimoApiConfig.endpointUri}v1/connector/instance`,
      {params}
    );
  }

  getConnectorInstancesByType(typeId: string, params?: any): Observable<Page<ConnectorInstance>> {
    return this.http.get<Page<ConnectorInstance>>(
      `${this.valtimoApiConfig.endpointUri}v1/connector/instance/${typeId}`,
      {params}
    );
  }

  getConnectorInstanceById(instanceId: string): Observable<ConnectorInstance> {
    return this.http.get<ConnectorInstance>(
      `${this.valtimoApiConfig.endpointUri}v1/connector/instance?instanceId=${instanceId}`
    );
  }

  getConnectorTypes(): Observable<Array<ConnectorType>> {
    return this.http.get<Array<ConnectorType>>(
      `${this.valtimoApiConfig.endpointUri}v1/connector/type`
    );
  }

  createConnectorInstance(request: ConnectorInstanceCreateRequest): Observable<ConnectorInstance> {
    return this.http.post<ConnectorInstance>(
      `${this.valtimoApiConfig.endpointUri}v1/connector/instance`,
      request
    );
  }

  updateConnectorInstance(request: ConnectorInstanceUpdateRequest): Observable<ConnectorInstance> {
    return this.http.put<ConnectorInstance>(
      `${this.valtimoApiConfig.endpointUri}v1/connector/instance`,
      request
    );
  }

  deleteConnectorInstance(connectorInstanceId: string): Observable<ConnectorInstance> {
    return this.http.delete<ConnectorInstance>(
      `${this.valtimoApiConfig.endpointUri}v1/connector/instance/${connectorInstanceId}`
    );
  }
}
