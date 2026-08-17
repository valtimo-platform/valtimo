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

interface ExternalPluginSaveEvent {
  definitionId: string;
  title: string;
  properties: Record<string, unknown>;
  grantedEndpoints: Array<ExternalPluginGrantedEndpointEntry>;
  grantedEvents: Array<ExternalPluginGrantedEventEntry>;
  grantedCapabilities: Array<string>;
}

/**
 * The "enter data" step for an external plugin configuration: the plugin's own config bundle in an
 * iframe when it ships one, a title + JSON properties fallback otherwise.
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
    LoadingModule,
    ExternalPluginIframeComponent,
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
  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly _stateService: PluginManagementStateService,
    private readonly _externalPluginService: ExternalPluginService
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

    this._subscriptions.add(this._form.valueChanges.subscribe(() => this._validateForm()));
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

  private _applyDefinition(definition: ExternalPluginDefinition): void {
    const configBundle = definition.manifest?.frontendBundles?.find(b => b.type === 'config');

    if (configBundle) {
      this.$configBundleUrl.set(`${definition.baseUrl}/${definition.version}${configBundle.path}`);
    } else {
      this.$configBundleUrl.set(null);
    }

    const endpoints = definition.manifest?.permissions?.endpoints ?? [];
    this.endpointsResolved.emit(endpoints);
    const eventSubscriptions = definition.manifest?.eventSubscriptions ?? [];
    this.eventSubscriptionsResolved.emit(eventSubscriptions);
    const capabilities = definition.manifest?.permissions?.capabilities ?? [];
    this.capabilitiesResolved.emit(capabilities);

    this.$loading.set(false);
  }

  private _validateForm(): void {
    if (this.$configBundleUrl()) return;

    const titleValid = !!this._form.value.title?.trim();
    let jsonValid = true;
    const props = this._form.value.properties?.trim();
    if (props) {
      try {
        JSON.parse(props);
      } catch {
        jsonValid = false;
      }
    }
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
    });
  }
}
