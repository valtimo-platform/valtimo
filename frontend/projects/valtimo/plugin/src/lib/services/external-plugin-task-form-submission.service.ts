/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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

import {HttpClient, HttpParams} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {ConfigService} from '@valtimo/shared';
import {Observable} from 'rxjs';
import {ExternalPluginTaskFormSubmissionResult} from '../models';

/**
 * Submits an external-plugin `task-form`'s collected data to GZAC, which completes the user task the
 * standard way (value resolvers, document updates, `TaskCompleted` event) — no plugin backend code,
 * no endpoint grant and no downscoped user token required for the common case. The Angular parent
 * calls this (not the iframe) under the logged-in user's Keycloak session, so the normal COMPLETE
 * permission governs the task. The authoritative `taskInstanceId` comes from the process-link result,
 * never from the iframe.
 */
@Injectable({
  providedIn: 'root',
})
export class ExternalPluginTaskFormSubmissionService {
  private readonly _baseUrl: string;

  constructor(
    private readonly _http: HttpClient,
    configService: ConfigService
  ) {
    this._baseUrl = `${configService.config.valtimoApi.endpointUri}v1/process-link`;
  }

  public submit(
    processLinkId: string,
    data: Record<string, unknown>,
    documentId?: string | null,
    taskInstanceId?: string | null
  ): Observable<ExternalPluginTaskFormSubmissionResult> {
    let params = new HttpParams();
    if (documentId) params = params.set('documentId', documentId);
    if (taskInstanceId) params = params.set('taskInstanceId', taskInstanceId);

    return this._http.post<ExternalPluginTaskFormSubmissionResult>(
      `${this._baseUrl}/${processLinkId}/external-plugin-task-form/submission`,
      data,
      {params}
    );
  }
}
