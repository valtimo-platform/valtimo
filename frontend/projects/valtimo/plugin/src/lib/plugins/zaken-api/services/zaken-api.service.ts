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
import {Observable} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {ConfigService} from '@valtimo/config';
import {ResultaatType, StatusType} from '../models';
import {Eigenschap} from '../models/eigenschap';

@Injectable({
  providedIn: 'root',
})
export class ZakenApiService {
  private valtimoEndpointUri: string;

  constructor(
    private http: HttpClient,
    configService: ConfigService
  ) {
    this.valtimoEndpointUri = configService.config.valtimoApi.endpointUri;
  }

  public getStatusTypesByCaseDefinition(caseDefinitionId: string): Observable<Array<StatusType>> {
    return this.http.get<Array<StatusType>>(
      `${this.valtimoEndpointUri}v1/case-definition/${caseDefinitionId}/zaaktype/statustype`
    );
  }

  public getResultaatTypesByCaseDefinition(
    caseDefinitionId: string
  ): Observable<Array<ResultaatType>> {
    return this.http.get<Array<ResultaatType>>(
      `${this.valtimoEndpointUri}v1/case-definition/${caseDefinitionId}/zaaktype/resultaattype`
    );
  }

  public getEigenschappenByCaseDefinition(
    caseDefinitionName: string
  ): Observable<Array<Eigenschap>> {
    return this.http.get<Array<Eigenschap>>(
      `${this.valtimoEndpointUri}management/v1/case-definition/${caseDefinitionName}/catalogi-eigenschappen`
    );
  }
}
