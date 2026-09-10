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
import {UserProviderService} from '@valtimo/security';
import {finalize, take} from 'rxjs/operators';
import {ASSISTANT_GENERIC_GREETING_KEY, ASSISTANT_GENERIC_SUGGESTION_KEYS} from '../constants';
import {
  AssistantDegradedReason,
  AssistantMessage,
  AssistantPendingAction,
  AssistantResponseDto,
} from '../models';
import {resolveAssistantPageContext, toAssistantReply, toPageContextDto} from '../utils';
import {AssistantRefreshService} from './assistant-refresh.service';
import {ASSISTANT_TRANSPORT, AssistantTransport} from './assistant-transport';

interface StoredConversation {
  userId: string | null;
  sessionId: string | null;
  messages: Array<Omit<AssistantMessage, 'timestamp'> & {timestamp: string}>;
}

@Injectable({providedIn: 'root'})
export class AssistantChatService {
  public readonly $messages = signal<ReadonlyArray<AssistantMessage>>([]);
  public readonly $awaitingReply = signal<boolean>(false);
  public readonly $pendingAction = signal<AssistantPendingAction | null>(null);
  // The confirm call mutates definitions, so the buttons must not be clickable twice.
  public readonly $applying = signal<boolean>(false);
  public readonly $degraded = signal<AssistantDegradedReason | null>(null);

  /*
   * Stopgap so a page reload does not wipe the chat. Remove once the backend exposes
   * GET /sessions/{id}/messages: the transcript should be restored from the server, which
   * is what the model actually remembers. sessionStorage keeps this to the current tab, so
   * a stale conversation cannot resurface days later.
   */
  private readonly _STORAGE_KEY = 'valtimoAssistantConversation';
  private readonly _MAX_STORED_MESSAGES = 50;

  private _sessionId: string | null = null;

  constructor(
    @Inject(ASSISTANT_TRANSPORT) private readonly transport: AssistantTransport,
    private readonly refreshService: AssistantRefreshService,
    private readonly router: Router,
    private readonly userProviderService: UserProviderService
  ) {}

  public openConversation(): void {
    if (this.$messages().length || this.restoreConversation()) return;

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
    this.$pendingAction.set(null);

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
    const pendingAction = this.$pendingAction();

    if (!pendingAction || this.$applying()) return;

    this.$applying.set(true);
    this.transport
      .confirmAction(pendingAction.id)
      .pipe(finalize(() => this.closePendingAction()))
      .subscribe({
        next: response => {
          this.appendAssistantNotice(
            response.success ? 'assistant.confirmation.applied' : 'assistant.confirmation.failed'
          );

          // The screen behind the chat is still showing the old data. Hand that off: a
          // screen that registered a refresh handler updates itself, otherwise the service
          // falls back to a reload.
          if (response.success) {
            this.refreshService.notifyChangeApplied({
              pendingActionId: pendingAction.id,
              description: pendingAction.description,
              affectedResources: pendingAction.affectedResources ?? [],
            });
          }
        },
        error: () => this.appendAssistantNotice('assistant.confirmation.failed'),
      });
  }

  public cancelPendingAction(): void {
    const pendingAction = this.$pendingAction();

    if (!pendingAction || this.$applying()) return;

    this.$applying.set(true);
    this.transport
      .cancelAction(pendingAction.id)
      .pipe(finalize(() => this.closePendingAction()))
      .subscribe({
        next: () => this.appendAssistantNotice('assistant.confirmation.cancelled'),
        error: () => this.appendAssistantNotice('assistant.confirmation.failed'),
      });
  }

  private closePendingAction(): void {
    this.$applying.set(false);
    this.$pendingAction.set(null);
  }

  private handleReply(dto: AssistantResponseDto): void {
    const reply = toAssistantReply(dto);

    this._sessionId = reply.sessionId;
    this.$degraded.set(reply.degraded);
    this.$pendingAction.set(reply.pendingAction);

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
    this.persistConversation();
  }

  private restoreConversation(): boolean {
    const stored = this.readStorage();

    if (!stored?.messages?.length) return false;

    this._sessionId = stored.sessionId ?? null;
    this.$messages.set(
      stored.messages.map(message => ({...message, timestamp: new Date(message.timestamp)}))
    );

    // A pending action is deliberately not restored: it expires server-side after five
    // minutes, so a modal rebuilt from cache would offer a button that can only fail.
    return true;
  }

  private persistConversation(): void {
    try {
      sessionStorage.setItem(
        this._STORAGE_KEY,
        JSON.stringify({
          userId: this.currentUserId(),
          sessionId: this._sessionId,
          messages: this.$messages().slice(-this._MAX_STORED_MESSAGES),
        })
      );
    } catch {
      // Private mode or blocked storage: the chat still works, it just will not survive a reload.
    }
  }

  private readStorage(): StoredConversation | null {
    try {
      const raw = sessionStorage.getItem(this._STORAGE_KEY);
      const stored: StoredConversation | null = raw ? JSON.parse(raw) : null;

      // The tab survives a logout, so a transcript from another account must not reappear.
      if (stored && stored.userId !== this.currentUserId()) {
        sessionStorage.removeItem(this._STORAGE_KEY);

        return null;
      }

      return stored;
    } catch {
      return null;
    }
  }

  private currentUserId(): string | null {
    let userId: string | null = null;

    // The user subject replays, so this resolves synchronously once the app has booted.
    this.userProviderService
      .getUserSubject()
      .pipe(take(1))
      .subscribe(user => (userId = user?.email ?? null));

    return userId;
  }
}
