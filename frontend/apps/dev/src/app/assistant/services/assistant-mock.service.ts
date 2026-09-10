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

import {Injectable} from '@angular/core';
import {delay, Observable, of} from 'rxjs';
import {
  AssistantConfigResponseDto,
  AssistantResponseDto,
  ChatRequestDto,
  ConfirmActionResponseDto,
  PageDto,
  SessionResponseDto,
} from '../models';
import {AssistantTransport} from './assistant-transport';

/*
 * Stand-in for backend/assistant until its endpoints answer. It deliberately reproduces the
 * real backend's current quirks — pending action id inside the reply text, failures as
 * plain messages — so swapping in AssistantApiService holds no surprises.
 */
@Injectable({providedIn: 'root'})
export class AssistantMockService implements AssistantTransport {
  private readonly _LATENCY_MS = 700;

  private _sessionId = crypto.randomUUID();

  public getConfig(): Observable<AssistantConfigResponseDto> {
    return of({enabled: true, configured: true}).pipe(delay(this._LATENCY_MS));
  }

  public chat(request: ChatRequestDto): Observable<AssistantResponseDto> {
    const normalized = request.message.toLowerCase();
    const wantsChange = normalized.includes('toevoeg') || normalized.includes('add');
    const response: AssistantResponseDto = {
      message: this.replyTo(request.message),
      sessionId: request.sessionId ?? this._sessionId,
      action: wantsChange
        ? {
            type: 'confirmation_required',
            pendingActionId: crypto.randomUUID(),
            preview: {
              description: 'Add a view permission on CaseDefinition to ROLE_ADMIN.',
              affectedResources: ['ROLE_ADMIN'],
              diff: {
                before: 'permissions:\n  - resourceType: CaseDefinition\n    action: view_list',
                after:
                  'permissions:\n  - resourceType: CaseDefinition\n    action: view_list\n' +
                  '  - resourceType: CaseDefinition\n    action: view',
              },
            },
          }
        : null,
    };

    return of(response).pipe(delay(this._LATENCY_MS));
  }

  public confirmAction(pendingActionId: string): Observable<ConfirmActionResponseDto> {
    return of({success: true, result: {pendingActionId}}).pipe(delay(this._LATENCY_MS));
  }

  public cancelAction(): Observable<void> {
    return of(undefined).pipe(delay(this._LATENCY_MS));
  }

  public getSessions(page = 0, size = 20): Observable<PageDto<SessionResponseDto>> {
    return of({
      content: [this.session()],
      totalElements: 1,
      totalPages: 1,
      number: page,
      size,
    }).pipe(delay(this._LATENCY_MS));
  }

  public getSession(sessionId: string): Observable<SessionResponseDto> {
    return of({...this.session(), id: sessionId}).pipe(delay(this._LATENCY_MS));
  }

  public updateSessionTitle(sessionId: string, title: string): Observable<SessionResponseDto> {
    return of({...this.session(), id: sessionId, title}).pipe(delay(this._LATENCY_MS));
  }

  public deleteSession(): Observable<void> {
    return of(undefined).pipe(delay(this._LATENCY_MS));
  }

  private session(): SessionResponseDto {
    const now = new Date().toISOString();

    return {id: this._sessionId, title: 'Mock conversation', createdAt: now, lastActivityAt: now};
  }

  private replyTo(message: string): string {
    const normalized = message.toLowerCase();

    if (normalized.includes('toevoeg') || normalized.includes('add')) {
      return [
        '- permissions:',
        '+ permissions:',
        '+   - resourceType: com.ritense.case_.domain.definition.CaseDefinition',
        '+     action: view',
      ].join('\n');
    }

    if (normalized.includes('verwijder') || normalized.includes('remove')) {
      return 'Which permission should I remove? Name the resource type and the action.';
    }

    if (normalized.includes('bewerk') || normalized.includes('edit')) {
      return 'Tell me which rule to edit and what it should become.';
    }

    return `I can read case and process definitions and prepare changes for you to confirm. You said: "${message}"`;
  }
}
