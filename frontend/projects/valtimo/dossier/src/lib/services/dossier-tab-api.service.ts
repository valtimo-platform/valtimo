/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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
import {BaseApiService, ConfigService} from '@valtimo/config';
import {HttpClient} from '@angular/common/http';
import {Observable, switchMap} from 'rxjs';
import {ApiTabItem} from '../models';

@Injectable({
  providedIn: 'root',
})
export class DossierTabApiService extends BaseApiService {
  constructor(
    protected readonly httpClient: HttpClient,
    protected readonly configService: ConfigService
  ) {
    super(httpClient, configService);
  }

  public getDossierTabs(
    documentDefinitionName: string,
    documentId: string
  ): Observable<Array<ApiTabItem>> {
    return this.configService
      .getFeatureToggleObservable('enableCaseWidgets')
      .pipe(
        switchMap(enableCaseWidgets =>
          enableCaseWidgets
            ? this.httpClient.get<Array<ApiTabItem>>(
                this.getApiUrl(`v1/document/${documentId}/tab`)
              )
            : this.httpClient.get<Array<ApiTabItem>>(
                this.getApiUrl(`v1/case-definition/${documentDefinitionName}/tab`)
              )
        )
      );
  }
}
