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

import {Inject, Injectable, signal} from '@angular/core';
import {Router} from '@angular/router';
import {finalize} from 'rxjs/operators';
import {ASSISTANT_GENERIC_GREETING_KEY, ASSISTANT_GENERIC_SUGGESTION_KEYS} from '../constants';
import {AssistantDegradedReason, AssistantMessage, AssistantResponseDto} from '../models';
import {resolveAssistantPageContext, toAssistantReply, toPageContextDto} from '../utils';
import {ASSISTANT_TRANSPORT, AssistantTransport} from './assistant-transport';

@Injectable({providedIn: 'root'})
export class AssistantChatService {
  public readonly $messages = signal<ReadonlyArray<AssistantMessage>>([]);
  public readonly $awaitingReply = signal<boolean>(false);
  public readonly $pendingActionId = signal<string | null>(null);
  public readonly $pendingPreview = signal<string | null>(null);
  public readonly $degraded = signal<AssistantDegradedReason | null>(null);

  private _sessionId: string | null = null;

  constructor(
    @Inject(ASSISTANT_TRANSPORT) private readonly transport: AssistantTransport,
    private readonly router: Router
  ) {}

  public openConversation(): void {
    if (this.$messages().length) return;

    const resolved = resolveAssistantPageContext(this.router.url);

    this.$messages.set([
      {
        id: crypto.randomUUID(),
        author: 'assistant',
        textKey: resolved?.definition.greetingKey ?? ASSISTANT_GENERIC_GREETING_KEY,
        timestamp: new Date(),
        suggestionKeys: resolved?.definition.suggestionKeys ?? ASSISTANT_GENERIC_SUGGESTION_KEYS,
      },
    ]);
  }

  public sendMessage(text: string): void {
    const trimmed = text.trim();

    if (!trimmed || this.$awaitingReply()) return;

    this.appendMessage({
      id: crypto.randomUUID(),
      author: 'user',
      text: trimmed,
      timestamp: new Date(),
    });

    this.$awaitingReply.set(true);
    this.$degraded.set(null);
    this.$pendingActionId.set(null);
    this.$pendingPreview.set(null);

    this.transport
      .chat({
        message: trimmed,
        sessionId: this._sessionId ?? undefined,
        context: toPageContextDto(this.router.url),
      })
      .pipe(finalize(() => this.$awaitingReply.set(false)))
      .subscribe({
        next: dto => this.handleReply(dto),
        error: () => this.$degraded.set('error'),
      });
  }

  public confirmPendingAction(): void {
    const pendingActionId = this.$pendingActionId();

    if (!pendingActionId) return;

    this.$pendingActionId.set(null);
    this.$pendingPreview.set(null);
    this.transport.confirmAction(pendingActionId).subscribe({
      next: response =>
        this.appendAssistantNotice(
          response.success ? 'assistant.confirmation.applied' : 'assistant.confirmation.failed'
        ),
      error: () => this.appendAssistantNotice('assistant.confirmation.failed'),
    });
  }

  public cancelPendingAction(): void {
    const pendingActionId = this.$pendingActionId();

    if (!pendingActionId) return;

    this.$pendingActionId.set(null);
    this.$pendingPreview.set(null);
    this.transport.cancelAction(pendingActionId).subscribe({
      next: () => this.appendAssistantNotice('assistant.confirmation.cancelled'),
      error: () => this.appendAssistantNotice('assistant.confirmation.failed'),
    });
  }

  private handleReply(dto: AssistantResponseDto): void {
    const reply = toAssistantReply(dto);

    this._sessionId = reply.sessionId;
    this.$degraded.set(reply.degraded);
    this.$pendingActionId.set(reply.pendingActionId);
    this.$pendingPreview.set(reply.previewDescription);

    this.appendMessage({
      id: crypto.randomUUID(),
      author: 'assistant',
      text: reply.text,
      timestamp: new Date(),
    });
  }

  private appendAssistantNotice(textKey: string): void {
    this.appendMessage({
      id: crypto.randomUUID(),
      author: 'assistant',
      textKey,
      timestamp: new Date(),
    });
  }

  private appendMessage(message: AssistantMessage): void {
    this.$messages.update(messages => [...messages, message]);
  }
}
