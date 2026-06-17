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
import {HttpClient, HttpHeaders, HttpParams} from '@angular/common/http';
import {ConfigService, InterceptorSkip} from '@valtimo/shared';
import {Observable} from 'rxjs';
import {
  ExternalPluginConfiguration,
  ExternalPluginConfigurationCreateRequest,
  ExternalPluginConfigurationDetail,
  ExternalPluginConfigurationUpdateRequest,
  ExternalPluginDefinition,
  ExternalPluginEndpointDescription,
  ExternalPluginEndpointDescriptionQuery,
  ExternalPluginHost,
  ExternalPluginHostCreateRequest,
  ExternalPluginHostDefaults,
  ExternalPluginHostEventQueueUpdateRequest,
} from '../models';

@Injectable({
  providedIn: 'root',
})
export class ExternalPluginService {
  private readonly _baseUrl: string;

  constructor(
    private readonly _http: HttpClient,
    configService: ConfigService
  ) {
    this._baseUrl = `${configService.config.valtimoApi.endpointUri}management/v1/external-plugin`;
  }

  public getHosts(): Observable<Array<ExternalPluginHost>> {
    return this._http.get<Array<ExternalPluginHost>>(`${this._baseUrl}/host`);
  }

  public createHost(request: ExternalPluginHostCreateRequest): Observable<ExternalPluginHost> {
    return this._http.post<ExternalPluginHost>(`${this._baseUrl}/host`, request);
  }

  public getHostDefaults(): Observable<ExternalPluginHostDefaults> {
    return this._http.get<ExternalPluginHostDefaults>(`${this._baseUrl}/host-defaults`);
  }

  public deleteHost(hostId: string): Observable<void> {
    return this._http.delete<void>(`${this._baseUrl}/host/${hostId}`);
  }

  public updateHostEventQueue(
    hostId: string,
    request: ExternalPluginHostEventQueueUpdateRequest
  ): Observable<ExternalPluginHost> {
    return this._http.patch<ExternalPluginHost>(
      `${this._baseUrl}/host/${hostId}/event-queue`,
      request
    );
  }

  public getDefinitions(): Observable<Array<ExternalPluginDefinition>> {
    return this._http.get<Array<ExternalPluginDefinition>>(`${this._baseUrl}/definition`);
  }

  public getDefinition(definitionId: string): Observable<ExternalPluginDefinition> {
    return this._http.get<ExternalPluginDefinition>(`${this._baseUrl}/definition/${definitionId}`);
  }

  public getConfiguration(configurationId: string): Observable<ExternalPluginConfigurationDetail> {
    return this._http.get<ExternalPluginConfigurationDetail>(`${this._baseUrl}/configuration/${configurationId}`);
  }

  public getConfigurations(definitionId?: string): Observable<Array<ExternalPluginConfiguration>> {
    let params = new HttpParams();
    if (definitionId) params = params.set('definitionId', definitionId);
    return this._http.get<Array<ExternalPluginConfiguration>>(`${this._baseUrl}/configuration`, {params});
  }

  public createConfiguration(request: ExternalPluginConfigurationCreateRequest): Observable<ExternalPluginConfiguration> {
    return this._http.post<ExternalPluginConfiguration>(`${this._baseUrl}/configuration`, request);
  }

  public updateConfiguration(configurationId: string, request: ExternalPluginConfigurationUpdateRequest): Observable<ExternalPluginConfiguration> {
    return this._http.put<ExternalPluginConfiguration>(`${this._baseUrl}/configuration/${configurationId}`, request);
  }

  public deleteConfiguration(configurationId: string): Observable<void> {
    return this._http.delete<void>(`${this._baseUrl}/configuration/${configurationId}`);
  }

  public getEndpointDescriptions(
    endpoints: Array<ExternalPluginEndpointDescriptionQuery>,
    locale: string = 'en'
  ): Observable<Array<ExternalPluginEndpointDescription>> {
    const params = new HttpParams().set('locale', locale);
    return this._http.post<Array<ExternalPluginEndpointDescription>>(
      `${this._baseUrl}/endpoint-descriptions`,
      endpoints,
      {params}
    );
  }

  /**
   * Uploads a plugin package to the host. When `force` is false the backend rejects a plugin that
   * is incompatible with the running GZAC version with a 409 carrying the version details; the
   * caller catches it to warn the operator and re-issues with `force=true` to proceed. The
   * `X-Skip-Interceptor` header keeps that expected 409 from raising a global error toast.
   */
  public uploadPlugin(hostId: string, file: File, force = false): Observable<unknown> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    const params = new HttpParams().set('force', force);
    const headers = new HttpHeaders().set(InterceptorSkip, '409');
    return this._http.post(`${this._baseUrl}/host/${hostId}/upload`, formData, {headers, params});
  }
}
