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

import {InjectionToken} from '@angular/core';
import {Observable} from 'rxjs';
import {
  AssistantConfigResponseDto,
  AssistantResponseDto,
  ChatRequestDto,
  ConfirmActionResponseDto,
  PageDto,
  SessionResponseDto,
} from '../models';

// Mirrors every endpoint AssistantResource exposes.
interface AssistantTransport {
  getConfig(): Observable<AssistantConfigResponseDto>;
  chat(request: ChatRequestDto): Observable<AssistantResponseDto>;
  confirmAction(pendingActionId: string): Observable<ConfirmActionResponseDto>;
  cancelAction(pendingActionId: string): Observable<void>;
  getSessions(page?: number, size?: number): Observable<PageDto<SessionResponseDto>>;
  getSession(sessionId: string): Observable<SessionResponseDto>;
  updateSessionTitle(sessionId: string, title: string): Observable<SessionResponseDto>;
  deleteSession(sessionId: string): Observable<void>;
}

// Swap the provider in app.module to talk to the real backend once its endpoints answer.
const ASSISTANT_TRANSPORT = new InjectionToken<AssistantTransport>('ASSISTANT_TRANSPORT');

export {ASSISTANT_TRANSPORT, AssistantTransport};
