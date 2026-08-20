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
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {TranslateModule} from '@ngx-translate/core';
import {FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {ButtonModule, InputModule, LayerModule} from 'carbon-components-angular';
import {SelectItem, SelectModule} from '@valtimo/components';
import {
  ExternalPluginEventQueueMode,
  ExternalPluginHostCreateRequest,
  ExternalPluginHostKind,
  ExternalPluginService,
} from '@valtimo/plugin';
import {Subscription} from 'rxjs';

/** A browser origin: `scheme://host[:port]`, no path — the shape the backend stores. */
const ORIGIN_PATTERN = /^https?:\/\/[^/\s]+$/;

/**
 * The connection details form shared by host registration (plugin-host modal) and app
 * registration (the app add stepper). Owns the form controls, the backend-provided defaults and
 * the queue-mode/TTL validation rules; the embedding component decides when to submit and builds
 * the create request via {@link buildRequest}.
 */
@Component({
  standalone: true,
  selector: 'valtimo-plugin-host-connection-form',
  templateUrl: './plugin-host-connection-form.component.html',
  styleUrls: ['./plugin-host-connection-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    ReactiveFormsModule,
    ButtonModule,
    InputModule,
    LayerModule,
    SelectModule,
  ],
})
export class PluginHostConnectionFormComponent implements OnInit, OnChanges, OnDestroy {
  /** Fetches fresh defaults every time this turns true (i.e. every time the embedding modal opens). */
  @Input() public active = false;
  /** Freezes the form, e.g. while connecting or after the host has been created. */
  @Input() public disabled = false;
  /** Chooses the placeholder examples: 'host' in the plugin-host modal, 'app' in the app add stepper. */
  @Input() public variant: 'host' | 'app' = 'host';

  @Output() public validChange = new EventEmitter<boolean>();

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

  public queueModeItems: SelectItem[] = [];

  private readonly _subscriptions = new Subscription();

  public get namePlaceholder(): string {
    return this.variant === 'app' ? 'my-app' : 'my-plugin-host';
  }

  public get baseUrlPlaceholder(): string {
    return this.variant === 'app'
      ? 'https://my-app.internal:8090'
      : 'https://plugin-host.internal:8090';
  }

  public get ttlHintKey(): string {
    return this.variant === 'app'
      ? 'pluginManagement.hints.eventQueueTtlMsApp'
      : 'pluginManagement.hints.eventQueueTtlMs';
  }

  public get frontendOriginControls(): Array<FormControl<string>> {
    return this.form.controls.frontendOrigins.controls;
  }

  constructor(private readonly _externalPluginService: ExternalPluginService) {}

  public ngOnInit(): void {
    this.queueModeItems =
      this.variant === 'app'
        ? [
            {id: 'LIVE', translationKey: 'pluginManagement.eventQueueMode.liveApp'},
            {id: 'DURABLE', translationKey: 'pluginManagement.eventQueueMode.durableApp'},
          ]
        : [
            {id: 'LIVE', translationKey: 'pluginManagement.eventQueueMode.live'},
            {id: 'DURABLE', translationKey: 'pluginManagement.eventQueueMode.durable'},
          ];

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

    this._subscriptions.add(
      this.form.statusChanges.subscribe(() => this.validChange.emit(this.form.valid))
    );
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['active']?.currentValue === true) {
      this._fetchDefaults();
    }

    if (changes['disabled']) {
      // emitEvent: false — toggling enabled state must not fire the queue-mode value listener.
      if (this.disabled) {
        this.form.disable({emitEvent: false});
      } else {
        this.form.enable({emitEvent: false});
      }
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

  public buildRequest(kind: ExternalPluginHostKind): ExternalPluginHostCreateRequest | null {
    if (this.form.invalid) return null;
    const value = this.form.getRawValue();
    const mode = value.eventQueueMode ?? 'LIVE';
    return {
      name: value.name!,
      baseUrl: value.baseUrl!,
      secret: value.secret!,
      kind,
      gzacCallbackBaseUrl: value.gzacCallbackBaseUrl!,
      eventBrokerAmqpUrl: value.eventBrokerAmqpUrl?.trim() || null,
      eventBrokerExchange: value.eventBrokerExchange?.trim() || null,
      eventQueueMode: mode,
      eventQueueTtlMs: mode === 'DURABLE' ? (value.eventQueueTtlMs ?? null) : null,
      frontendOrigins: (value.frontendOrigins ?? [])
        .map(origin => origin?.trim() ?? '')
        .filter(origin => origin.length > 0),
    };
  }

  public reset(): void {
    this.form.controls.frontendOrigins.clear();
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
}
