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

import {Injectable} from '@angular/core';
import {IncludeFunction} from '../models';
import {ConfigService} from './config.service';
import {combineLatest, map, Observable, of} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class MenuIncludeService {
  constructor(private readonly configService: ConfigService) {}

  getIncludeFunctionObservable(
    includeFunction: IncludeFunction | IncludeFunction[]
  ): Observable<boolean> {
    if (Array.isArray(includeFunction)) {
      if (includeFunction.length === 0) {
        return of(true);
      }
      const observables = includeFunction.map(fn => this.getSingleIncludeFunction(fn));
      return combineLatest(observables).pipe(map(results => results.every(result => result)));
    }
    return this.getSingleIncludeFunction(includeFunction);
  }

  private getSingleIncludeFunction(includeFunction: IncludeFunction): Observable<boolean> {
    switch (includeFunction) {
      case IncludeFunction.ObjectManagementEnabled:
        return this.configService.getFeatureToggleObservable('enableObjectManagement', true);
      case IncludeFunction.ZgwFeaturesEnabled:
        return this.configService.getFeatureToggleObservable('enableZgwFeatures', false);
      default:
        return of(true);
    }
  }

  /**
   * @deprecated Use getIncludeFunctionObservable instead
   */
  getIncludeFunction(includeFunction: IncludeFunction): Observable<boolean> {
    return this.getSingleIncludeFunction(includeFunction);
  }
}
