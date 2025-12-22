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
import {catchError, Observable, of} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {ConfigService, Page} from '@valtimo/shared';
import {CaseListItem} from '../models';

@Injectable({
  providedIn: 'root',
})
export class DocumentVerzoekPluginService {
  private valtimoEndpointUri: string;

  constructor(
    private http: HttpClient,
    configService: ConfigService
  ) {
    this.valtimoEndpointUri = configService.config?.valtimoApi?.endpointUri;
  }

  public getCaseDefinitions(params: any): Observable<Page<CaseListItem>> {
    return this.http.get<Page<CaseListItem>>(
      `${this.valtimoEndpointUri}management/v1/case-definition`,
      {params}
    );
  }
}
