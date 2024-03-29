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
import {HttpClient} from '@angular/common/http';
import {CreateFormDefinitionRequest, FormDefinition, ModifyFormDefinitionRequest} from '../models';
import {Observable} from 'rxjs';
import {ConfigService} from '@valtimo/config';

@Injectable({
  providedIn: 'root',
})
export class FormManagementService {
  private valtimoApiConfig: any;

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.valtimoApiConfig = configService.config.valtimoApi;
  }

  getFormDefinition(formDefinitionId: string): Observable<FormDefinition> {
    return this.http.get<FormDefinition>(
      `${this.valtimoApiConfig.endpointUri}v1/form-management/${formDefinitionId}`
    );
  }

  existsFormDefinition(formDefinitionName: string): Observable<boolean> {
    return this.http.get<boolean>(
      `${this.valtimoApiConfig.endpointUri}v1/form-management/exists/${formDefinitionName}`
    );
  }

  queryFormDefinitions(params?: any): Observable<any> {
    return this.http.get(`${this.valtimoApiConfig.endpointUri}v1/form-management`, {
      observe: 'response',
      params,
    });
  }

  createFormDefinition(request: CreateFormDefinitionRequest): Observable<FormDefinition> {
    return this.http.post<FormDefinition>(
      `${this.valtimoApiConfig.endpointUri}v1/form-management`,
      request
    );
  }

  modifyFormDefinition(request: ModifyFormDefinitionRequest): Observable<FormDefinition> {
    return this.http.put<FormDefinition>(
      `${this.valtimoApiConfig.endpointUri}v1/form-management`,
      request
    );
  }

  deleteFormDefinition(formDefinitionId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.valtimoApiConfig.endpointUri}v1/form-management/${formDefinitionId}`
    );
  }
}
