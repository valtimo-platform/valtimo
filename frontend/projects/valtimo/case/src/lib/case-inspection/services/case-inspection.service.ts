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
import {ConfigService, Page} from '@valtimo/shared';
import {Observable} from 'rxjs';
import {
  BuildingBlockInstance,
  CaseInspectionLoggingEvent,
  CaseInspectionLogSearchRequest,
  DocumentInspection,
  ModifyDocumentRequest,
  ModifyDocumentResult,
  ProcessInstanceInspection,
  ProcessVariableMutationRequest,
} from '../models/case-inspection.models';

@Injectable({providedIn: 'root'})
export class CaseInspectionService {
  private readonly _baseUrl: string;

  constructor(
    private readonly http: HttpClient,
    private readonly configService: ConfigService
  ) {
    this._baseUrl = this.configService.config.valtimoApi.endpointUri;
  }

  public getDocument(caseId: string): Observable<DocumentInspection> {
    return this.http.get<DocumentInspection>(`${this._baseUrl}management/v1/case/${caseId}`);
  }

  public modifyDocumentForInspection(
    caseId: string,
    request: ModifyDocumentRequest
  ): Observable<ModifyDocumentResult> {
    return this.http.put<ModifyDocumentResult>(
      `${this._baseUrl}management/v1/case/${caseId}`,
      request
    );
  }

  public getProcessInspection(caseId: string): Observable<ProcessInstanceInspection[]> {
    return this.http.get<ProcessInstanceInspection[]>(
      `${this._baseUrl}management/v1/case/${caseId}/processes`
    );
  }

  public getBuildingBlockInstances(caseId: string): Observable<BuildingBlockInstance[]> {
    return this.http.get<BuildingBlockInstance[]>(
      `${this._baseUrl}management/v1/case/${caseId}/building-blocks`
    );
  }

  public searchCaseLogs(
    caseId: string,
    request: CaseInspectionLogSearchRequest,
    page: number,
    size: number
  ): Observable<Page<CaseInspectionLoggingEvent>> {
    const params = new HttpParams({fromObject: {page: String(page), size: String(size)}});
    return this.http.post<Page<CaseInspectionLoggingEvent>>(
      `${this._baseUrl}management/v1/case/${caseId}/logs`,
      request,
      {params}
    );
  }

  public createProcessVariable(
    caseId: string,
    processInstanceId: string,
    request: ProcessVariableMutationRequest
  ): Observable<void> {
    return this.http.post<void>(
      `${this._baseUrl}management/v1/case/${caseId}/process-instance/${processInstanceId}/variables`,
      request
    );
  }

  public updateProcessVariable(
    caseId: string,
    processInstanceId: string,
    name: string,
    request: ProcessVariableMutationRequest
  ): Observable<void> {
    return this.http.put<void>(
      `${this._baseUrl}management/v1/case/${caseId}/process-instance/${processInstanceId}/variables/${encodeURIComponent(name)}`,
      request
    );
  }

  public deleteProcessVariable(
    caseId: string,
    processInstanceId: string,
    name: string
  ): Observable<void> {
    return this.http.delete<void>(
      `${this._baseUrl}management/v1/case/${caseId}/process-instance/${processInstanceId}/variables/${encodeURIComponent(name)}`
    );
  }
}
