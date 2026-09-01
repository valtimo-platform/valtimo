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
  OnDestroy,
  Output,
  ViewChild,
  signal,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  ButtonModule,
  LoadingModule,
  ModalModule,
  NotificationContent,
  NotificationModule,
} from 'carbon-components-angular';
import {ValtimoCdsModalDirective} from '@valtimo/components';
import {ExternalPluginHost, ExternalPluginHostConnectionUpdateRequest} from '@valtimo/plugin';
import {BehaviorSubject, Observable, Subscription} from 'rxjs';
import {map} from 'rxjs/operators';
import {PluginHostConnectionFormComponent} from '../plugin-host-connection-form/plugin-host-connection-form.component';

/**
 * Edit-connection modal for a registered host or app (#618): repoint a moved host or broker, or
 * rotate the admin secret, without recreating the row. Wraps the shared connection form in edit
 * mode and emits the dirty-fields-only patch; the embedding page makes the call, renders its
 * failure inline here, and handles the CSP reload when the base URL changed.
 */
@Component({
  standalone: true,
  selector: 'valtimo-plugin-host-edit-modal',
  templateUrl: './plugin-host-edit-modal.component.html',
  styleUrls: ['./plugin-host-edit-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    ModalModule,
    ButtonModule,
    LoadingModule,
    NotificationModule,
    ValtimoCdsModalDirective,
    PluginHostConnectionFormComponent,
  ],
})
export class PluginHostEditModalComponent implements OnDestroy {
  /** Same resolve-via-setter pattern as the add modal: the body only exists while open. */
  @ViewChild(PluginHostConnectionFormComponent)
  public set connectionForm(form: PluginHostConnectionFormComponent | undefined) {
    this._connectionForm = form;
    this._formEditSubscription?.unsubscribe();
    this._formEditSubscription =
      form?.form.valueChanges.subscribe(() => {
        if (this._errorMessage$.value !== null) this._errorMessage$.next(null);
        const controls = form.form.controls;
        this.$secretChanged.set(controls.secret.dirty && !!controls.secret.value?.trim());
        this.$brokerChanged.set(
          controls.eventBrokerAmqpUrl.dirty || controls.eventBrokerExchange.dirty
        );
      }) ?? null;
  }

  @Input() public open = false;
  @Input() public host: ExternalPluginHost | null = null;
  /** Wording only: 'host' on the hosts page, 'app' on the apps page. */
  @Input() public variant: 'host' | 'app' = 'host';
  /** Disables both footer buttons and shows the inline loader while the update call is in flight. */
  @Input() public submitting = false;

  /** Why the last update failed; owned by the parent, cleared here on any edit (add-modal pattern). */
  @Input()
  public set errorMessage(value: string | null) {
    this._errorMessage$.next(value);
  }

  @Output() public closeEvent = new EventEmitter<void>();
  @Output() public submitEvent = new EventEmitter<ExternalPluginHostConnectionUpdateRequest>();

  public formValid = false;

  /** Drives the rotation warning: the host must be restarted with the matching ADMIN_TOKEN. */
  public readonly $secretChanged = signal<boolean>(false);
  /** Drives the consumer-reconnect note for broker edits. */
  public readonly $brokerChanged = signal<boolean>(false);

  private readonly _errorMessage$ = new BehaviorSubject<string | null>(null);
  private _connectionForm: PluginHostConnectionFormComponent | undefined;
  private _formEditSubscription: Subscription | null = null;

  public readonly errorNotification$: Observable<NotificationContent | null> =
    this._errorMessage$.pipe(
      map(message =>
        message === null
          ? null
          : {
              type: 'error',
              title: this._translateService.instant('pluginManagement.editHost.updateFailedTitle'),
              message,
              showClose: false,
              lowContrast: true,
            }
      )
    );

  /**
   * Built from `stream` rather than once in the constructor: at construction time the translation
   * file may not be loaded yet and `instant` would bake the raw keys in. Re-emits on (re)load, and
   * stays one stable object per emission so change detection is not fed a fresh literal every pass.
   */
  public readonly secretWarning$: Observable<NotificationContent> = this._notification(
    'warning',
    'pluginManagement.editHost.secretWarningTitle',
    'pluginManagement.editHost.secretWarningMessage'
  );
  public readonly brokerNote$: Observable<NotificationContent> = this._notification(
    'info',
    'pluginManagement.editHost.brokerNoteTitle',
    'pluginManagement.editHost.brokerNoteMessage'
  );

  constructor(private readonly _translateService: TranslateService) {}

  public ngOnDestroy(): void {
    this._formEditSubscription?.unsubscribe();
  }

  public onFormValidChange(valid: boolean): void {
    this.formValid = valid;
  }

  public onSubmit(): void {
    if (this.submitting) return;
    const patch = this._connectionForm?.buildConnectionPatch();
    if (!patch) return;
    if (Object.keys(patch).length === 0) {
      // Nothing edited — closing is the honest no-op.
      this.onClose();
      return;
    }
    this._errorMessage$.next(null);
    this.submitEvent.emit(patch);
  }

  public onClose(): void {
    this.closeEvent.emit();
    this._errorMessage$.next(null);
    this.$secretChanged.set(false);
    this.$brokerChanged.set(false);
    this._connectionForm?.reset();
  }

  private _notification(
    type: 'warning' | 'info',
    titleKey: string,
    messageKey: string
  ): Observable<NotificationContent> {
    return this._translateService.stream([titleKey, messageKey]).pipe(
      map(translations => ({
        type,
        title: translations[titleKey],
        message: translations[messageKey],
        showClose: false,
        lowContrast: true,
      }))
    );
  }
}
