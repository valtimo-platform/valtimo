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
import {map, Observable} from 'rxjs';
import {
  FormFlowProcessLinkUpdateRequestDto,
  FormProcessLinkUpdateRequestDto,
  FormSubmissionResult,
  GetProcessLinkRequest,
  GetProcessLinkResponse,
  PluginProcessLinkUpdateDto,
  ProcessLinkCreateEvent,
  ProcessLinkType,
  TaskWithProcessLink,
  URLProcessLinkUpdateRequestDto,
} from '../models';
import {HttpClient, HttpHeaders, HttpParams} from '@angular/common/http';
import {URLVariables} from '../models/process-link-url.model';

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

  public getTasksWithProcessLinks(processInstanceId: string): Observable<TaskWithProcessLink[]> {
    return this.http
      .get<
        TaskWithProcessLink[]
      >(`${this.VALTIMO_ENDPOINT_URI}v1/process/${processInstanceId}/tasks/process-link`, {})
      .pipe(map(res => res || []));
  }

  public getProcessLink(
    getProcessLinkRequest: GetProcessLinkRequest
  ): Observable<GetProcessLinkResponse> {
    var params = new HttpParams().set(
      'processDefinitionId',
      getProcessLinkRequest.processDefinitionId
    );
    if (getProcessLinkRequest.activityId !== undefined)
      params = params.set('activityId', getProcessLinkRequest.activityId);

    return this.http.get<GetProcessLinkResponse>(`${this.VALTIMO_ENDPOINT_URI}v1/process-link`, {
      params,
    });
  }

  public updateProcessLink(
    updateProcessLinkRequest:
      | PluginProcessLinkUpdateDto
      | FormFlowProcessLinkUpdateRequestDto
      | FormProcessLinkUpdateRequestDto
      | URLProcessLinkUpdateRequestDto
  ): Observable<null> {
    return this.http.put<null>(
      `${this.VALTIMO_ENDPOINT_URI}v1/process-link`,
      this.emptyStringToNull(updateProcessLinkRequest)
    );
  }

  public saveProcessLink(saveProcessLinkRequest: ProcessLinkCreateEvent): Observable<null> {
    return this.http.post<null>(
      `${this.VALTIMO_ENDPOINT_URI}v1/process-link`,
      this.emptyStringToNull(saveProcessLinkRequest)
    );
  }

  public deleteProcessLink(id: string): Observable<null> {
    return this.http.delete<null>(`${this.VALTIMO_ENDPOINT_URI}v1/process-link/${id}`);
  }

  public getProcessLinkCandidates(activityType: string): Observable<Array<ProcessLinkType>> {
    return this.http.get<Array<ProcessLinkType>>(
      `${this.VALTIMO_ENDPOINT_URI}v1/process-link/types?activityType=${activityType}`
    );
  }

  public deployProcessWithProcessLinks(
    processLinks: ProcessLinkCreateEvent[] = [],
    processDefinitionId: string | null,
    processXml: string | null
  ) {
    const formData = new FormData();
    const processLinksBlob = new Blob(
      [JSON.stringify(processLinks.map(processLink => this.emptyStringToNull(processLink)))],
      {type: 'application/json'}
    );

    if (processXml) formData.append('file', new File([processXml], 'process.bpmn'));
    if (processDefinitionId) formData.append('processDefinitionId', processDefinitionId);
    formData.append('processLinks', processLinksBlob);

    return this.http.post(
      `${this.VALTIMO_ENDPOINT_URI}management/v1/case-definition/bezwaar/version/1.0.0-test/process-definition`,
      formData
    );
  }

  public submitForm(
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
    return this.http.get<URLVariables>(`${this.VALTIMO_ENDPOINT_URI}v1/process-link/url/variables`);
  }

  private emptyStringToNull<T extends Record<string, any>>(object: T): T {
    if (object && typeof object === 'object') {
      Object.keys(object).forEach(key => {
        const typedKey = key as keyof T;
        const value = object[typedKey];
        if (typeof value === 'object' && value !== null) {
          this.emptyStringToNull(value);
        } else if (value === '') {
          object[typedKey] = null as any;
        }
      });
    }
    return object;
  }
}
