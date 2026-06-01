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
  inject,
  Input,
  OnChanges,
  Output,
  signal,
  SimpleChanges,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {CheckboxModule} from 'carbon-components-angular';
import {
  ExternalPluginGrantedEndpointEntry,
  ExternalPluginManagementEndpoint,
  ExternalPluginService,
} from '@valtimo/plugin';

interface EnrichedEndpoint extends ExternalPluginManagementEndpoint {
  description: string | null;
}

@Component({
  standalone: true,
  selector: 'valtimo-plugin-external-permissions',
  templateUrl: './plugin-external-permissions.component.html',
  styleUrls: ['./plugin-external-permissions.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslateModule, CheckboxModule],
})
export class PluginExternalPermissionsComponent implements OnChanges {
  @Input() public endpoints: Array<ExternalPluginManagementEndpoint> = [];
  @Input() public grantedEndpoints: Array<ExternalPluginGrantedEndpointEntry> | null = null;

  @Output() public validEvent = new EventEmitter<boolean>();
  @Output() public grantedEndpointsChange = new EventEmitter<Array<ExternalPluginGrantedEndpointEntry>>();

  public readonly _$enrichedEndpoints = signal<Array<EnrichedEndpoint>>([]);
  public readonly _$grantedState = signal<Record<string, boolean>>({});

  private readonly _externalPluginService = inject(ExternalPluginService);
  private readonly _translateService = inject(TranslateService);

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['endpoints'] || changes['grantedEndpoints']) {
      this._fetchDescriptionsAndInit();
    }
  }

  public onCheckboxChange(endpoint: EnrichedEndpoint, checked: boolean): void {
    const key = this._endpointKey(endpoint);
    const state = {...this._$grantedState()};
    state[key] = checked;
    this._$grantedState.set(state);
    this._emitState(state);
  }

  private _endpointKey(endpoint: ExternalPluginManagementEndpoint): string {
    return `${endpoint.method.toUpperCase()}:${endpoint.pattern}`;
  }

  private _fetchDescriptionsAndInit(): void {
    if (this.endpoints.length === 0) {
      this._$enrichedEndpoints.set([]);
      this._initGrantedState([]);
      return;
    }

    const queries = this.endpoints.map(ep => ({method: ep.method, pattern: ep.pattern}));

    const locale = this._translateService.currentLang || this._translateService.defaultLang || 'en';

    this._externalPluginService.getEndpointDescriptions(queries, locale).subscribe({
      next: descriptions => {
        const descriptionMap = new Map(
          descriptions.map(d => [`${d.method.toUpperCase()}:${d.pattern}`, d.description])
        );

        const enriched: Array<EnrichedEndpoint> = this.endpoints.map(ep => ({
          ...ep,
          description: descriptionMap.get(this._endpointKey(ep)) ?? null,
        }));

        this._$enrichedEndpoints.set(enriched);
        this._initGrantedState(enriched);
      },
      error: () => {
        const enriched: Array<EnrichedEndpoint> = this.endpoints.map(ep => ({
          ...ep,
          description: null,
        }));
        this._$enrichedEndpoints.set(enriched);
        this._initGrantedState(enriched);
      },
    });
  }

  private _initGrantedState(enriched: Array<EnrichedEndpoint>): void {
    const state: Record<string, boolean> = {};

    if (this.grantedEndpoints) {
      const grantedKeys = new Set(
        this.grantedEndpoints.map(e => `${e.method.toUpperCase()}:${e.pattern}`)
      );
      enriched.forEach(ep => {
        state[this._endpointKey(ep)] = grantedKeys.has(this._endpointKey(ep));
      });
    } else {
      enriched.forEach(ep => {
        state[this._endpointKey(ep)] = false;
      });
    }

    this._$grantedState.set(state);
    this._emitState(state);
  }

  private _emitState(state: Record<string, boolean>): void {
    const enriched = this._$enrichedEndpoints();
    const allGranted = enriched.length > 0 && enriched.every(ep => state[this._endpointKey(ep)]);
    this.validEvent.emit(allGranted);

    const granted: Array<ExternalPluginGrantedEndpointEntry> = enriched
      .filter(ep => state[this._endpointKey(ep)])
      .map(ep => ({
        method: ep.method.toUpperCase(),
        pattern: ep.pattern,
      }));

    this.grantedEndpointsChange.emit(granted);
  }
}
