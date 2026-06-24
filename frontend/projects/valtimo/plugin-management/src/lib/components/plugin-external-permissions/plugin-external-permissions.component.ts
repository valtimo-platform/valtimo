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
import {
  CheckboxModule,
  NotificationModule,
  StructuredListModule,
  TagModule,
} from 'carbon-components-angular';
import {
  ExternalPluginGrantedEndpointEntry,
  ExternalPluginGrantedEventEntry,
  ExternalPluginEndpoint,
  ExternalPluginService,
} from '@valtimo/plugin';

interface EnrichedEndpoint extends ExternalPluginEndpoint {
  description: string | null;
}

/**
 * Lists the GZAC API endpoints and platform events an external plugin requires. Permissions are
 * all-or-nothing: the backend rejects a configuration unless every endpoint declared in the
 * manifest is granted **and** every declared `eventSubscriptions` type is granted. The admin
 * reviews the full list and accepts both implications with a single acknowledgement before saving.
 *
 * In `readonlyMode` (editing an existing configuration) the list is informational only — the
 * permissions were already accepted at activation — so no acknowledgement is required.
 */
@Component({
  standalone: true,
  selector: 'valtimo-plugin-external-permissions',
  templateUrl: './plugin-external-permissions.component.html',
  styleUrls: ['./plugin-external-permissions.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    CheckboxModule,
    NotificationModule,
    StructuredListModule,
    TagModule,
  ],
})
export class PluginExternalPermissionsComponent implements OnChanges {
  @Input() public endpoints: Array<ExternalPluginEndpoint> = [];
  @Input() public eventSubscriptions: Array<string> = [];
  @Input() public readonlyMode = false;

  @Output() public validEvent = new EventEmitter<boolean>();
  @Output() public grantedEndpointsChange = new EventEmitter<Array<ExternalPluginGrantedEndpointEntry>>();
  @Output() public grantedEventsChange = new EventEmitter<Array<ExternalPluginGrantedEventEntry>>();

  public readonly _$enrichedEndpoints = signal<Array<EnrichedEndpoint>>([]);
  public readonly _$eventTypes = signal<Array<string>>([]);
  public readonly _$accepted = signal<boolean>(false);

  private readonly _externalPluginService = inject(ExternalPluginService);
  private readonly _translateService = inject(TranslateService);

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['endpoints'] || changes['eventSubscriptions'] || changes['readonlyMode']) {
      this._$accepted.set(false);
      this._$eventTypes.set([...this.eventSubscriptions]);
      this._emitGrantedEvents(this._$eventTypes());
      this._fetchDescriptionsAndInit();
    }
  }

  public onAcceptanceChange(accepted: boolean): void {
    this._$accepted.set(accepted);
    this._emitValidity();
  }

  private _endpointKey(endpoint: ExternalPluginEndpoint): string {
    return `${endpoint.method.toUpperCase()}:${endpoint.pattern}`;
  }

  private _fetchDescriptionsAndInit(): void {
    if (this.endpoints.length === 0) {
      this._setEnriched([]);
      return;
    }

    const queries = this.endpoints.map(ep => ({method: ep.method, pattern: ep.pattern}));
    const locale = this._translateService.currentLang || this._translateService.defaultLang || 'en';

    this._externalPluginService.getEndpointDescriptions(queries, locale).subscribe({
      next: descriptions => {
        const descriptionMap = new Map(
          descriptions.map(d => [`${d.method.toUpperCase()}:${d.pattern}`, d.description])
        );

        this._setEnriched(
          this.endpoints.map(ep => ({
            ...ep,
            description: descriptionMap.get(this._endpointKey(ep)) ?? null,
          }))
        );
      },
      error: () => {
        this._setEnriched(this.endpoints.map(ep => ({...ep, description: null})));
      },
    });
  }

  private _setEnriched(enriched: Array<EnrichedEndpoint>): void {
    this._$enrichedEndpoints.set(enriched);
    this._emitGrantedEndpoints(enriched);
    this._emitValidity();
  }

  /**
   * Accepting the permissions grants the full declared set — partial grants are not allowed by the
   * backend, so the component always emits every endpoint.
   */
  private _emitGrantedEndpoints(enriched: Array<EnrichedEndpoint>): void {
    this.grantedEndpointsChange.emit(
      enriched.map(ep => ({method: ep.method.toUpperCase(), pattern: ep.pattern}))
    );
  }

  /**
   * Mirror of {@link _emitGrantedEndpoints} for event subscriptions — same all-or-nothing model:
   * the host treats the granted list as the dispatch allowlist, narrower-or-equal to the manifest's
   * declared `eventSubscriptions`.
   */
  private _emitGrantedEvents(eventTypes: Array<string>): void {
    this.grantedEventsChange.emit(eventTypes.map(eventType => ({eventType})));
  }

  private _emitValidity(): void {
    const empty = this._$enrichedEndpoints().length === 0 && this._$eventTypes().length === 0;
    const valid = this.readonlyMode || empty || this._$accepted();
    this.validEvent.emit(valid);
  }
}
