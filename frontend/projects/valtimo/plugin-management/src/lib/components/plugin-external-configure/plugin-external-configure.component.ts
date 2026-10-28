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
  OnInit,
  Output,
  signal,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormControl, FormGroup, ReactiveFormsModule} from '@angular/forms';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {LoadingModule} from 'carbon-components-angular';
import {Subscription} from 'rxjs';
import {map, switchMap} from 'rxjs/operators';
import {InputLabelModule} from '@valtimo/components';
import {
  ExternalPluginConfigFormComponent,
  ExternalPluginConfigStructure,
  ExternalPluginContractBindingEntry,
  ExternalPluginDeclaredContract,
  ExternalPluginDefinition,
  ExternalPluginGrantedEndpointEntry,
  ExternalPluginGrantedEventEntry,
  ExternalPluginIframeComponent,
  ExternalPluginEndpoint,
  ExternalPluginProvidedContract,
  ExternalPluginService,
  externalPluginRequiredTextValidator,
  extractExternalDefinitionId,
  getExternalPluginDeclaredContracts,
  getExternalPluginProvidedContracts,
  isExternalPluginKey,
  resolveExternalPluginFormMode,
} from '@valtimo/plugin';
import {ExternalPluginSaveEvent} from '../../models';
import {PluginManagementStateService} from '../../services';
import {
  buildExternalPluginPropertiesSkeleton,
  deriveExternalPluginEgressOrigins,
} from '../../utils';
import {PluginExternalPropertiesEditorComponent} from '../plugin-external-properties-editor/plugin-external-properties-editor.component';

/**
 * The "enter data" step for an external plugin configuration: the plugin's own config bundle in an
 * iframe when it ships one, otherwise a title plus a form generated from a flat configuration
 * schema, or the JSON properties editor for any other schema.
 *
 * Works in two modes:
 * - Bound to {@link PluginManagementStateService} (the plugins page add modal): the definition
 *   follows the selected plugin and saving is triggered through the state service's `save$`.
 * - Standalone via the `definitionId` input (the app add stepper): the definition is loaded
 *   directly and saving is triggered imperatively through {@link triggerSave}.
 */
@Component({
  standalone: true,
  selector: 'valtimo-plugin-external-configure',
  templateUrl: './plugin-external-configure.component.html',
  styleUrls: ['./plugin-external-configure.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    InputLabelModule,
    LoadingModule,
    ExternalPluginConfigFormComponent,
    ExternalPluginIframeComponent,
    PluginExternalPropertiesEditorComponent,
  ],
})
export class PluginExternalConfigureComponent implements OnInit, OnDestroy {
  /** When set, configures this definition directly instead of the state service's selection. */
  @Input() public definitionId: string | null = null;

  @Output() public validEvent = new EventEmitter<boolean>();
  @Output() public saveEvent = new EventEmitter<ExternalPluginSaveEvent>();
  @Output() public endpointsResolved = new EventEmitter<Array<ExternalPluginEndpoint>>();
  @Output() public eventSubscriptionsResolved = new EventEmitter<Array<string>>();
  @Output() public capabilitiesResolved = new EventEmitter<Array<string>>();
  @Output() public egressResolved = new EventEmitter<Array<string>>();
  /**
   * The origins GZAC will derive from the configuration values entered on this step, recomputed as
   * they change. Not a grant — the admin supplying the URL is the grant — but the permissions step
   * shows them so the full destination set is visible before activation.
   */
  @Output() public derivedEgressResolved = new EventEmitter<Array<string>>();
  /** `permissions.contracts`; the permissions step lets the admin bind each or leave it unbound. */
  @Output() public declaredContractsResolved = new EventEmitter<
    Array<ExternalPluginDeclaredContract>
  >();
  @Output() public providedContractsResolved = new EventEmitter<
    Array<ExternalPluginProvidedContract>
  >();

  public readonly $configBundleUrl = signal<string | null>(null);
  public readonly $loading = signal(true);
  public readonly $configurationSchema = signal<unknown>(null);
  public readonly $propertiesInvalid = signal(false);
  /** Set when the schema is flat enough for the generated form; null keeps the JSON editor. */
  public readonly $configStructure = signal<ExternalPluginConfigStructure | null>(null);
  public readonly $initialProperties = signal<Record<string, unknown>>({});

