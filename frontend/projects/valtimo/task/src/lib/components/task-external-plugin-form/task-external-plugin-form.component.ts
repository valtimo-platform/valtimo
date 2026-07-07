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
} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {
  ExternalPluginIframeComponent,
  ExternalPluginUserTokenResponse,
  ExternalPluginUserTokenService,
} from '@valtimo/plugin';
import {LoadingModule, NotificationModule} from 'carbon-components-angular';
import {Subscription} from 'rxjs';

type FormState = 'loading' | 'ready' | 'error';

/**
 * Renders an external plugin's `task-form` bundle for a user task. Mirrors the case-tab consumer: it
 * mints the downscoped user token (re-minting before the ≤15-min expiry) and embeds
 * `<valtimo-external-plugin-iframe>`. The plugin owns the submission and completes the task itself
 * (through its backend, under the user token); when it reports completion this component emits
 * `completedEvent` so the task modal closes and the list refreshes.
 */
@Component({
  selector: 'valtimo-task-external-plugin-form',
  templateUrl: './task-external-plugin-form.component.html',
  standalone: true,
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
  @Input() public context: Record<string, unknown> = {};

  @Output() public readonly completedEvent = new EventEmitter<void>();

  public readonly $state = signal<FormState>('loading');
  public readonly $userToken = signal<string | null>(null);
  public readonly $pluginDataUrl = signal<string | null>(null);

  private readonly _subscriptions = new Subscription();
  private _reMintHandle: number | null = null;

  constructor(private readonly userTokenService: ExternalPluginUserTokenService) {}

  public ngOnInit(): void {
    this._subscriptions.add(
      this.userTokenService.mintUserToken(this.configurationId).subscribe({
        next: token => this._onToken(token),
        error: () => this.$state.set('error'),
      })
    );
  }

  public ngOnDestroy(): void {
    this._clearReMint();
    this._subscriptions.unsubscribe();
  }

  public onTaskCompleted(): void {
    this.completedEvent.emit();
  }

  private _onToken(token: ExternalPluginUserTokenResponse): void {
    this.$userToken.set(token.userToken);
    this.$pluginDataUrl.set(this._derivePluginDataUrl(this.bundleUrl));
    this.$state.set('ready');
    this._scheduleReMint(token.expiresAt);
  }

  /**
   * Derives the plugin host data route (`{base}/data`) from the bundle URL
   * (`{base}/bundles/task-form.html`). Returns null when the URL doesn't follow the bundle layout.
   */
  private _derivePluginDataUrl(bundleUrl: string): string | null {
    const idx = bundleUrl.indexOf('/bundles/');
    return idx >= 0 ? `${bundleUrl.substring(0, idx)}/data` : null;
  }

  /**
   * Re-mints the downscoped user token shortly before its (≤15-min) expiry so a long-lived form does
   * not submit with a stale token. Purely parent-side — the iframe never holds a token.
   */
  private _scheduleReMint(expiresAt: string): void {
    this._clearReMint();
    const expiry = new Date(expiresAt).getTime();
    const delay = Math.max(expiry - Date.now() - 60_000, 30_000);
    this._reMintHandle = window.setTimeout(() => {
      this._subscriptions.add(
        this.userTokenService.mintUserToken(this.configurationId).subscribe(token => {
          this.$userToken.set(token.userToken);
          this._scheduleReMint(token.expiresAt);
        })
      );
    }, delay);
  }

  private _clearReMint(): void {
    if (this._reMintHandle !== null) {
      window.clearTimeout(this._reMintHandle);
      this._reMintHandle = null;
    }
  }
}
