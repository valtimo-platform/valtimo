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
  OnDestroy,
  OnInit,
  Output,
  signal,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {LoadingModule} from 'carbon-components-angular';
import {Subscription} from 'rxjs';
import {map, switchMap} from 'rxjs/operators';
import {
  ExternalPluginDefinition,
  ExternalPluginGrantedEndpointEntry,
  ExternalPluginGrantedEventEntry,
  ExternalPluginIframeComponent,
  ExternalPluginEndpoint,
  ExternalPluginService,
  extractExternalDefinitionId,
  isExternalPluginKey,
} from '@valtimo/plugin';
import {PluginManagementStateService} from '../../services';
import {deriveExternalPluginEgressOrigins} from '../../utils';

interface ExternalPluginSaveEvent {
  definitionId: string;
  title: string;
  properties: Record<string, unknown>;
  grantedEndpoints: Array<ExternalPluginGrantedEndpointEntry>;
  grantedEvents: Array<ExternalPluginGrantedEventEntry>;
  grantedCapabilities: Array<string>;
  grantedEgress: Array<string>;
}

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
    LoadingModule,
    ExternalPluginIframeComponent,
  ],
})
export class PluginExternalConfigureComponent implements OnInit, OnDestroy {
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

  public readonly $configBundleUrl = signal<string | null>(null);
  public readonly $loading = signal(true);

  public readonly _form = new FormGroup({
    title: new FormControl('', Validators.required),
    properties: new FormControl('{}'),
  });

  private _definitionId: string | null = null;
  private _iframeConfigTitle: string = '';
  private _iframeConfigData: Record<string, unknown> | null = null;
  private _grantedEndpoints: Array<ExternalPluginGrantedEndpointEntry> = [];
  private _grantedEvents: Array<ExternalPluginGrantedEventEntry> = [];
  private _grantedCapabilities: Array<string> = [];
  private _grantedEgress: Array<string> = [];
  private _configurationSchema: unknown = null;
  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly _stateService: PluginManagementStateService,
    private readonly _externalPluginService: ExternalPluginService
  ) {}

  public ngOnInit(): void {
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
              this._configurationSchema = null;
              return [];
            }

            this._definitionId = extractExternalDefinitionId(def.key);
            this.$loading.set(true);

            return this._externalPluginService.getDefinition(this._definitionId).pipe(
              map((definition: ExternalPluginDefinition) => {
                const configBundle = definition.manifest?.frontendBundles?.find(
                  b => b.type === 'config'
                );

                if (configBundle) {
                  this.$configBundleUrl.set(
                    `${definition.baseUrl}/${definition.version}${configBundle.path}`
                  );
                } else {
                  this.$configBundleUrl.set(null);
                }

                const endpoints = definition.manifest?.permissions?.endpoints ?? [];
                this.endpointsResolved.emit(endpoints);
                const eventSubscriptions = definition.manifest?.eventSubscriptions ?? [];
                this.eventSubscriptionsResolved.emit(eventSubscriptions);
                const capabilities = definition.manifest?.permissions?.capabilities ?? [];
                this.capabilitiesResolved.emit(capabilities);
                const egress = definition.manifest?.permissions?.egress ?? [];
                this._grantedEgress = [...egress];
                this.egressResolved.emit(egress);
                // Kept so the derived destinations can be recomputed whenever the configuration
                // values change, without re-fetching the definition.
                this._configurationSchema = definition.configurationSchema;
                this._emitDerivedEgress(null);

                this.$loading.set(false);
              })
            );
          })
        )
        .subscribe()
    );

    this._subscriptions.add(this._form.valueChanges.subscribe(() => this._validateForm()));

    this._subscriptions.add(this._stateService.save$.subscribe(() => this._onSaveTriggered()));
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
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

  private _emitDerivedEgress(properties: Record<string, unknown> | null): void {
    this.derivedEgressResolved.emit(
      deriveExternalPluginEgressOrigins(this._configurationSchema, properties)
    );
  }

  private _validateForm(): void {
    if (this.$configBundleUrl()) return;

    const titleValid = !!this._form.value.title?.trim();
    let jsonValid = true;
    let parsed: Record<string, unknown> | null = null;
    const props = this._form.value.properties?.trim();
    if (props) {
      try {
        parsed = JSON.parse(props) as Record<string, unknown>;
      } catch {
        jsonValid = false;
      }
    }
    // The raw-JSON fallback (no config bundle) feeds the same derivation as the iframe path.
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
      });
      return;
    }

    const title = this._form.value.title?.trim() ?? '';
    let properties: Record<string, unknown> = {};
    const propsStr = this._form.value.properties?.trim();
    if (propsStr) {
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
    });
  }
}
