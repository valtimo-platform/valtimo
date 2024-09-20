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
import {ConfigService} from '@valtimo/config';
import {Observable} from 'rxjs';
import {
  FormFlowProcessLinkCreateRequestDto,
  FormFlowProcessLinkUpdateRequestDto,
  FormProcessLinkCreateRequestDto,
  FormProcessLinkUpdateRequestDto,
  FormSubmissionResult,
  GetProcessLinkRequest,
  GetProcessLinkResponse,
  PluginProcessLinkCreateDto,
  PluginProcessLinkUpdateDto,
  URLProcessLinkCreateDto,
  ProcessLinkType, URLProcessLinkUpdateRequestDto,
} from '../models';
import {HttpClient, HttpHeaders, HttpParams} from '@angular/common/http';
import {URLVariables} from "../models/process-link-url.model";

@Injectable({
  providedIn: 'root',
})
export class ProcessLinkService {
  private readonly VALTIMO_ENDPOINT_URI!: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly http: HttpClient
  ) {
    this.VALTIMO_ENDPOINT_URI = configService.config.valtimoApi.endpointUri;
  }

  getProcessLink(getProcessLinkRequest: GetProcessLinkRequest): Observable<GetProcessLinkResponse> {
    const params = new HttpParams()
      .set('activityId', getProcessLinkRequest.activityId)
      .set('processDefinitionId', getProcessLinkRequest.processDefinitionId);

    return this.http.get<GetProcessLinkResponse>(`${this.VALTIMO_ENDPOINT_URI}v1/process-link`, {
      params,
    });
  }

  updateProcessLink(
    updateProcessLinkRequest:
      | PluginProcessLinkUpdateDto
      | FormFlowProcessLinkUpdateRequestDto
      | FormProcessLinkUpdateRequestDto
      | URLProcessLinkUpdateRequestDto
  ): Observable<null> {
    const pluginUpdateRequest = updateProcessLinkRequest as PluginProcessLinkUpdateDto;
    if (pluginUpdateRequest.actionProperties) {
      Object.keys(pluginUpdateRequest.actionProperties).forEach(key => {
        if (pluginUpdateRequest.actionProperties[key] === '') {
          pluginUpdateRequest.actionProperties[key] = null;
        }
      });
    }

    return this.http.put<null>(
      `${this.VALTIMO_ENDPOINT_URI}v1/process-link`,
      updateProcessLinkRequest
    );
  }

  saveProcessLink(
    saveProcessLinkRequest:
      | FormProcessLinkCreateRequestDto
      | FormFlowProcessLinkCreateRequestDto
      | PluginProcessLinkCreateDto
      | URLProcessLinkCreateDto
  ): Observable<null> {
    const pluginProcessLinkCreateRequest = saveProcessLinkRequest as PluginProcessLinkCreateDto;
    if (pluginProcessLinkCreateRequest.actionProperties) {
      Object.keys(pluginProcessLinkCreateRequest.actionProperties).forEach(key => {
        if (pluginProcessLinkCreateRequest.actionProperties[key] === '') {
          pluginProcessLinkCreateRequest.actionProperties[key] = null;
        }
      });
    }

    return this.http.post<null>(
      `${this.VALTIMO_ENDPOINT_URI}v1/process-link`,
      saveProcessLinkRequest
    );
  }

  deleteProcessLink(id: string): Observable<null> {
    return this.http.delete<null>(`${this.VALTIMO_ENDPOINT_URI}v1/process-link/${id}`);
  }

  getProcessLinkCandidates(activityType: string): Observable<Array<ProcessLinkType>> {
    return this.http.get<Array<ProcessLinkType>>(
      `${this.VALTIMO_ENDPOINT_URI}v1/process-link/types?activityType=${activityType}`
    );
  }

  submitForm(
    processLinkId: string,
    formData: object,
    documentId?: string,
    taskInstanceId?: string,
    documentDefinitionName?: string
  ): Observable<FormSubmissionResult> {
    let params = new HttpParams();

    if (documentId) {
      params = params.set('documentId', documentId);
    }
    if (taskInstanceId) {
      params = params.set('taskInstanceId', taskInstanceId);
    }
    if (documentDefinitionName) {
      params = params.set('documentDefinitionName', documentDefinitionName);
    }

    const httpOptions = {
      headers: new HttpHeaders().set('Content-Type', 'application/json'),
      params,
    };
    return this.http.post<FormSubmissionResult>(
      `${this.VALTIMO_ENDPOINT_URI}v1/process-link/${processLinkId}/form/submission`,
      formData,
      httpOptions
    );
  }

  public submitURLProcessLink(
    processLinkId: string,
    documentId?: string,
    taskInstanceId?: string,
    documentDefinitionName?: string
  ): Observable<FormSubmissionResult> {
    let params = new HttpParams();

    if (documentId) {
      params = params.set('documentId', documentId);
    }
    if (taskInstanceId) {
      params = params.set('taskInstanceId', taskInstanceId);
    }
    if (documentDefinitionName) {
      params = params.set('documentDefinitionName', documentDefinitionName);
    }

    const httpOptions = {
      headers: new HttpHeaders().set('Content-Type', 'application/json'),
      params,
    };
    return this.http.post<FormSubmissionResult>(
      `${this.VALTIMO_ENDPOINT_URI}v1/process-link/url/${processLinkId}`,
      {},
      httpOptions
    );
  }

  public getVariables(): Observable<URLVariables> {
    return this.http.get<URLVariables>(
      `${this.VALTIMO_ENDPOINT_URI}v1/process-link/url/variables`
    );
  }
}
