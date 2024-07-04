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
import {HttpClient, HttpParams} from '@angular/common/http';
import {Observable} from 'rxjs';
import {
  ProcessDefinition,
  ProcessDefinitionStartForm,
  ProcessDefinitionStartProcessLink,
  ProcessInstance,
  ProcessInstanceTask,
  ProcessStart,
} from './models';
import {ConfigService, Page} from '@valtimo/config';

@Injectable({
  providedIn: 'root',
})
export class ProcessService {
  private valtimoEndpointUri: string;

  constructor(
    private http: HttpClient,
    configService: ConfigService
  ) {
    this.valtimoEndpointUri = configService.config.valtimoApi.endpointUri;
  }

  getProcessDefinitions(): Observable<ProcessDefinition[]> {
    return this.http.get<ProcessDefinition[]>(`${this.valtimoEndpointUri}v1/process/definition`);
  }

  getProcessDefinitionVersions(key: string): Observable<ProcessDefinition[]> {
    return this.http.get<ProcessDefinition[]>(
      `${this.valtimoEndpointUri}v1/process/definition/${key}/versions`
    );
  }

  getProcessDefinition(key: string): Observable<ProcessDefinition> {
    return this.http.get<ProcessDefinition>(
      `${this.valtimoEndpointUri}v1/process/definition/${key}`
    );
  }

  getProcessDefinitionStartFormData(
    processDefinitionKey: string
  ): Observable<ProcessDefinitionStartForm> {
    return this.http.get<ProcessDefinitionStartForm>(
      `${this.valtimoEndpointUri}v1/process/definition/${processDefinitionKey}/start-form`
    );
  }

  getProcessDefinitionStartProcessLink(
    processDefinitionId: string,
    documentId: string,
    documentDefinitionName: string
  ): Observable<ProcessDefinitionStartProcessLink> {
    const params = {};
    if (documentId != null) {
      params['documentId'] = documentId;
    }
    if (documentDefinitionName != null) {
      params['documentDefinitionName'] = documentDefinitionName;
    }

    return this.http.get<ProcessDefinitionStartProcessLink>(
      `${this.valtimoEndpointUri}v1/process-definition/${processDefinitionId}/start-form`,
      {
        params,
      }
    );
  }

  startProcesInstance(
    key: string,
    businessKey: string,
    variables: Map<string, any>
  ): Observable<any> {
    return this.http.post<ProcessStart>(
      `${this.valtimoEndpointUri}v1/process/definition/${key}/${businessKey}/start`,
      variables
    );
  }

  getProcessDefinitionXml(processDefinitionId: string): Observable<any> {
    return this.http.get(
      `${this.valtimoEndpointUri}v1/process/definition/${processDefinitionId}/xml`
    );
  }

  getProcessXml(id: string): Observable<any> {
    return this.http.get(`${this.valtimoEndpointUri}v1/process/${id}/xml`);
  }

  getProcessCount(id: string): Observable<any> {
    return this.http.post(`${this.valtimoEndpointUri}v1/process/definition/${id}/count`, {
      key: id,
      processVariables: [{'@type': 'boolean', name: 'active', value: true}],
    });
  }

  getProcessHeatmapCount(processDefinition: ProcessDefinition): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.valtimoEndpointUri}v1/process/definition/${processDefinition.key}/heatmap/count?version=${processDefinition.version}`
    );
  }

  getProcessHeatmapDuration(processDefinition: ProcessDefinition): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.valtimoEndpointUri}v1/process/definition/${processDefinition.key}/heatmap/duration?version=${processDefinition.version}`
    );
  }

  getProcessInstances(key: string, page: number, size: number, sort: string): Observable<any> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sort', sort);

    return this.http.post<Page<ProcessInstance>>(
      `${this.valtimoEndpointUri}v2/process/${key}/search`,
      {},
      {params}
    );
  }

  getProcessInstance(processInstanceId: string): Observable<ProcessInstance> {
    return this.http.get<ProcessInstance>(
      `${this.valtimoEndpointUri}v1/process/${processInstanceId}`,
      {}
    );
  }

  getProcessInstanceTasks(id: string): Observable<ProcessInstanceTask[]> {
    return this.http.get<ProcessInstanceTask[]>(
      `${this.valtimoEndpointUri}v1/process/${id}/tasks`,
      {}
    );
  }

  getProcessInstanceVariables(id: string, variableNames: Array<any>): Observable<any> {
    return this.http.post(
      `${this.valtimoEndpointUri}v1/process-instance/${id}/variables`,
      variableNames
    );
  }

  addProcessInstancesDefaultVariablesValues(processInstances: Array<any>) {
    processInstances.forEach(processInstance => this.addDefaultVariablesValues(processInstance));
    return processInstances;
  }

  addDefaultVariablesValues(processInstance: any) {
    if (!processInstance['startUser']) {
      processInstance.startUser = processInstance.startUserId;
    }
    if (!processInstance['processStarted']) {
      processInstance.processStarted = processInstance.startTime;
    }
    if (!processInstance['processEnded']) {
      processInstance.processEnded = processInstance.endTime;
    }
    if (!processInstance['active']) {
      processInstance.active = processInstance.endTime == null;
    }
    return processInstance;
  }

  getInstancesStatistics(fromDate?: string, toDate?: string, processFilter?: string) {
    const params = new HttpParams();
    params.set('fromDate', fromDate);
    params.set('toDate', toDate);
    params.set('processFilter', processFilter);
    return this.http.get<any[]>(`${this.valtimoEndpointUri}v1/reporting/instancesstatistics`, {
      params,
    });
  }

  deployProcess(processXml: string) {
    const formData = new FormData();
    formData.append('file', new File([processXml], 'process.bpmn'));
    formData.append('deployment-name', 'valtimoConsoleApp');
    formData.append('deployment-source', 'process application');
    return this.http.post(`${this.valtimoEndpointUri}v1/process/definition/deployment`, formData);
  }

  migrateProcess(
    processDefinition1Id: string,
    processDefinition2Id: string,
    params: any
  ): Observable<any> {
    return this.http.post(
      `${this.valtimoEndpointUri}v1/process/definition/${processDefinition1Id}/${processDefinition2Id}/migrate`,
      params
    );
  }
}
