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
import {HttpClient} from '@angular/common/http';
import {catchError, Observable, of} from 'rxjs';
import {
  AdminSettingsLogoDto,
  AdminSettingsLogosDto,
  BaseApiService,
  ConfigService,
  CreateAdminSettingsLogoDto,
} from '@valtimo/shared';
import {
  AccentColorsDto,
  FeatureToggleOverridesDto,
  SearchEngineDto,
  UpdateFeatureToggleDto,
} from '../models';

@Injectable({
  providedIn: 'root',
})
export class AdminSettingsManagementApiService extends BaseApiService {
  constructor(
    protected readonly httpClient: HttpClient,
    protected readonly configService: ConfigService
  ) {
    super(httpClient, configService);
  }

  public getLogos(): Observable<AdminSettingsLogosDto> {
    return this.httpClient.get<AdminSettingsLogosDto>(
      this.getApiUrl('/v1/admin-settings/logos')
    );
  }

  public uploadLogo(
    logoType: string,
    dto: CreateAdminSettingsLogoDto
  ): Observable<AdminSettingsLogoDto> {
    return this.httpClient.post<AdminSettingsLogoDto>(
      this.getApiUrl(`/management/v1/admin-settings/logo/${logoType}`),
      dto
    );
  }

  public deleteLogo(logoType: string): Observable<void> {
    return this.httpClient.delete<void>(
      this.getApiUrl(`/management/v1/admin-settings/logo/${logoType}`)
    );
  }

  public getFeatureToggleOverrides(): Observable<FeatureToggleOverridesDto> {
    return this.httpClient.get<FeatureToggleOverridesDto>(
      this.getApiUrl('/v1/admin-settings/feature-toggles')
    );
  }

  public updateFeatureToggle(dto: UpdateFeatureToggleDto): Observable<FeatureToggleOverridesDto> {
    return this.httpClient.put<FeatureToggleOverridesDto>(
      this.getApiUrl('/management/v1/admin-settings/feature-toggles'),
      dto
    );
  }

  public removeFeatureToggle(key: string): Observable<FeatureToggleOverridesDto> {
    return this.httpClient.delete<FeatureToggleOverridesDto>(
      this.getApiUrl(`/management/v1/admin-settings/feature-toggles/${key}`)
    );
  }

  public getAccentColors(): Observable<AccentColorsDto> {
    return this.httpClient.get<AccentColorsDto>(
      this.getApiUrl('/v1/admin-settings/accent-colors')
    );
  }

  public updateAccentColors(dto: AccentColorsDto): Observable<AccentColorsDto> {
    return this.httpClient.put<AccentColorsDto>(
      this.getApiUrl('/management/v1/admin-settings/accent-colors'),
      dto
    );
  }

  public getSearchEngine(): Observable<SearchEngineDto | null> {
    return this.httpClient
      .get<SearchEngineDto>(this.getApiUrl('/management/v1/search-engine'))
      .pipe(catchError(() => of(null)));
  }

  public updateSearchEngine(useOpenSearch: boolean): Observable<SearchEngineDto> {
    return this.httpClient.put<SearchEngineDto>(
      this.getApiUrl('/management/v1/search-engine'),
      {active: useOpenSearch ? 'OPENSEARCH' : 'POSTGRES'}
    );
  }
}
