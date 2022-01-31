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
import {HttpClient, HttpHeaders, HttpParams} from '@angular/common/http';
import {Observable} from 'rxjs';
import {
  CreateFormAssociationRequest,
  FormAssociation,
  FormSubmissionResult,
  ModifyFormAssociationRequest,
} from './models';
import {InterceptorSkipHeader} from '@valtimo/security';
import {ConfigService} from '@valtimo/config';

@Injectable({
  providedIn: 'root',
})
export class FormLinkService {
  private valtimoApiConfig: any;

  constructor(private http: HttpClient, private configService: ConfigService) {
    this.valtimoApiConfig = configService.config.valtimoApi;
  }

  getFormLinkByAssociation(
    processDefinitionKey: string,
    formLinkId: string
  ): Observable<FormAssociation> {
    return this.http.get<FormAssociation>(
      `${this.valtimoApiConfig.endpointUri}form-association-management`,
      {
        params: {
          processDefinitionKey,
          formLinkId,
        },
      }
    );
  }

  getStartEventFormDefinitionByProcessDefinitionKey(processDefinitionKey: string): Observable<any> {
    return this.http.get(`${this.valtimoApiConfig.endpointUri}form-association/form-definition`, {
      headers: InterceptorSkipHeader.set('Content-Type', 'application/json'),
      params: {
        processDefinitionKey,
      },
    });
  }

  getFormDefinitionByFormLinkId(processDefinitionKey: string, formLinkId: string): Observable<any> {
    return this.http.get<FormAssociation>(`${this.valtimoApiConfig.endpointUri}form-association`, {
      params: {
        processDefinitionKey,
        formLinkId,
      },
    });
  }

  getPreFilledFormDefinitionByFormLinkId(
    processDefinitionKey: string,
    documentId: string,
    formLinkId: string,
    taskInstanceId?: string
  ): Observable<any> {
    let params = new HttpParams()
      .set('processDefinitionKey', processDefinitionKey)
      .set('documentId', documentId)
      .set('formLinkId', formLinkId);

    if (taskInstanceId) {
      params = params.set('taskInstanceId', taskInstanceId);
    }

    return this.http.get(`${this.valtimoApiConfig.endpointUri}form-association/form-definition`, {
      headers: InterceptorSkipHeader.set('Content-Type', 'application/json'),
      params: params,
    });
  }

  createFormAssociation(
    createFormAssociationRequest: CreateFormAssociationRequest
  ): Observable<FormAssociation> {
    return this.http.post<FormAssociation>(
      `${this.valtimoApiConfig.endpointUri}form-association-management`,
      createFormAssociationRequest
    );
  }

  modifyFormAssociation(
    modifyFormAssociationRequest: ModifyFormAssociationRequest
  ): Observable<FormAssociation> {
    return this.http.put<FormAssociation>(
      `${this.valtimoApiConfig.endpointUri}form-association-management`,
      modifyFormAssociationRequest
    );
  }

  deleteFormAssociation(processDefinitionKey: string, formAssociationId: string): Observable<any> {
    return this.http.delete(
      `${this.valtimoApiConfig.endpointUri}form-association-management/${processDefinitionKey}/${formAssociationId}`
    );
  }

  onSubmit(
    processDefinitionKey: string,
    formLinkId: string,
    formData: object,
    documentId?: string,
    taskInstanceId?: string
  ): Observable<FormSubmissionResult> {
    let params = new HttpParams()
      .set('processDefinitionKey', processDefinitionKey)
      .set('formLinkId', formLinkId);

    if (documentId) {
      params = params.set('documentId', documentId);
    }
    if (taskInstanceId) {
      params = params.set('taskInstanceId', taskInstanceId);
    }

    const httpOptions = {
      headers: new HttpHeaders().set('Content-Type', 'application/json'),
      params: params,
    };
    return this.http.post<FormSubmissionResult>(
      `${this.valtimoApiConfig.endpointUri}form-association/form-definition/submission`,
      formData,
      httpOptions
    );
  }
}
