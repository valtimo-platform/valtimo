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

import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {ConfigService} from '@valtimo/config';
import {Observable} from 'rxjs';
import {ProcessJob} from '../models';

@Injectable({providedIn: 'root'})
export class DossierProcessTimerService {
  private readonly _baseUrl: string;

  constructor(
    private readonly http: HttpClient,
    private readonly configService: ConfigService
  ) {
    this._baseUrl = this.configService.config.valtimoApi.endpointUri;
  }

  public getSkippableTimers(caseId: string, processInstanceId: string): Observable<ProcessJob[]> {
    return this.http.get<ProcessJob[]>(
      `${this._baseUrl}v1/process-document/case/${caseId}/process-instance/${processInstanceId}/timers`
    );
  }

  public skipTimer(caseId: string, processInstanceId: string, jobId: string): Observable<void> {
    return this.http.post<void>(
      `${this._baseUrl}v1/process-document/case/${caseId}/process-instance/${processInstanceId}/timer/${jobId}/skip`,
      {}
    );
  }
}
