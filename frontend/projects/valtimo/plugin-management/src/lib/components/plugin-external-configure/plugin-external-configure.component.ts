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
  ExternalPluginIframeComponent,
  ExternalPluginManagementEndpoint,
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
  @Output() public managementEndpointsResolved = new EventEmitter<Array<ExternalPluginManagementEndpoint>>();

  public readonly _$configBundleUrl = signal<string | null>(null);
  public readonly _$loading = signal(true);

  public readonly _form = new FormGroup({
    title: new FormControl('', Validators.required),
    properties: new FormControl('{}'),
  });

  private _definitionId: string | null = null;
  private _iframeConfigData: Record<string, unknown> | null = null;
  private _grantedEndpoints: Array<ExternalPluginGrantedEndpointEntry> = [];
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
              this._$configBundleUrl.set(null);
              this._$loading.set(false);
              this.managementEndpointsResolved.emit([]);
              return [];
            }

            this._definitionId = extractExternalDefinitionId(def.key);
            this._$loading.set(true);

            return this._externalPluginService.getDefinition(this._definitionId).pipe(
              map((definition: ExternalPluginDefinition) => {
                const configBundle = definition.manifest?.frontendBundles?.find(
                  b => b.type === 'config'
                );

                if (configBundle) {
                  this._$configBundleUrl.set(
                    `${definition.baseUrl}/${definition.version}${configBundle.path}`
                  );
                } else {
                  this._$configBundleUrl.set(null);
                }

                const endpoints = definition.manifest?.permissions?.managementEndpoints ?? [];
                this.managementEndpointsResolved.emit(endpoints);

                this._$loading.set(false);
              })
            );
          })
        )
        .subscribe()
    );

    this._subscriptions.add(
      this._form.valueChanges.subscribe(() => this._validateForm())
    );

    this._subscriptions.add(
      this._stateService.save$.subscribe(() => this._onSaveTriggered())
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onIframeConfigurationChanged(event: {valid: boolean; data: Record<string, unknown>}): void {
    this._iframeConfigData = event.data;
    this.validEvent.emit(event.valid);
  }

  public setGrantedEndpoints(endpoints: Array<ExternalPluginGrantedEndpointEntry>): void {
    this._grantedEndpoints = endpoints;
  }

  private _validateForm(): void {
    if (this._$configBundleUrl()) return;

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
      const title = (this._iframeConfigData['configurationTitle'] as string) ?? '';
      const properties = {...this._iframeConfigData};
      delete properties['configurationTitle'];

      this.saveEvent.emit({
        definitionId: this._definitionId,
        title,
        properties,
        grantedEndpoints: this._grantedEndpoints,
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
    });
  }
}
