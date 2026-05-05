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

import {HttpClient, HttpParams} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {ConfigService} from '@valtimo/shared';
import {Observable} from 'rxjs';
import {
  ExternalPluginConfiguration,
  ExternalPluginConfigurationCreateRequest,
  ExternalPluginDefinition,
  ExternalPluginHost,
  ExternalPluginHostCreateRequest,
} from '../models';

@Injectable({providedIn: 'root'})
export class ExternalPluginService {
  private readonly _baseUrl = `${this.configService.config.valtimoApi.endpointUri}management/v1/external-plugin`;

  constructor(
    private readonly http: HttpClient,
    private readonly configService: ConfigService
  ) {}

  public getHosts(): Observable<Array<ExternalPluginHost>> {
    return this.http.get<Array<ExternalPluginHost>>(`${this._baseUrl}/host`);
  }

  public createHost(request: ExternalPluginHostCreateRequest): Observable<ExternalPluginHost> {
    return this.http.post<ExternalPluginHost>(`${this._baseUrl}/host`, request);
  }

  public getDefinitions(): Observable<Array<ExternalPluginDefinition>> {
    return this.http.get<Array<ExternalPluginDefinition>>(`${this._baseUrl}/definition`);
  }

  public getConfigurations(definitionId?: string): Observable<Array<ExternalPluginConfiguration>> {
    const params = definitionId ? new HttpParams().set('definitionId', definitionId) : undefined;
    return this.http.get<Array<ExternalPluginConfiguration>>(`${this._baseUrl}/configuration`, {
      params,
    });
  }

  public createConfiguration(
    request: ExternalPluginConfigurationCreateRequest
  ): Observable<ExternalPluginConfiguration> {
    return this.http.post<ExternalPluginConfiguration>(`${this._baseUrl}/configuration`, request);
  }
}
