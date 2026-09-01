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
  ExternalPluginHost,
  ExternalPluginHostCreateRequest,
  ExternalPluginHostKind,
  ExternalPluginHostUpdateRequest,
  ExternalPluginService,
} from '@valtimo/plugin';
import {Subscription} from 'rxjs';

/** A browser origin: `scheme://host[:port]`, no path — the shape the backend stores. */
const ORIGIN_PATTERN = /^https?:\/\/[^/\s]+$/;

/**
 * Connection details form shared by host registration, the app add stepper, and editing either.
 * Owns the controls, the backend defaults and the queue-mode/TTL rules; the embedding component
 * decides when to submit and builds the request via {@link buildRequest} or
 * {@link buildUpdateRequest}.
 *
 * Setting {@link host} switches to edit mode.
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
  /** The host being edited; null registers a new one. */
  @Input() public host: ExternalPluginHost | null = null;

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

  public get isEdit(): boolean {
    return this.host !== null;
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
    if (changes['host']) {
      // The API never returns the secret, so in edit mode blank means "keep the stored one".
      const secret = this.form.controls.secret;
      if (this.isEdit) {
        secret.clearValidators();
      } else {
        secret.setValidators(Validators.required);
      }
      secret.updateValueAndValidity({emitEvent: false});
    }

    if (changes['active']?.currentValue === true) {
      // Fetched in both modes — the TTL bounds drive the durable-mode validators.
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

  /**
   * Edit-mode counterpart of {@link buildRequest}. No `kind` — it is immutable. Blank secret
   * collapses to null, and the broker URL passes through untouched so an unedited redacted value
   * round-trips to "unchanged" server-side.
   */
  public buildUpdateRequest(): ExternalPluginHostUpdateRequest | null {
    if (this.form.invalid) return null;
    const value = this.form.getRawValue();
    const mode = value.eventQueueMode ?? 'LIVE';
    return {
      name: value.name!,
      baseUrl: value.baseUrl!,
      secret: value.secret?.trim() || null,
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

      if (this.host) this._patchHost(this.host);
    });
  }

  /**
   * Overlays the stored host on the defaults. Secret stays blank; the redacted broker URL is
   * patched in as-is, so submitting it unchanged keeps the stored credentials.
   */
  private _patchHost(host: ExternalPluginHost): void {
    this.form.patchValue({
      name: host.name,
      baseUrl: host.baseUrl,
      secret: '',
      gzacCallbackBaseUrl: host.gzacCallbackBaseUrl ?? '',
      eventBrokerAmqpUrl: host.eventBrokerAmqpUrl ?? '',
      eventBrokerExchange: host.eventBrokerExchange ?? '',
      eventQueueMode: host.eventQueueMode,
      eventQueueTtlMs: host.eventQueueTtlMs,
    });
    // The host's own allowlist — the CORS-derived guess is only for a host that has none.
    this._setFrontendOrigins(host.frontendOrigins ?? []);
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
