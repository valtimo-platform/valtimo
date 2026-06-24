/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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
import {HttpClient, HttpHeaders, HttpParams} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {ConfigService, InterceptorSkip} from '@valtimo/shared';
import {map, Observable} from 'rxjs';

import {
  CompatiblePluginProcessLinks,
  FormSubmissionResult,
  GetProcessLinkRequest,
  GetProcessLinkResponse,
  ProcessLinkCreateEvent,
  ProcessLinkType,
  TaskWithProcessLink,
} from '../models';
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
    this.VALTIMO_ENDPOINT_URI = this.configService.config.valtimoApi.endpointUri;
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

  public getProcessLinkCandidates(activityType: string): Observable<Array<ProcessLinkType>> {
    return this.http.get<Array<ProcessLinkType>>(
      `${this.VALTIMO_ENDPOINT_URI}v1/process-link/types?activityType=${activityType}`
    );
  }

  public createProcessDefinition(
    processLinks: ProcessLinkCreateEvent[] = [],
    processXml: string | null
  ) {
    return this.http.post(
      `${this.VALTIMO_ENDPOINT_URI}management/v1/process-definition`,
      this.buildProcessDefinitionFormData(processLinks, processXml, null),
      {headers: new HttpHeaders().set(InterceptorSkip, '409')}
    );
  }

  public updateProcessDefinition(
    processLinks: ProcessLinkCreateEvent[] = [],
    processDefinitionId: string,
    processXml: string | null
  ) {
    return this.http.put(
      `${this.VALTIMO_ENDPOINT_URI}management/v1/process-definition`,
      this.buildProcessDefinitionFormData(processLinks, processXml, processDefinitionId)
    );
  }

  public createProcessDefinitionForCase(
    processLinks: ProcessLinkCreateEvent[] = [],
    processXml: string | null,
    caseDefinitionKey: string,
    caseDefinitionVersionTag: string,
    canInitializeDocument: boolean = false,
    startableByUser: boolean = false
  ) {
    return this.http.post(
      `${this.VALTIMO_ENDPOINT_URI}management/v1/case-definition/${caseDefinitionKey}/version/${caseDefinitionVersionTag}/process-definition`,
      this.buildCaseProcessDefinitionFormData(
        processLinks,
        processXml,
        null,
        canInitializeDocument,
        startableByUser
      ),
      {headers: new HttpHeaders().set(InterceptorSkip, '409')}
    );
  }

  public updateProcessDefinitionForCase(
    processLinks: ProcessLinkCreateEvent[] = [],
    processDefinitionId: string,
    processXml: string | null,
    caseDefinitionKey: string,
    caseDefinitionVersionTag: string,
    canInitializeDocument: boolean = false,
    startableByUser: boolean = false
  ) {
    return this.http.put(
      `${this.VALTIMO_ENDPOINT_URI}management/v1/case-definition/${caseDefinitionKey}/version/${caseDefinitionVersionTag}/process-definition`,
      this.buildCaseProcessDefinitionFormData(
        processLinks,
        processXml,
        processDefinitionId,
        canInitializeDocument,
        startableByUser
      )
    );
  }

  public createProcessDefinitionForBuildingBlock(
    processLinks: ProcessLinkCreateEvent[] = [],
    processXml: string | null,
    buildingBlockKey: string,
    buildingBlockVersionTag: string
  ) {
    return this.http.post(
      `${this.VALTIMO_ENDPOINT_URI}management/v1/building-block/${buildingBlockKey}/version/${buildingBlockVersionTag}/process-definition`,
      this.buildBuildingBlockFormData(processLinks, processXml, buildingBlockKey, buildingBlockVersionTag),
      {headers: new HttpHeaders().set(InterceptorSkip, '409')}
    );
  }

  public updateProcessDefinitionForBuildingBlock(
    processLinks: ProcessLinkCreateEvent[] = [],
    processDefinitionId: string,
    processXml: string | null,
    buildingBlockKey: string,
    buildingBlockVersionTag: string,
    replace: boolean = false
  ) {
    return this.http.put(
      `${this.VALTIMO_ENDPOINT_URI}management/v1/building-block/${buildingBlockKey}/version/${buildingBlockVersionTag}/process-definition/${processDefinitionId}`,
      this.buildBuildingBlockFormData(processLinks, processXml, buildingBlockKey, buildingBlockVersionTag),
      {params: replace ? new HttpParams().set('replace', 'true') : undefined}
    );
  }

  /** @deprecated Use createProcessDefinition() or updateProcessDefinition() */
  public deployProcessWithProcessLinks(
    processLinks: ProcessLinkCreateEvent[] = [],
    processDefinitionId: string | null,
    processXml: string | null
  ) {
    if (processDefinitionId) {
      return this.updateProcessDefinition(processLinks, processDefinitionId, processXml);
    }
    return this.createProcessDefinition(processLinks, processXml);
  }

  /** @deprecated Use createProcessDefinitionForCase() or updateProcessDefinitionForCase() */
  public deployProcessWithProcessLinksForCase(
    processLinks: ProcessLinkCreateEvent[] = [],
    processDefinitionId: string | null,
    processXml: string | null,
    caseDefinitionKey: string,
    caseDefinitionVersionTag: string,
    canInitializeDocument: boolean = false,
    startableByUser: boolean = false
  ) {
    if (processDefinitionId) {
      return this.updateProcessDefinitionForCase(
        processLinks,
        processDefinitionId,
        processXml,
        caseDefinitionKey,
        caseDefinitionVersionTag,
        canInitializeDocument,
        startableByUser
      );
    }
    return this.createProcessDefinitionForCase(
      processLinks,
      processXml,
      caseDefinitionKey,
      caseDefinitionVersionTag,
      canInitializeDocument,
      startableByUser
    );
  }

  /** @deprecated Use createProcessDefinitionForBuildingBlock() or updateProcessDefinitionForBuildingBlock() */
  public deployProcessWithProcessLinksForBuildingBlock(
    processLinks: ProcessLinkCreateEvent[] = [],
    processDefinitionId: string | null,
    processXml: string | null,
    buildingBlockKey: string,
    buildingBlockVersionTag: string,
    replace: boolean = false
  ) {
    if (processDefinitionId) {
      return this.updateProcessDefinitionForBuildingBlock(
        processLinks,
        processDefinitionId,
        processXml,
        buildingBlockKey,
        buildingBlockVersionTag,
        replace
      );
    }
    return this.createProcessDefinitionForBuildingBlock(
      processLinks,
      processXml,
      buildingBlockKey,
      buildingBlockVersionTag
    );
  }

  private buildProcessDefinitionFormData(
    processLinks: ProcessLinkCreateEvent[],
    processXml: string | null,
    processDefinitionId: string | null
  ): FormData {
    const formData = new FormData();
    if (processXml) formData.append('file', new File([processXml], 'process.bpmn'));
    if (processDefinitionId) formData.append('processDefinitionId', processDefinitionId);
    formData.append('processLinks', this.toProcessLinksBlob(processLinks));
    return formData;
  }

  private buildCaseProcessDefinitionFormData(
    processLinks: ProcessLinkCreateEvent[],
    processXml: string | null,
    processDefinitionId: string | null,
    canInitializeDocument: boolean,
    startableByUser: boolean
  ): FormData {
    const formData = new FormData();
    if (processXml) formData.append('file', new File([processXml], 'process.bpmn'));
    if (processDefinitionId) formData.append('processDefinitionId', processDefinitionId);
    formData.append('processLinks', this.toProcessLinksBlob(processLinks));
    formData.append('canInitializeDocument', String(canInitializeDocument));
    formData.append('startableByUser', String(startableByUser));
    return formData;
  }

  private buildBuildingBlockFormData(
    processLinks: ProcessLinkCreateEvent[],
    processXml: string | null,
    buildingBlockKey: string,
    buildingBlockVersionTag: string
  ): FormData {
    const formData = new FormData();
    if (processXml) {
      formData.append(
        'file',
        new File([processXml], `${buildingBlockKey}-${buildingBlockVersionTag}.bpmn`)
      );
    }
    formData.append('processLinks', this.toProcessLinksBlob(processLinks));
    return formData;
  }

  private toProcessLinksBlob(processLinks: ProcessLinkCreateEvent[]): Blob {
    return new Blob(
      [JSON.stringify(processLinks.map(processLink => this.emptyStringToNull(processLink)))],
      {type: 'application/json'}
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

  public getCompatiblePluginProcessLinks(
    pluginActionDefinitionKey: string
  ): Observable<CompatiblePluginProcessLinks[]> {
    return this.http.get<CompatiblePluginProcessLinks[]>(
      `${this.VALTIMO_ENDPOINT_URI}v1/process-link/plugin?pluginActionDefinitionKey=${pluginActionDefinitionKey}`
    );
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
