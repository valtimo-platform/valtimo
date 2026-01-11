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

import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {IncludeFunction, ValtimoConfig} from '../models';
import {ConfigService} from './config.service';
import {BehaviorSubject, catchError, map, Observable, of, switchMap} from 'rxjs';

interface BetaFeatures {
  [key: string]: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class MenuIncludeService {
  private valtimoConfig!: ValtimoConfig;
  private readonly refreshBetaFeatures$ = new BehaviorSubject<void>(undefined);

  constructor(
    private readonly configService: ConfigService,
    private readonly http: HttpClient
  ) {
    this.valtimoConfig = this.configService.config;
  }

  getIncludeFunction(includeFunction: IncludeFunction): Observable<boolean> {
    switch (includeFunction) {
      case IncludeFunction.ObjectManagementEnabled:
        return of(!!this.valtimoConfig?.featureToggles?.enableObjectManagement || true);
      case IncludeFunction.CaseMigrationEnabled:
        return this.getBetaFeatures().pipe(map(features => features['caseMigration'] ?? false));
      default:
        return of(true);
    }
  }

  refreshBetaFeatures(): void {
    this.refreshBetaFeatures$.next();
  }

  private getBetaFeatures(): Observable<BetaFeatures> {
    return this.refreshBetaFeatures$.pipe(
      switchMap(() =>
        this.http
          .get<BetaFeatures>(
            `${this.valtimoConfig.valtimoApi.endpointUri}v1/settings/beta-features`
          )
          .pipe(catchError(() => of({})))
      )
    );
  }
}
