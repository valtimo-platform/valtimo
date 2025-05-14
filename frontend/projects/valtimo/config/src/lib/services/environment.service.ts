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
import {HttpClient} from '@angular/common/http';
import {map, Observable} from 'rxjs';
import {ConfigService} from './config.service';
import {BaseApiService} from './base-api.service';
import {GlobalConfiguration} from '../models';

@Injectable({
  providedIn: 'root',
})
export class EnvironmentService extends BaseApiService {
  constructor(
    protected readonly httpClient: HttpClient,
    protected readonly configService: ConfigService
  ) {
    super(httpClient, configService);
  }

  public canUpdateGlobalConfiguration(): Observable<boolean> {
    return this.httpClient
      .get<GlobalConfiguration>(this.getApiUrl('management/v1/case-definition/check'))
      .pipe(map(response => response.canUpdateGlobalConfiguration));
  }
}
