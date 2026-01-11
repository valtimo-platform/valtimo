/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

import {HttpClient, HttpResponse} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {ConfigService} from '@valtimo/shared';
import {catchError, map, Observable, of} from 'rxjs';

interface LogoResponse {
  logo: string;
}

export interface BetaFeatures {
  [key: string]: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class SettingsApiService {
  private readonly valtimoEndpointUri: string;

  constructor(
    private readonly http: HttpClient,
    private readonly configService: ConfigService
  ) {
    this.valtimoEndpointUri = this.configService.config.valtimoApi.endpointUri;
  }

  public getLogo(): Observable<string | null> {
    return this.http
      .get<LogoResponse>(`${this.valtimoEndpointUri}v1/settings/logo`, {
        observe: 'response',
      })
      .pipe(
        map((response: HttpResponse<LogoResponse>) => {
          if (response.status === 204 || !response.body) {
            return null;
          }
          return response.body.logo;
        }),
        catchError(() => of(null))
      );
  }

  public uploadLogo(base64Logo: string): Observable<void> {
    return this.http.post<void>(`${this.valtimoEndpointUri}management/v1/settings/logo`, {
      logo: base64Logo,
    });
  }

  public deleteLogo(): Observable<void> {
    return this.http.delete<void>(`${this.valtimoEndpointUri}management/v1/settings/logo`);
  }

  public getBetaFeatures(): Observable<BetaFeatures> {
    return this.http.get<BetaFeatures>(`${this.valtimoEndpointUri}v1/settings/beta-features`).pipe(
      catchError(() => of({}))
    );
  }

  public setBetaFeature(featureKey: string, enabled: boolean): Observable<void> {
    return this.http.post<void>(`${this.valtimoEndpointUri}management/v1/settings/beta-features`, {
      featureKey,
      enabled,
    });
  }
}
