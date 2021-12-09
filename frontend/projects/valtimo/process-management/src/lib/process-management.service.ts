/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
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

@Injectable({
  providedIn: 'root'
})
export class ProcessManagementService {

  private valtimoApiConfig: any;

  constructor(
    private configService: ConfigService,
    private http: HttpClient
  ) {
    this.valtimoApiConfig = configService.config.valtimoApi;
  }

  deployBpmn(bpmn: File): Observable<any> {
    const formData: FormData = new FormData();
    formData.append('file', bpmn);
    formData.append('deployment-name', 'valtimoConsoleApp');
    formData.append('deployment-source', 'process application');
    return this.http.post<any>(
      `${this.valtimoApiConfig.endpointUri}camunda-rest/engine/default/deployment/create`, formData
    );
  }
}
