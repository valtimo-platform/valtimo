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
import {HttpClient, HttpHeaders} from '@angular/common/http';
import {Observable} from 'rxjs';
import {FormioForm} from '@formio/angular';
import {ConfigService} from '@valtimo/config';
import {InterceptorSkip} from '@valtimo/security';
import {FormDefinitionOption} from './models';

@Injectable({
  providedIn: 'root',
})
export class FormService {
  private valtimoApiConfig: any;

  constructor(
    private configService: ConfigService,
    private http: HttpClient
  ) {
    this.valtimoApiConfig = configService.config.valtimoApi;
  }

  getFormDefinitionByName(formDefinitionName: string): Observable<FormioForm> {
    return this.http.get<FormioForm>(
      `${this.valtimoApiConfig.endpointUri}v1/form/${formDefinitionName}`
    );
  }

  getFormDefinitionByNamePreFilled(
    formDefinitionName: string,
    documentId: string
  ): Observable<FormioForm> {
    return this.http.get<FormioForm>(
      `${this.valtimoApiConfig.endpointUri}v1/process-link/form-definition/${formDefinitionName}?documentId=${documentId}`,
      {
        headers: new HttpHeaders().set(InterceptorSkip, '404'),
      }
    );
  }

  getAllFormDefinitions(): Observable<Array<FormDefinitionOption>> {
    return this.http.get<Array<FormDefinitionOption>>(
      `${this.valtimoApiConfig.endpointUri}v1/form-definition`
    );
  }
}
