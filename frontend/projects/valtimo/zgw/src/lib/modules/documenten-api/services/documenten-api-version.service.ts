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
import {BehaviorSubject, Observable} from 'rxjs';
import {DocumentenApiManagementVersion} from '../models';

@Injectable({
  providedIn: 'root',
})
export class DocumentenApiVersionService extends BaseApiService {
  private readonly _refresh$ = new BehaviorSubject<null>(null);

  public get refresh$(): Observable<null> {
    return this._refresh$.asObservable();
  }

  constructor(
    protected readonly httpClient: HttpClient,
    protected readonly configService: ConfigService
  ) {
    super(httpClient, configService);
  }

  public getManagementApiVersion(
    caseDefinitionName: string
  ): Observable<DocumentenApiManagementVersion> {
    return this.httpClient.get<DocumentenApiManagementVersion>(
      this.getApiUrl(`/management/v1/case-definition/${caseDefinitionName}/documenten-api/version`)
    );
  }

  public refresh(): void {
    this._refresh$.next(null);
  }
}
