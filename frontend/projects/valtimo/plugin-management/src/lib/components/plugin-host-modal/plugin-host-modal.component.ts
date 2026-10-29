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
import {ExternalPluginHostCreateRequest, ExternalPluginHostKind} from '@valtimo/plugin';
import {BehaviorSubject, Observable, Subscription} from 'rxjs';
import {map} from 'rxjs/operators';
import {PluginHostConnectionFormComponent} from '../plugin-host-connection-form/plugin-host-connection-form.component';

@Component({
  standalone: true,
  selector: 'valtimo-plugin-host-modal',
  templateUrl: './plugin-host-modal.component.html',
  styleUrls: ['./plugin-host-modal.component.scss'],
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
export class PluginHostModalComponent implements OnDestroy {
  /**
   * The embedded connection form, resolved via a setter because the modal body only exists while
   * the modal is open (`*ngIf`). Editing anything dismisses the previous failure: the admin is
   * already acting on it, and a message that outlives the value it complained about is worse than
   * none.
   */
  @ViewChild(PluginHostConnectionFormComponent)
  public set connectionForm(form: PluginHostConnectionFormComponent | undefined) {
    this._connectionForm = form;
    this._formEditSubscription?.unsubscribe();
    this._formEditSubscription =
      form?.form.valueChanges.subscribe(() => {
        if (this._errorMessage$.value !== null) this._errorMessage$.next(null);
      }) ?? null;
  }

  @Input() public open = false;
  @Input() public kind: ExternalPluginHostKind = 'PLUGIN_HOST';
  /** Disables both footer buttons and shows the inline loader while the create call is in flight. */
  @Input() public submitting = false;

  /**
   * Why the last create attempt failed, rendered above the fields. Owned by the parent (it is the
   * one that makes the call) but cleared here as soon as the admin edits anything, so a stale
   * message never sits above a form they have already corrected.
   */
  @Input()
  public set errorMessage(value: string | null) {
    this._errorMessage$.next(value);
  }

  @Output() public closeEvent = new EventEmitter<void>();
  @Output() public submitEvent = new EventEmitter<ExternalPluginHostCreateRequest>();

  public formValid = false;

  public get isApp(): boolean {
    return this.kind === 'APP';
  }

  private readonly _errorMessage$ = new BehaviorSubject<string | null>(null);
  private _connectionForm: PluginHostConnectionFormComponent | undefined;
  private _formEditSubscription: Subscription | null = null;

  /**
   * The inline notification, built here rather than as a template object literal: a literal would
   * be a new object on every change-detection pass, which keeps the notification component churning.
   */
  public readonly errorNotification$: Observable<NotificationContent | null> =
    this._errorMessage$.pipe(
      map(message =>
        message === null
          ? null
          : {
              type: 'error',
              title: this._translateService.instant('pluginManagement.host.createFailedTitle'),
              message,
              showClose: false,
              lowContrast: true,
            }
      )
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
    const request = this._connectionForm?.buildRequest(this.kind);
    if (!request) return;
    // Deliberately no reset here: a failed create keeps every value the admin typed, with the
    // backend's reason rendered above the fields. The parent closes the modal on success.
    this._errorMessage$.next(null);
    this.submitEvent.emit(request);
  }

  public onClose(): void {
    this.closeEvent.emit();
    this._errorMessage$.next(null);
    this._connectionForm?.reset();
  }
}
