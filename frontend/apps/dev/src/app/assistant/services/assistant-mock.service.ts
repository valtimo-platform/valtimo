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

const MOCK_BPMN_BEFORE = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="review-process" isExecutable="true">
    <bpmn:startEvent id="start" />
    <bpmn:sequenceFlow id="f1" sourceRef="start" targetRef="end" />
    <bpmn:endEvent id="end" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="d">
    <bpmndi:BPMNPlane id="pl" bpmnElement="review-process">
      <bpmndi:BPMNShape id="start_di" bpmnElement="start"><dc:Bounds x="150" y="100" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="end_di" bpmnElement="end"><dc:Bounds x="300" y="100" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="f1_di" bpmnElement="f1"><di:waypoint x="186" y="118" /><di:waypoint x="300" y="118" /></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

const MOCK_BPMN_AFTER = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="review-process" isExecutable="true">
    <bpmn:startEvent id="start" />
    <bpmn:userTask id="review" name="Review" />
    <bpmn:sequenceFlow id="f1" sourceRef="start" targetRef="review" />
    <bpmn:sequenceFlow id="f2" sourceRef="review" targetRef="end" />
    <bpmn:endEvent id="end" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="d">
    <bpmndi:BPMNPlane id="pl" bpmnElement="review-process">
      <bpmndi:BPMNShape id="start_di" bpmnElement="start"><dc:Bounds x="150" y="100" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="review_di" bpmnElement="review"><dc:Bounds x="250" y="78" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="end_di" bpmnElement="end"><dc:Bounds x="420" y="100" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="f1_di" bpmnElement="f1"><di:waypoint x="186" y="118" /><di:waypoint x="250" y="118" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="f2_di" bpmnElement="f2"><di:waypoint x="350" y="118" /><di:waypoint x="420" y="118" /></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

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
    const wantsProcessChange = wantsChange && normalized.includes('process');
    const response: AssistantResponseDto = {
      message: this.replyTo(request.message),
      sessionId: request.sessionId ?? this._sessionId,
      action: wantsProcessChange
        ? {
            type: 'confirmation_required',
            pendingActionId: crypto.randomUUID(),
            preview: {
              description: "Add a 'Review' user task to the review process.",
              affectedResources: ['review-process'],
              diff: {
                format: 'bpmn',
                before: MOCK_BPMN_BEFORE,
                after: MOCK_BPMN_AFTER,
              },
            },
          }
        : wantsChange
          ? {
              type: 'confirmation_required',
              pendingActionId: crypto.randomUUID(),
              preview: {
                description: "Add a 'Huisnummer' field to the address form.",
                affectedResources: ['bezwaar:1.0.0:address-form'],
                diff: {
                  format: 'formio',
                  before: JSON.stringify({
                    display: 'form',
                    components: [
                      {key: 'aanhef', label: 'Aanhef', type: 'textfield', input: true},
                      {key: 'postcode', label: 'Postcode', type: 'textfield', input: true},
                    ],
                  }),
                  after: JSON.stringify({
                    display: 'form',
                    components: [
                      {key: 'aanhef', label: 'Aanhef', type: 'textfield', input: true},
                      {key: 'postcode', label: 'Postcode', type: 'textfield', input: true},
                      {key: 'huisnummer', label: 'Huisnummer', type: 'number', input: true},
                    ],
                  }),
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
