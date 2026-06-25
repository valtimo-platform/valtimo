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

import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {BaseApiService, ConfigService} from '@valtimo/shared';
import {Observable} from 'rxjs';
import {ExternalPluginTabContent, ExternalPluginUserTokenResponse} from '../models';

@Injectable({
  providedIn: 'root',
})
export class CaseExternalPluginTabApiService extends BaseApiService {
  constructor(
    protected readonly httpClient: HttpClient,
    protected readonly configService: ConfigService
  ) {
    super(httpClient, configService);
  }

  public getExternalPluginTab(
    documentId: string,
    tabKey: string
  ): Observable<ExternalPluginTabContent> {
    return this.httpClient.get<ExternalPluginTabContent>(
      this.getApiUrl(`v1/document/${documentId}/external-plugin-tab/${tabKey}`)
    );
  }

  /**
   * Mints a short-lived, downscoped user token for the configuration backing this tab. Uses
   * `HttpClient` so the Keycloak bearer interceptor authenticates the mint call as the current
   * user — the result is bounded by PBAC ∩ the plugin's granted-endpoint allowlist.
   */
  public mintUserToken(configurationId: string): Observable<ExternalPluginUserTokenResponse> {
    return this.httpClient.post<ExternalPluginUserTokenResponse>(
      this.getApiUrl(`v1/external-plugin/configuration/${configurationId}/user-token`),
      {}
    );
  }
}
