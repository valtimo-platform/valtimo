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
import {BehaviorSubject, catchError, map, Observable, of, shareReplay, switchMap, tap} from 'rxjs';
import {
  AdminSettingsLogosDto,
  BaseApiService,
  ConfigService,
  ValtimoConfigFeatureToggles,
} from '@valtimo/shared';
import {AccentColorsResponse, FeatureToggleOverridesResponse} from '../models';
import {MenuConfigurationDto} from '../components/menu/menu-configuration.model';

@Injectable({
  providedIn: 'root',
})
export class AdminSettingsService extends BaseApiService {
  private readonly _refreshLogos$ = new BehaviorSubject<null>(null);
  private readonly _refreshToggles$ = new BehaviorSubject<null>(null);
  private readonly _refreshAccentColors$ = new BehaviorSubject<null>(null);
  private readonly _accentColorDefaults: {[key: string]: string} = {};

  private readonly _logos$: Observable<AdminSettingsLogosDto | null> = this._refreshLogos$.pipe(
    switchMap(() =>
      this.httpClient
        .get<AdminSettingsLogosDto>(this.getApiUrl('/v1/admin-settings/logos'))
        .pipe(catchError(() => of(null)))
    ),
    shareReplay(1)
  );

  private readonly _featureToggleOverrides$: Observable<{[key: string]: boolean}> =
    this._refreshToggles$.pipe(
      switchMap(() =>
        this.httpClient
          .get<FeatureToggleOverridesResponse>(this.getApiUrl('/v1/admin-settings/feature-toggles'))
          .pipe(
            map(response => response.overrides),
            catchError(() => of({}))
          )
      ),
      tap(overrides => this.configService.patchFeatureToggles(overrides)),
      shareReplay(1)
    );

  private readonly _accentColors$: Observable<{[key: string]: string}> =
    this._refreshAccentColors$.pipe(
      switchMap(() =>
        this.httpClient
          .get<AccentColorsResponse>(this.getApiUrl('/v1/admin-settings/accent-colors'))
          .pipe(
            map(response => response.colors),
            catchError(() => of({}))
          )
      ),
      tap(colors => this.applyAccentColors(colors)),
      shareReplay(1)
    );

  constructor(
    protected readonly httpClient: HttpClient,
    protected readonly configService: ConfigService
  ) {
    super(httpClient, configService);
  }

  public getLogos(): Observable<AdminSettingsLogosDto | null> {
    return this._logos$;
  }

  public refreshLogos(): void {
    this._refreshLogos$.next(null);
  }

  public getFeatureToggleOverrides(): Observable<{[key: string]: boolean}> {
    return this._featureToggleOverrides$;
  }

  public getMergedFeatureToggles(): Observable<ValtimoConfigFeatureToggles> {
    const envToggles = this.configService.config.featureToggles ?? {};
    return this._featureToggleOverrides$.pipe(
      map(overrides => ({...envToggles, ...overrides}) as ValtimoConfigFeatureToggles)
    );
  }

  public refreshFeatureToggles(): void {
    this._refreshToggles$.next(null);
  }

  public getAccentColors(): Observable<{[key: string]: string}> {
    return this._accentColors$;
  }

  public refreshAccentColors(): void {
    this._refreshAccentColors$.next(null);
  }

  public applyAccentColors(colors: {[key: string]: string}): void {
    const root = document.documentElement;
    Object.entries(colors).forEach(([cssVar, value]) => {
      if (cssVar && value) {
        // Snapshot the stylesheet default before the first inline override is written,
        // so consumers can later distinguish the FE default from the currently applied value.
        if (!(cssVar in this._accentColorDefaults)) {
          this._accentColorDefaults[cssVar] = getComputedStyle(root)
            .getPropertyValue(cssVar)
            .trim();
        }
        root.style.setProperty(cssVar, value);
      }
    });
  }

  public getMenuConfiguration(): Observable<MenuConfigurationDto> {
    return this.httpClient.get<MenuConfigurationDto>(
      this.getApiUrl('/v1/admin-settings/menu-configuration')
    );
  }

  public updateMenuConfiguration(dto: MenuConfigurationDto): Observable<MenuConfigurationDto> {
    return this.httpClient.put<MenuConfigurationDto>(
      this.getApiUrl('/management/v1/admin-settings/menu-configuration'),
      dto
    );
  }

  public getComputedAccentColor(cssVar: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
  }

  public getDefaultAccentColor(cssVar: string): string {
    if (cssVar in this._accentColorDefaults) {
      return this._accentColorDefaults[cssVar];
    }
    return this.getComputedAccentColor(cssVar);
  }
}
