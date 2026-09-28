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

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  signal,
  SimpleChanges,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {TranslateModule} from '@ngx-translate/core';
import {ButtonModule, LoadingModule, ModalModule, NotificationModule} from 'carbon-components-angular';
import {ValtimoCdsModalDirective} from '@valtimo/components';
import {
  ExternalPluginDefinition,
  ExternalPluginEndpoint,
  ExternalPluginService,
} from '@valtimo/plugin';
import {PLUGIN_EXTERNAL_REVIEW_MODAL_TEST_IDS} from '../../constants';
import {PluginExternalPermissionsComponent} from '../plugin-external-permissions/plugin-external-permissions.component';

/**
 * Review-and-accept flow for a definition whose host serves different content than what was
 * accepted (a changed plugin package, or — for URL apps without package hashing — a changed
 * manifest). Deliberately identical to the activation flow: the full *pending* permission
 * footprint with the standard acceptance text and all-or-nothing checkbox — no separate
 * changed-permissions treatment. Accepting is a single call: the backend pins the reviewed
 * content, promotes the pending manifest, and re-grants every configuration of the definition to
 * the manifest's declared sets in one transaction.
 */
@Component({
  standalone: true,
  selector: 'valtimo-plugin-external-review-modal',
  templateUrl: './plugin-external-review-modal.component.html',
  styleUrls: ['./plugin-external-review-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    ModalModule,
    ButtonModule,
    LoadingModule,
    NotificationModule,
    ValtimoCdsModalDirective,
    PluginExternalPermissionsComponent,
  ],
})
export class PluginExternalReviewModalComponent implements OnChanges {
  @Input() public open = false;
  @Input() public definition: ExternalPluginDefinition | null = null;

  @Output() public closeEvent = new EventEmitter<void>();
  @Output() public acceptedEvent = new EventEmitter<void>();

  public readonly $loading = signal(false);
  public readonly $errorMessage = signal<string | null>(null);
  public readonly $permissionsValid = signal(false);

  public readonly $pendingEndpoints = signal<Array<ExternalPluginEndpoint>>([]);
  public readonly $pendingEvents = signal<Array<string>>([]);
  public readonly $pendingCapabilities = signal<Array<string>>([]);
  public readonly $pendingEgress = signal<Array<string>>([]);

  protected readonly testIds = PLUGIN_EXTERNAL_REVIEW_MODAL_TEST_IDS;

  constructor(private readonly _externalPluginService: ExternalPluginService) {}

  public ngOnChanges(changes: SimpleChanges): void {
    if (!changes['definition'] && !changes['open']) return;

    this.$errorMessage.set(null);
    this.$permissionsValid.set(false);

    const pending = this.definition?.pendingManifest ?? null;
    this.$pendingEndpoints.set(pending?.permissions?.endpoints ?? []);
    this.$pendingCapabilities.set(pending?.permissions?.capabilities ?? []);
    this.$pendingEgress.set(pending?.permissions?.egress ?? []);
    this.$pendingEvents.set(pending?.eventSubscriptions ?? []);
  }

  public onPermissionsValid(valid: boolean): void {
    this.$permissionsValid.set(valid);
  }

  public onClose(): void {
    this.closeEvent.emit();
  }

  /**
   * Echoes the reviewed pending hash — acceptance of a *specific* state, not of whatever the host
   * serves by now. The backend re-grants the definition's configurations in the same act.
   */
  public onAccept(): void {
    const definition = this.definition;
    const pendingContentHash = definition?.pendingContentHash;
    if (!definition || !pendingContentHash) return;

    this.$loading.set(true);
    this.$errorMessage.set(null);

    this._externalPluginService.acceptDefinitionContent(definition.id, pendingContentHash).subscribe({
      next: () => {
        this.$loading.set(false);
        this.acceptedEvent.emit();
      },
      error: response => {
        this.$loading.set(false);
        this.$errorMessage.set(
          (typeof response?.error?.detail === 'string' && response.error.detail) ||
            (typeof response?.error?.message === 'string' && response.error.message) ||
            null
        );
      },
    });
  }
}
