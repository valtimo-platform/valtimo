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

import {HttpErrorResponse} from '@angular/common/http';
import {CommonModule} from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  signal,
  ViewChild,
} from '@angular/core';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  derivePluginDataUrl,
  ExternalPluginIframeComponent,
  ExternalPluginSessionService,
  ExternalPluginTaskFormSubmissionResult,
  ExternalPluginTaskFormSubmissionService,
} from '@valtimo/plugin';
import {LoadingModule, NotificationModule} from 'carbon-components-angular';
import {Subscription} from 'rxjs';

type FormState = 'loading' | 'ready' | 'error';

/**
 * Renders an external plugin's `task-form` bundle for a user task and owns the submission on the
 * plugin's behalf.
 *
 * The default path (Level 0/1): the plugin bundle calls `sdk.submitTask(data)`, which surfaces here
 * as `submitTaskEvent`; this component POSTs the data to GZAC's task-form submission endpoint (as the
 * logged-in user) and GZAC completes the task the standard way. On success it emits `completedEvent`
 * so the modal closes and the list refreshes; on validation failure it replies to the iframe so the
 * plugin can render the errors without being torn down.
 *
 * The escape hatch (Level 2): a plugin may still complete the task itself (via `request()` +
 * `gzacApi.asUser`) and emit `taskCompleted`, which arrives as `taskCompletedEvent` → `completedEvent`.
 * For that path the downscoped user token is minted below; for Level 0/1 the token is not required
 * (minting is best-effort so a pure form still works if it cannot be minted).
 */
@Component({
  selector: 'valtimo-task-external-plugin-form',
  templateUrl: './task-external-plugin-form.component.html',
  styleUrls: ['./task-external-plugin-form.component.scss'],
  standalone: true,
  providers: [ExternalPluginSessionService],
  imports: [
    CommonModule,
    LoadingModule,
    NotificationModule,
    TranslateModule,
    ExternalPluginIframeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskExternalPluginFormComponent implements OnInit, OnDestroy {
  @Input({required: true}) public bundleUrl!: string;
  @Input({required: true}) public configurationId!: string;
  @Input({required: true}) public processLinkId!: string;
  @Input() public context: Record<string, unknown> = {};

  @Output() public readonly completedEvent = new EventEmitter<void>();

  @ViewChild(ExternalPluginIframeComponent)
  private readonly _iframe?: ExternalPluginIframeComponent;

  public readonly $state = signal<FormState>('loading');
  public readonly $pluginDataUrl = signal<string | null>(null);

  private readonly _subscriptions = new Subscription();

  constructor(
    protected readonly sessionService: ExternalPluginSessionService,
    private readonly submissionService: ExternalPluginTaskFormSubmissionService,
    private readonly translateService: TranslateService
  ) {}

  public ngOnInit(): void {
    // The session service owns minting, the pre-expiry re-mint and retry-with-backoff on failure.
    this.sessionService.startSession(this.configurationId).subscribe({
      next: () => this._onReady(),
      // A token is only needed for the Level 2 escape hatch (and live GZAC reads while editing);
      // Level 0/1 submission goes through GZAC directly. Render anyway so a pure form still works.
      error: () => this._onReady(),
    });
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  /** Level 2: the plugin completed the task itself; just finalise the UI. */
  public onTaskCompleted(): void {
    this.completedEvent.emit();
  }

  /** Level 0/1: the plugin handed data up; submit it to GZAC, which completes the task. */
  public onSubmitTask(event: {correlationId: string; data: Record<string, unknown>}): void {
    const documentId = (this.context['documentId'] as string) ?? null;
    const taskInstanceId = (this.context['taskId'] as string) ?? null;

    this._subscriptions.add(
      this.submissionService
        .submit(this.processLinkId, event.data, documentId, taskInstanceId)
        .subscribe({
          next: () => {
            this._iframe?.sendSubmitResult({correlationId: event.correlationId, ok: true});
            this.completedEvent.emit();
          },
          error: (error: HttpErrorResponse) => this._onSubmitError(event.correlationId, error),
        })
    );
  }

  private _onSubmitError(correlationId: string, error: HttpErrorResponse): void {
    // A 400 carries the structured submission result (validation / plugin-hook rejection); any other
    // status is an unexpected failure surfaced with a generic message.
    const body = error?.error as ExternalPluginTaskFormSubmissionResult | undefined;
    const fieldErrors = body?.fieldErrors ?? {};
    const errors =
      body?.errors && body.errors.length > 0
        ? body.errors
        : [this.translateService.instant('taskDetail.externalPluginTaskForm.submitError')];
    this._iframe?.sendSubmitResult({correlationId, ok: false, errors, fieldErrors});
  }

  private _onReady(): void {
    this.$pluginDataUrl.set(derivePluginDataUrl(this.bundleUrl));
    this.$state.set('ready');
  }
}
