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
import {EnrichedEndpoint} from '../../models';

/**
 * Lists the GZAC API endpoints, platform events, host capabilities and outbound destinations an
 * external plugin requires. Permissions are all-or-nothing: the backend rejects a configuration
 * unless every endpoint, `eventSubscriptions` type, capability and `permissions.egress` origin the
 * manifest declares is granted. The admin reviews the full list and accepts all of it with a single
 * acknowledgement before saving.
 *
 * The outbound-destination section has two halves, which differ in who decided them:
 *
 * - {@link egress} — declared in the manifest, so part of the grant the admin accepts here.
 * - {@link derivedEgress} — origins computed from the configuration values the admin just entered in
 *   properties marked `x-egress-target`. Not a separate grant: typing the URL *is* the grant, and it
 *   is shown so the admin sees the complete set of destinations the plugin will be able to reach.
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
  @Input() public capabilities: Array<string> = [];
  /** Manifest-declared origins (`permissions.egress`), granted as a set with the rest. */
  @Input() public egress: Array<string> = [];
  /** Origins derived from the admin's own `x-egress-target` configuration values. */
  @Input() public derivedEgress: Array<string> = [];
  @Input() public readonlyMode = false;

  @Output() public validEvent = new EventEmitter<boolean>();
  @Output() public grantedEndpointsChange = new EventEmitter<
    Array<ExternalPluginGrantedEndpointEntry>
  >();
  @Output() public grantedEventsChange = new EventEmitter<Array<ExternalPluginGrantedEventEntry>>();
  @Output() public grantedCapabilitiesChange = new EventEmitter<Array<string>>();
  @Output() public grantedEgressChange = new EventEmitter<Array<string>>();

  public readonly $enrichedEndpoints = signal<Array<EnrichedEndpoint>>([]);
  public readonly $eventTypes = signal<Array<string>>([]);
  public readonly $capabilities = signal<Array<string>>([]);
  public readonly $egress = signal<Array<string>>([]);
  public readonly $derivedEgress = signal<Array<string>>([]);
  public readonly $accepted = signal<boolean>(false);

  private readonly _externalPluginService = inject(ExternalPluginService);
  private readonly _translateService = inject(TranslateService);

  public ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['endpoints'] ||
      changes['eventSubscriptions'] ||
      changes['capabilities'] ||
      changes['egress'] ||
      changes['derivedEgress'] ||
      changes['readonlyMode']
    ) {
      this.$accepted.set(false);
      this.$eventTypes.set([...this.eventSubscriptions]);
      this.$capabilities.set([...this.capabilities]);
      this.$egress.set([...this.egress]);
      this.$derivedEgress.set([...this.derivedEgress]);
      this._emitGrantedEvents(this.$eventTypes());
      this._emitGrantedCapabilities(this.$capabilities());
      this._emitGrantedEgress(this.$egress());
      this._fetchDescriptionsAndInit();
    }
  }

  public onAcceptanceChange(accepted: boolean): void {
    this.$accepted.set(accepted);
    this._emitValidity();
  }

  public _httpMethodTagType(method: string): string {
    switch (method.toUpperCase()) {
      case 'GET':
        return 'blue';
      case 'POST':
        return 'green';
      case 'PUT':
        return 'teal';
      case 'PATCH':
        return 'cyan';
      case 'DELETE':
        return 'red';
      default:
        return 'warm-gray';
    }
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
    this.$enrichedEndpoints.set(enriched);
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

  private _emitGrantedCapabilities(caps: Array<string>): void {
    this.grantedCapabilitiesChange.emit([...caps]);
  }

  /**
   * Only the manifest-declared origins are emitted. Derived ones are not a grant the backend accepts
   * — it recomputes them from the configuration values on every push — so sending them would trip the
   * exact-match check against the manifest.
   */
  private _emitGrantedEgress(targets: Array<string>): void {
    this.grantedEgressChange.emit([...targets]);
  }

  /**
   * A `*.` entry authorises every subdomain under it, which is a materially wider grant than a fixed
   * host — under author-controlled DNS it reopens both arbitrary-subdomain exfiltration and the DNS
   * channel. The template renders these distinctly so the difference is visible, not buried in a list.
   */
  public _isWildcardEgress(target: string): boolean {
    return target.includes('*.');
  }

  private _emitValidity(): void {
    // Derived origins are deliberately excluded: they are not part of what the acknowledgement
    // grants, so a plugin whose only destination comes from a config value the admin typed does not
    // need an extra acceptance for it.
    const empty =
      this.$enrichedEndpoints().length === 0 &&
      this.$eventTypes().length === 0 &&
      this.$capabilities().length === 0 &&
      this.$egress().length === 0;
    const valid = this.readonlyMode || empty || this.$accepted();
    this.validEvent.emit(valid);
  }
}
