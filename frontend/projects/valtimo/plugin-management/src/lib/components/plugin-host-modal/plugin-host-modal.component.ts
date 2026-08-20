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

import {ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges} from '@angular/core';
import {CommonModule} from '@angular/common';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {
  ButtonModule,
  InputModule,
  LayerModule,
  LoadingModule,
  ModalModule,
  NotificationContent,
  NotificationModule,
} from 'carbon-components-angular';
import {SelectItem, SelectModule, ValtimoCdsModalDirective} from '@valtimo/components';
import {
  ExternalPluginEventQueueMode,
  ExternalPluginHostCreateRequest,
  ExternalPluginHostKind,
  ExternalPluginService,
} from '@valtimo/plugin';
import {BehaviorSubject, Observable, Subscription} from 'rxjs';
import {map} from 'rxjs/operators';

/** A browser origin: `scheme://host[:port]`, no path — the shape the backend stores. */
const ORIGIN_PATTERN = /^https?:\/\/[^/\s]+$/;

@Component({
  standalone: true,
  selector: 'valtimo-plugin-host-modal',
  templateUrl: './plugin-host-modal.component.html',
  styleUrls: ['./plugin-host-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    ReactiveFormsModule,
    ModalModule,
    ButtonModule,
    InputModule,
    LayerModule,
    LoadingModule,
    NotificationModule,
    SelectModule,
    ValtimoCdsModalDirective,
  ],
})
export class PluginHostModalComponent implements OnChanges, OnInit, OnDestroy {
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

  public get isApp(): boolean {
    return this.kind === 'APP';
  }

  private readonly _errorMessage$ = new BehaviorSubject<string | null>(null);
  public readonly errorMessage$ = this._errorMessage$.asObservable();

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

  public readonly form = new FormGroup({
    name: new FormControl('', Validators.required),
    baseUrl: new FormControl('', [Validators.required, Validators.pattern(/^https?:\/\/.+/)]),
    secret: new FormControl('', Validators.required),
    gzacCallbackBaseUrl: new FormControl('', [
      Validators.required,
      Validators.pattern(/^https?:\/\/.+/),
    ]),
    eventBrokerAmqpUrl: new FormControl(''),
    eventBrokerExchange: new FormControl(''),
    eventQueueMode: new FormControl<ExternalPluginEventQueueMode>('LIVE', {nonNullable: true}),
    eventQueueTtlMs: new FormControl<number | null>(null),
    frontendOrigins: new FormArray<FormControl<string>>([]),
  });

  public minTtlMs = 60 * 60 * 1000;
  public maxTtlMs = 30 * 24 * 60 * 60 * 1000;
  public defaultTtlMs = 72 * 60 * 60 * 1000;

  public readonly queueModeItems: SelectItem[] = [
    {id: 'LIVE', translationKey: 'pluginManagement.eventQueueMode.live'},
    {id: 'DURABLE', translationKey: 'pluginManagement.eventQueueMode.durable'},
  ];

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly _externalPluginService: ExternalPluginService,
    private readonly _translateService: TranslateService
  ) {}

  public get frontendOriginControls(): Array<FormControl<string>> {
    return this.form.controls.frontendOrigins.controls;
  }

  public ngOnInit(): void {
    this._subscriptions.add(
      this.form.controls.eventQueueMode.valueChanges.subscribe(mode => {
        const ttl = this.form.controls.eventQueueTtlMs;
        if (mode === 'DURABLE') {
          ttl.setValidators([
            Validators.required,
            Validators.min(this.minTtlMs),
            Validators.max(this.maxTtlMs),
          ]);
          if (ttl.value == null) ttl.setValue(this.defaultTtlMs);
        } else {
          ttl.clearValidators();
          ttl.setValue(null);
        }
        ttl.updateValueAndValidity();
      })
    );

    // Editing anything dismisses the previous failure: the admin is already acting on it, and a
    // message that outlives the value it complained about is worse than none.
    this._subscriptions.add(
      this.form.valueChanges.subscribe(() => {
        if (this._errorMessage$.value !== null) this._errorMessage$.next(null);
      })
    );
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue === true) {
      // Reset before fetching so the defaults land on a clean form. Deliberately not done on
      // submit: a failed create has to keep every value the admin typed.
      this._resetForm();
      this._fetchDefaults();
    }
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public addFrontendOrigin(): void {
    this.form.controls.frontendOrigins.push(this._originControl(''));
  }

  public removeFrontendOrigin(index: number): void {
    this.form.controls.frontendOrigins.removeAt(index);
  }

  public onSubmit(): void {
    if (this.form.invalid || this.submitting) return;
    const value = this.form.value;
    const mode = value.eventQueueMode ?? 'LIVE';
    this._errorMessage$.next(null);
    this.submitEvent.emit({
      name: value.name!,
      baseUrl: value.baseUrl!,
      secret: value.secret!,
      kind: this.kind,
      gzacCallbackBaseUrl: value.gzacCallbackBaseUrl!,
      eventBrokerAmqpUrl: value.eventBrokerAmqpUrl?.trim() || null,
      eventBrokerExchange: value.eventBrokerExchange?.trim() || null,
      eventQueueMode: mode,
      eventQueueTtlMs: mode === 'DURABLE' ? value.eventQueueTtlMs ?? null : null,
      frontendOrigins: (value.frontendOrigins ?? [])
        .map(origin => origin?.trim() ?? '')
        .filter(origin => origin.length > 0),
    });
  }

  public onClose(): void {
    this.closeEvent.emit();
    this._resetForm();
  }

  private _fetchDefaults(): void {
    this._externalPluginService.getHostDefaults().subscribe(defaults => {
      this.minTtlMs = defaults.minEventQueueTtlMs;
      this.maxTtlMs = defaults.maxEventQueueTtlMs;
      this.defaultTtlMs = defaults.defaultEventQueueTtlMs;
      this.form.patchValue({
        gzacCallbackBaseUrl: defaults.gzacCallbackBaseUrl,
        eventBrokerAmqpUrl: defaults.eventBrokerAmqpUrl,
        eventBrokerExchange: defaults.eventBrokerExchange,
      });
      this._setFrontendOrigins(
        // The server-side default is the configured CORS allowed-origins. With none configured, the
        // admin's own origin is the best available guess: it is literally the page that will frame
        // the plugin, unlike gzacCallbackBaseUrl, which is a server-to-server address.
        defaults.frontendOrigins?.length ? defaults.frontendOrigins : [window.location.origin]
      );
    });
  }

  private _setFrontendOrigins(origins: Array<string>): void {
    const array = this.form.controls.frontendOrigins;
    array.clear();
    origins.forEach(origin => array.push(this._originControl(origin)));
  }

  private _originControl(value: string): FormControl<string> {
    // Deliberately not `required`: a row the admin added and left blank is dropped on submit
    // rather than blocking the save. `Validators.pattern` passes an empty value, so only a
    // *filled-in* row has to be a well-formed origin.
    return new FormControl<string>(value, {
      nonNullable: true,
      validators: [Validators.pattern(ORIGIN_PATTERN)],
    });
  }

  private _resetForm(): void {
    this.form.controls.frontendOrigins.clear();
    this._errorMessage$.next(null);
    this.form.reset({
      name: '',
      baseUrl: '',
      secret: '',
      gzacCallbackBaseUrl: '',
      eventBrokerAmqpUrl: '',
      eventBrokerExchange: '',
      eventQueueMode: 'LIVE',
      eventQueueTtlMs: null,
    });
  }
}
