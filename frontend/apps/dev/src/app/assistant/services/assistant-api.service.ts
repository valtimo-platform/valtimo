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

import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {ConfigService, InterceptorSkipHeader} from '@valtimo/shared';
import {Observable} from 'rxjs';
import {
  AssistantConfigResponseDto,
  AssistantResponseDto,
  ChatRequestDto,
  ConfirmActionResponseDto,
  PageDto,
  SessionResponseDto,
} from '../models';
import {AssistantTransport} from './assistant-transport';

@Injectable({providedIn: 'root'})
export class AssistantApiService implements AssistantTransport {
  private readonly _endpointUri: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly http: HttpClient
  ) {
    this._endpointUri = `${this.configService.config.valtimoApi.endpointUri}v1/assistant/`;
  }

  // Silent on failure — an app without the assistant module should not raise an error toast.
  public getConfig(): Observable<AssistantConfigResponseDto> {
    return this.http.get<AssistantConfigResponseDto>(`${this._endpointUri}config`, {
      headers: InterceptorSkipHeader,
    });
  }

  public chat(request: ChatRequestDto): Observable<AssistantResponseDto> {
    return this.http.post<AssistantResponseDto>(`${this._endpointUri}chat`, request);
  }

  public confirmAction(pendingActionId: string): Observable<ConfirmActionResponseDto> {
    return this.http.post<ConfirmActionResponseDto>(
      `${this._endpointUri}confirm/${pendingActionId}`,
      {}
    );
  }

  public cancelAction(pendingActionId: string): Observable<void> {
    return this.http.post<void>(`${this._endpointUri}cancel/${pendingActionId}`, {});
  }

  public getSessions(page = 0, size = 20): Observable<PageDto<SessionResponseDto>> {
    return this.http.get<PageDto<SessionResponseDto>>(`${this._endpointUri}sessions`, {
      params: {page, size},
    });
  }

  public getSession(sessionId: string): Observable<SessionResponseDto> {
    return this.http.get<SessionResponseDto>(`${this._endpointUri}sessions/${sessionId}`);
  }

  public updateSessionTitle(sessionId: string, title: string): Observable<SessionResponseDto> {
    return this.http.put<SessionResponseDto>(`${this._endpointUri}sessions/${sessionId}`, {title});
  }

  public deleteSession(sessionId: string): Observable<void> {
    return this.http.delete<void>(`${this._endpointUri}sessions/${sessionId}`);
  }
}
