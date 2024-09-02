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
import {Observable} from 'rxjs';
import {
  FormFlowBreadcrumbs,
  FormFlowCreateRequest,
  FormFlowCreateResult,
  FormFlowDefinition,
  FormFlowInstance,
} from '../models';
import {ConfigService} from '@valtimo/config';

@Injectable({
  providedIn: 'root',
})
export class FormFlowService {
  private valtimoEndpointUri!: string;

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.valtimoEndpointUri = configService.config.valtimoApi.endpointUri;
  }

  public getFormFlowDefinitions(): Observable<FormFlowDefinition[]> {
    return this.http.get<FormFlowDefinition[]>(`${this.valtimoEndpointUri}v1/form-flow/definition`);
  }

  public createInstanceForNewProcess(
    processDefinitionKey: string,
    request: FormFlowCreateRequest
  ): Observable<FormFlowCreateResult> {
    return this.http.post<FormFlowCreateResult>(
      `${this.valtimoEndpointUri}v1/process-definition/${processDefinitionKey}/form-flow`,
      request
    );
  }

  public getFormFlowStep(formFlowInstanceId: string): Observable<FormFlowInstance> {
    return this.http.get<FormFlowInstance>(
      `${this.valtimoEndpointUri}v1/form-flow/instance/${formFlowInstanceId}`
    );
  }

  public submitStep(
    formFlowInstanceId: string,
    stepInstanceId: string,
    submissionData: any
  ): Observable<FormFlowInstance> {
    return this.http.post<FormFlowInstance>(
      `${this.valtimoEndpointUri}v1/form-flow/instance/${formFlowInstanceId}/step/instance/${stepInstanceId}`,
      submissionData
    );
  }

  public back(formFlowInstanceId: string, submissionData: any): Observable<FormFlowInstance> {
    return this.http.post<FormFlowInstance>(
      `${this.valtimoEndpointUri}v1/form-flow/instance/${formFlowInstanceId}/back`,
      submissionData
    );
  }

  public save(formFlowInstanceId: string, submissionData: any): Observable<null> {
    return this.http.post<null>(
      `${this.valtimoEndpointUri}v1/form-flow/instance/${formFlowInstanceId}/save`,
      submissionData
    );
  }

  public getBreadcrumbs(formFlowInstanceId: string): Observable<FormFlowBreadcrumbs> {
    return this.http.get<FormFlowBreadcrumbs>(
      `${this.valtimoEndpointUri}v1/form-flow/instance/${formFlowInstanceId}/breadcrumbs`
    );
  }

  public navigateToStep(
    instanceId: string,
    currentStepInstanceId: string,
    targetStepInstanceId,
    submissionData: any
  ): Observable<FormFlowInstance> {
    return this.http.post<FormFlowInstance>(
      `${this.valtimoEndpointUri}v1/form-flow/instance/${instanceId}/step/instance/${currentStepInstanceId}/to/step/instance/${targetStepInstanceId}`,
      submissionData
    );
  }
}