  public readonly form = new FormGroup({
    title: new FormControl('', externalPluginRequiredTextValidator),
    properties: new FormControl('{}'),
  });

  private _definitionId: string | null = null;
  private _iframeConfigTitle: string = '';
  private _iframeConfigData: Record<string, unknown> | null = null;
  private _grantedEndpoints: Array<ExternalPluginGrantedEndpointEntry> = [];
  private _grantedEvents: Array<ExternalPluginGrantedEventEntry> = [];
  private _grantedCapabilities: Array<string> = [];
  private _grantedEgress: Array<string> = [];
  private _contractBindings: Array<ExternalPluginContractBindingEntry> = [];
  private _generatedProperties: Record<string, unknown> = {};
  private _generatedPropertiesValid = false;
  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly _stateService: PluginManagementStateService,
    private readonly _externalPluginService: ExternalPluginService,
    private readonly _translateService: TranslateService
  ) {}

  public ngOnInit(): void {
    if (this.definitionId) {
      this._definitionId = this.definitionId;
      this.$loading.set(true);
      this._externalPluginService
        .getDefinition(this.definitionId)
        .subscribe(definition => this._applyDefinition(definition));
    } else {
      this._subscriptions.add(
        this._stateService.selectedPluginDefinition$
          .pipe(
            switchMap(def => {
              if (!def?.key || !isExternalPluginKey(def.key)) {
                this._definitionId = null;
                this.$configBundleUrl.set(null);
                this.$loading.set(false);
                this.endpointsResolved.emit([]);
                this.eventSubscriptionsResolved.emit([]);
                this.capabilitiesResolved.emit([]);
                this.egressResolved.emit([]);
                this.derivedEgressResolved.emit([]);
                this.declaredContractsResolved.emit([]);
                this.providedContractsResolved.emit([]);
                this._contractBindings = [];
                this.$configurationSchema.set(null);
                this.$configStructure.set(null);
                return [];
              }

              this._definitionId = extractExternalDefinitionId(def.key);
              this.$loading.set(true);

              return this._externalPluginService
                .getDefinition(this._definitionId)
                .pipe(map(definition => this._applyDefinition(definition)));
            })
          )
          .subscribe()
      );

      // Only the state-service-driven mode saves through `save$` — an instance embedded via
      // `definitionId` must not react to the plugins page's save trigger.
      this._subscriptions.add(this._stateService.save$.subscribe(() => this._onSaveTriggered()));
    }

    this._subscriptions.add(this.form.valueChanges.subscribe(() => this._validateForm()));
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  /** Imperative save trigger for the `definitionId` mode (mirrors the state service's `save$`). */
  public triggerSave(): void {
    this._onSaveTriggered();
  }

  public onIframeConfigurationChanged(event: {
    valid: boolean;
    title: string;
    data: Record<string, unknown>;
  }): void {
    this._iframeConfigTitle = event.title;
    this._iframeConfigData = event.data;
    this._emitDerivedEgress(event.data);
    this.validEvent.emit(event.valid);
  }

  public onGeneratedPropertiesChange(properties: Record<string, unknown>): void {
    this._generatedProperties = properties;
    this._validateForm();
  }

  public onGeneratedPropertiesValid(valid: boolean): void {
    this._generatedPropertiesValid = valid;
    this._validateForm();
  }

  public setGrantedEndpoints(endpoints: Array<ExternalPluginGrantedEndpointEntry>): void {
    this._grantedEndpoints = endpoints;
  }

  public setGrantedEvents(events: Array<ExternalPluginGrantedEventEntry>): void {
    this._grantedEvents = events;
  }

  public setGrantedCapabilities(caps: Array<string>): void {
    this._grantedCapabilities = caps;
  }

  public setGrantedEgress(targets: Array<string>): void {
    this._grantedEgress = targets;
  }

  public setContractBindings(bindings: Array<ExternalPluginContractBindingEntry>): void {
    this._contractBindings = bindings;
  }

  private _applyDefinition(definition: ExternalPluginDefinition): void {
    const skeleton = buildExternalPluginPropertiesSkeleton(definition.configurationSchema);
    const mode = resolveExternalPluginFormMode(definition, {type: 'config'}, skeleton);
    this.$configBundleUrl.set(mode.kind === 'bundle' ? mode.url : null);

    const endpoints = definition.manifest?.permissions?.endpoints ?? [];
    this.endpointsResolved.emit(endpoints);
    const eventSubscriptions = definition.manifest?.eventSubscriptions ?? [];
    this.eventSubscriptionsResolved.emit(eventSubscriptions);
    const capabilities = definition.manifest?.permissions?.capabilities ?? [];
    this.capabilitiesResolved.emit(capabilities);
    const egress = definition.manifest?.permissions?.egress ?? [];
    this._grantedEgress = [...egress];
    this.egressResolved.emit(egress);
    this._contractBindings = [];
    this.declaredContractsResolved.emit(getExternalPluginDeclaredContracts(definition.manifest));
    this.providedContractsResolved.emit(
      getExternalPluginProvidedContracts(definition.manifest, this._translateService.currentLang)
    );
    // Kept so the derived destinations can be recomputed whenever the configuration values
    // change, without re-fetching the definition.
    this.$configurationSchema.set(definition.configurationSchema);

    if (mode.kind === 'bundle') {
      this.$configStructure.set(null);
      this._emitDerivedEgress(null);
    } else {
      if (mode.kind === 'form') {
        // Invalid until the form reports in: required fields may still be empty.
        this._generatedProperties = skeleton;
        this._generatedPropertiesValid = false;
        this.$initialProperties.set(skeleton);
        this.$configStructure.set(mode.structure);
      } else {
        this.$configStructure.set(null);
        this.form.controls.properties.setValue(JSON.stringify(skeleton, null, 2), {
          emitEvent: false,
        });
      }
      // Derives the egress the skeleton's defaults already point at
      this._validateForm();
    }

    this.$loading.set(false);
  }

  private _emitDerivedEgress(properties: Record<string, unknown> | null): void {
    this.derivedEgressResolved.emit(
      deriveExternalPluginEgressOrigins(this.$configurationSchema(), properties)
    );
  }

  private _validateForm(): void {
    if (this.$configBundleUrl()) return;

    const titleValid = this.form.controls.title.valid;

    if (this.$configStructure()) {
      this._emitDerivedEgress(this._generatedProperties);
      this.validEvent.emit(titleValid && this._generatedPropertiesValid);
      return;
    }

    let jsonValid = true;
    let parsed: Record<string, unknown> | null = null;
    const props = this.form.value.properties?.trim();
    if (props) {
      try {
        parsed = JSON.parse(props) as Record<string, unknown>;
      } catch {
        jsonValid = false;
      }
    }
    // The raw-JSON fallback (no config bundle) feeds the same derivation as the iframe path.
    this.$propertiesInvalid.set(!jsonValid);
    if (jsonValid) this._emitDerivedEgress(parsed);
    this.validEvent.emit(titleValid && jsonValid);
  }

  private _onSaveTriggered(): void {
    if (!this._definitionId) return;

    if (this._iframeConfigData) {
      this.saveEvent.emit({
        definitionId: this._definitionId,
        title: this._iframeConfigTitle,
        properties: this._iframeConfigData,
        grantedEndpoints: this._grantedEndpoints,
        grantedEvents: this._grantedEvents,
        grantedCapabilities: this._grantedCapabilities,
        grantedEgress: this._grantedEgress,
        contractBindings: this._contractBindings,
      });
      return;
    }

    const title = this.form.value.title?.trim() ?? '';
    let properties: Record<string, unknown> = {};
    const propsStr = this.form.value.properties?.trim();
    if (this.$configStructure()) {
      properties = this._generatedProperties;
    } else if (propsStr) {
      try {
        properties = JSON.parse(propsStr);
      } catch {
        return;
      }
    }

    this.saveEvent.emit({
      definitionId: this._definitionId,
      title,
      properties,
      grantedEndpoints: this._grantedEndpoints,
      grantedEvents: this._grantedEvents,
      grantedCapabilities: this._grantedCapabilities,
      grantedEgress: this._grantedEgress,
      contractBindings: this._contractBindings,
    });
  }
}
