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
import {ConfigService} from '@valtimo/shared';
import {Observable} from 'rxjs';
import {ExternalPluginUserTokenResponse} from '../models';

/**
 * Mints the short-lived, downscoped user token used by every external-plugin iframe surface
 * (case tabs, task forms, …) to call GZAC on behalf of the logged-in user. Shared here so each
 * surface does not reimplement the mint call. `HttpClient` is used deliberately so the Keycloak
 * bearer interceptor authenticates the mint as the current user — the result is bounded by
 * PBAC ∩ the plugin's granted-endpoint allowlist and a ≤15-minute TTL.
 */
@Injectable({
  providedIn: 'root',
})
export class ExternalPluginUserTokenService {
  private readonly _baseUrl: string;

  constructor(
    private readonly _http: HttpClient,
    configService: ConfigService
  ) {
    this._baseUrl = `${configService.config.valtimoApi.endpointUri}v1/external-plugin`;
  }

  public mintUserToken(configurationId: string): Observable<ExternalPluginUserTokenResponse> {
    return this._http.post<ExternalPluginUserTokenResponse>(
      `${this._baseUrl}/configuration/${configurationId}/user-token`,
      {}
    );
  }
}
