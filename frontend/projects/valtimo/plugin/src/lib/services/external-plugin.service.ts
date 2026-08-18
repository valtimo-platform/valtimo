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
  ExternalPluginHostUsage,
  ExternalPluginUploadResult,
  PluginLogPage,
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

  /**
   * `InterceptorSkip: 400` keeps a rejected registration off the generic "An unexpected error
   * occurred" toast: the backend answers a fixable mistake (a bind address as base URL, a broker
   * over plaintext HTTP) with a 400 whose `detail` explains it, and the add-host modal renders that
   * next to the fields the admin filled in. A duplicate red toast would only compete with it.
   */
  public createHost(request: ExternalPluginHostCreateRequest): Observable<ExternalPluginHost> {
    const headers = new HttpHeaders().set(InterceptorSkip, '400');
    return this._http.post<ExternalPluginHost>(`${this._baseUrl}/host`, request, {headers});
  }

  public getHostDefaults(): Observable<ExternalPluginHostDefaults> {
    return this._http.get<ExternalPluginHostDefaults>(`${this._baseUrl}/host-defaults`);
  }

  public deleteHost(hostId: string): Observable<void> {
    return this._http.delete<void>(`${this._baseUrl}/host/${hostId}`);
  }

  /**
   * Returns what currently references any configuration under the host — BPMN process links,
   * external-plugin case tabs and case widgets, and building-block mappings.
   * Empty list = safe to delete. A non-empty list is also what the backend will attach to a
   * 409 if the user tries to delete anyway, so the UI uses this proactively to disable the
   * delete action.
   */
  public getHostUsages(hostId: string): Observable<Array<ExternalPluginHostUsage>> {
    return this._http.get<Array<ExternalPluginHostUsage>>(`${this._baseUrl}/host/${hostId}/usages`);
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

  /**
   * Replaces the browser origins allowed to embed this host's plugin screens. The backend pushes
   * the new list to the plugin host immediately, which serves it as the `frame-ancestors` CSP
   * directive — so an empty list means no page may frame this host's plugins.
   */
  public updateHostFrontendOrigins(
    hostId: string,
    origins: Array<string>
  ): Observable<ExternalPluginHost> {
    return this._http.patch<ExternalPluginHost>(`${this._baseUrl}/host/${hostId}/frontend-origins`, {
      frontendOrigins: origins,
    });
  }

  public getDefinitions(): Observable<Array<ExternalPluginDefinition>> {
    return this._http.get<Array<ExternalPluginDefinition>>(`${this._baseUrl}/definition`);
  }

  public getDefinition(definitionId: string): Observable<ExternalPluginDefinition> {
    return this._http.get<ExternalPluginDefinition>(`${this._baseUrl}/definition/${definitionId}`);
  }

  public getConfiguration(configurationId: string): Observable<ExternalPluginConfigurationDetail> {
    return this._http.get<ExternalPluginConfigurationDetail>(
      `${this._baseUrl}/configuration/${configurationId}`
    );
  }

  public getConfigurations(definitionId?: string): Observable<Array<ExternalPluginConfiguration>> {
    let params = new HttpParams();
    if (definitionId) params = params.set('definitionId', definitionId);
    return this._http.get<Array<ExternalPluginConfiguration>>(`${this._baseUrl}/configuration`, {
      params,
    });
  }

  public createConfiguration(
    request: ExternalPluginConfigurationCreateRequest
  ): Observable<ExternalPluginConfiguration> {
    return this._http.post<ExternalPluginConfiguration>(`${this._baseUrl}/configuration`, request);
  }

  public updateConfiguration(
    configurationId: string,
    request: ExternalPluginConfigurationUpdateRequest
  ): Observable<ExternalPluginConfiguration> {
    return this._http.put<ExternalPluginConfiguration>(
      `${this._baseUrl}/configuration/${configurationId}`,
      request
    );
  }

  public deleteConfiguration(configurationId: string): Observable<void> {
    return this._http.delete<void>(`${this._baseUrl}/configuration/${configurationId}`);
  }

  public getConfigurationLogs(
    configurationId: string,
    params: {page: number; size: number; level?: string; source?: string}
  ): Observable<PluginLogPage> {
    let httpParams = new HttpParams()
      .set('page', params.page.toString())
      .set('size', params.size.toString());
    if (params.level) httpParams = httpParams.set('level', params.level);
    if (params.source) httpParams = httpParams.set('source', params.source);
    return this._http.get<PluginLogPage>(
      `${this._baseUrl}/configuration/${configurationId}/logs`,
      {params: httpParams}
    );
  }

  /**
   * Same shape as [getHostUsages] but scoped to a single configuration. Empty list = safe to
   * delete. Non-empty = the configuration is referenced by one or more process links, case tabs,
   * case widgets or building-block mappings, and `deleteConfiguration` would fail with a 409
   * carrying these same entries.
   */
  public getConfigurationUsages(
    configurationId: string
  ): Observable<Array<ExternalPluginHostUsage>> {
    return this._http.get<Array<ExternalPluginHostUsage>>(
      `${this._baseUrl}/configuration/${configurationId}/usages`
    );
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
   * Uploads a plugin package to the host. Two expected 409s drive the upload UX (both kept off
   * the global error toast by the `X-Skip-Interceptor` header): an incompatible plugin returns
   * the version details and is retried with `force=true` after the operator confirms, and an
   * already-existing pluginId@version returns `code=PLUGIN_VERSION_EXISTS` plus the package's
   * requested permissions and is retried with `overwrite=true` after the operator re-reviews the
   * permissions and confirms the overwrite.
   */
  public uploadPlugin(
    hostId: string,
    file: File,
    force = false,
    overwrite = false
  ): Observable<ExternalPluginUploadResult> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    const params = new HttpParams().set('force', force).set('overwrite', overwrite);
    const headers = new HttpHeaders().set(InterceptorSkip, '409');
    return this._http.post<ExternalPluginUploadResult>(
      `${this._baseUrl}/host/${hostId}/upload`,
      formData,
      {headers, params}
    );
  }
}
