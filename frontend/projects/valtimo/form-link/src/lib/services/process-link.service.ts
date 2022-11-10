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
import {ConfigService} from '@valtimo/config';
import {Observable} from 'rxjs';
import {
  FormFlowInstance,
  GetProcessLinkRequest,
  GetProcessLinkResponse,
  SaveProcessLinkRequest,
  UpdateProcessLinkRequest,
} from '../models';
import {HttpClient, HttpParams} from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class ProcessLinkService {
  private readonly VALTIMO_ENDPOINT_URI!: string;

  constructor(private readonly configService: ConfigService, private readonly http: HttpClient) {
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

  updateProcessLink(updateProcessLinkRequest: UpdateProcessLinkRequest): Observable<null> {
    return this.http.put<null>(
      `${this.VALTIMO_ENDPOINT_URI}v1/process-link`,
      updateProcessLinkRequest
    );
  }

  saveProcessLink(saveProcessLinkRequest: SaveProcessLinkRequest): Observable<null> {
    return this.http.post<null>(
      `${this.VALTIMO_ENDPOINT_URI}v1/process-link`,
      saveProcessLinkRequest
    );
  }

  deleteProcessLink(id: string): Observable<null> {
    return this.http.delete<null>(`${this.VALTIMO_ENDPOINT_URI}v1/process-link/${id}`);
  }
}
