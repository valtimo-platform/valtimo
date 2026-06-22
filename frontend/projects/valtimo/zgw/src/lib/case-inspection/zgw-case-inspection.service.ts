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

import {HttpClient, HttpParams} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {ConfigService} from '@valtimo/shared';
import {Observable} from 'rxjs';
import {
  CaseZaakdetailsInspectionDto,
  CaseZgwInspectionDto,
  ZaakdetailsObjectContentDto,
  ZaakobjectResolveResultDto,
} from './case-inspection.models';

@Injectable({providedIn: 'root'})
export class ZgwCaseInspectionService {
  private readonly _baseUrl: string;

  constructor(
    private readonly http: HttpClient,
    private readonly configService: ConfigService
  ) {
    this._baseUrl = this.configService.config.valtimoApi.endpointUri;
  }

  public getZgwInspection(caseId: string): Observable<CaseZgwInspectionDto> {
    return this.http.get<CaseZgwInspectionDto>(`${this._baseUrl}management/v1/case/${caseId}/zgw`);
  }

  public resolveZaakobjectContent(
    caseId: string,
    objectUrl: string
  ): Observable<ZaakobjectResolveResultDto> {
    return this.http.get<ZaakobjectResolveResultDto>(
      `${this._baseUrl}management/v1/case/${caseId}/zgw/zaakobject/resolve`,
      {params: new HttpParams().set('objectUrl', objectUrl)}
    );
  }

  public getZaakdetailsInspection(caseId: string): Observable<CaseZaakdetailsInspectionDto> {
    return this.http.get<CaseZaakdetailsInspectionDto>(
      `${this._baseUrl}management/v1/case/${caseId}/zgw/zaakdetails`
    );
  }

  public getZaakdetailsObjectContent(caseId: string): Observable<ZaakdetailsObjectContentDto> {
    return this.http.get<ZaakdetailsObjectContentDto>(
      `${this._baseUrl}management/v1/case/${caseId}/zgw/zaakdetails/object`
    );
  }
}
