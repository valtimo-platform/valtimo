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
  Output,
  signal,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {HttpErrorResponse} from '@angular/common/http';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  ButtonModule,
  LayerModule,
  LoadingModule,
  ModalModule,
  NotificationModule,
  ProgressIndicatorModule,
} from 'carbon-components-angular';
import {
  CARBON_CONSTANTS,
  ConfirmationModalModule,
  ValtimoCdsModalDirective,
} from '@valtimo/components';
import {
  ExternalPluginDefinition,
  ExternalPluginGrantedEndpointEntry,
  ExternalPluginGrantedEventEntry,
  ExternalPluginEndpoint,
  ExternalPluginHost,
  ExternalPluginService,
} from '@valtimo/plugin';
import {NGXLogger} from 'ngx-logger';
import {BehaviorSubject, of, Subscription, timer} from 'rxjs';
import {catchError, switchMap} from 'rxjs/operators';
import {PluginHostConnectionFormComponent} from '../plugin-host-connection-form/plugin-host-connection-form.component';
import {PluginExternalConfigureComponent} from '../plugin-external-configure/plugin-external-configure.component';
import {PluginExternalPermissionsComponent} from '../plugin-external-permissions/plugin-external-permissions.component';
import {cspAllowsFrameOrigin} from '../../utils';
import {PLUGIN_APP_ADD_MODAL_TEST_IDS} from '../../constants';

type ConnectState = 'idle' | 'connecting' | 'connected' | 'failed' | 'conflict' | 'timeout';

/** The 409 code the backend returns when the app's plugin is already registered elsewhere. */
const APP_ALREADY_REGISTERED_CODE = 'APP_PLUGIN_ALREADY_REGISTERED';

/**
 * Connects an app and configures it in a single stepper: Connect → Enter data → Permissions.
 *
 * Connecting registers the app as an external plugin host (kind APP) and waits for the app's
 * plugin definition to be discovered. Because the CSP meta tag is fixed at bootstrap, an app that
 * ships its own config bundle cannot be framed until the page is reloaded — in that case a
 * confirmation dialog announces the refresh and the flow resumes at the configuration step via
 * the `configureApp` query parameter on the apps page (see {@link PluginAppsPageComponent}).
 * When the current CSP already allows the app's origin (or no CSP is configured), the stepper
 * continues without a refresh.
 */
@Component({
  standalone: true,
  selector: 'valtimo-plugin-app-add-modal',
  templateUrl: './plugin-app-add-modal.component.html',
  styleUrls: ['./plugin-app-add-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    ModalModule,
    ButtonModule,
    LayerModule,
    LoadingModule,
    NotificationModule,
    ProgressIndicatorModule,
    ConfirmationModalModule,
    ValtimoCdsModalDirective,
    PluginHostConnectionFormComponent,
    PluginExternalConfigureComponent,
    PluginExternalPermissionsComponent,
  ],
})
export class PluginAppAddModalComponent implements OnChanges, OnDestroy {
  @ViewChild(PluginHostConnectionFormComponent)
  private _connectionForm: PluginHostConnectionFormComponent | undefined;

  @ViewChild(PluginExternalConfigureComponent)
  private _configureComponent: PluginExternalConfigureComponent | undefined;

  @Input() public open = false;
  /** When set, the stepper opens at the configuration step for this already-connected app. */
  @Input() public resumeHostId: string | null = null;

  @Output() public closeEvent = new EventEmitter<void>();
  @Output() public completedEvent = new EventEmitter<void>();

  public readonly $currentStep = signal<number>(0);
  public readonly $connectState = signal<ConnectState>('idle');
  public readonly $connectionFormValid = signal<boolean>(false);
  public readonly $definition = signal<ExternalPluginDefinition | null>(null);
  public readonly $resolvingDefinition = signal<boolean>(false);
  public readonly $resumeLoadFailed = signal<boolean>(false);
  public readonly $configValid = signal<boolean>(false);
  public readonly $permissionsValid = signal<boolean>(false);
  public readonly $saving = signal<boolean>(false);

  public readonly $endpoints = signal<Array<ExternalPluginEndpoint>>([]);
  public readonly $eventSubscriptions = signal<Array<string>>([]);
  public readonly $capabilities = signal<Array<string>>([]);

  /** Details of the conflicting registration, shown when connecting is rejected with a 409. */
  public readonly $conflict = signal<{pluginId: string; hostName: string} | null>(null);

  public readonly refreshModalOpen$ = new BehaviorSubject<boolean>(false);

  public progressSteps: Array<{label: string; complete: boolean}> = [];

  protected readonly testIds = PLUGIN_APP_ADD_MODAL_TEST_IDS;

  private _host: ExternalPluginHost | null = null;
  private _definitionPollSubscription: Subscription | null = null;
  private readonly _subscriptions = new Subscription();

  /** The connection form stays locked from the moment the host is created. */
  public get connectionLocked(): boolean {
    return ['connecting', 'connected', 'timeout'].includes(this.$connectState());
  }

  constructor(
    private readonly _externalPluginService: ExternalPluginService,
    private readonly _translateService: TranslateService,
    private readonly _logger: NGXLogger
  ) {
    this._buildProgressSteps();
    this._subscriptions.add(
      this._translateService.onLangChange.subscribe(() => this._buildProgressSteps())
    );
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      if (this.resumeHostId) {
        this._startResume(this.resumeHostId);
      }
    }
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
    this._stopDefinitionPoll();
  }

  // --- Connect step ---

  public onConnectionFormValidChange(valid: boolean): void {
    this.$connectionFormValid.set(valid);
  }

  public onConnect(): void {
    const request = this._connectionForm?.buildRequest('APP');
    if (!request || this.connectionLocked) return;

    this.$connectState.set('connecting');
    this.$conflict.set(null);
    this._externalPluginService.createHost(request, true).subscribe({
      next: host => {
        this._host = host;
        this._pollForDefinition(host.id);
      },
      error: (response: HttpErrorResponse) => {
        // The backend rejected and rolled back the registration because the app's plugin is
        // already registered under another host — tell the admin where, instead of a generic
        // failure. Nothing was created, so the form stays editable.
        if (response.status === 409 && response.error?.code === APP_ALREADY_REGISTERED_CODE) {
          const conflict = response.error?.conflicts?.[0];
          this.$conflict.set({
            pluginId: conflict?.pluginId ?? '',
            hostName:
              conflict?.existingHostName ??
              this._translateService.instant('pluginManagement.appAdd.conflictUnknownHost'),
          });
          this.$connectState.set('conflict');
          return;
        }

        this.$connectState.set('failed');
        this._logger.error('Something went wrong with connecting the app.');
      },
    });
  }

  public onRetryDiscovery(): void {
    if (!this._host) return;
    this.$connectState.set('connecting');
    this._pollForDefinition(this._host.id);
  }

  public onContinue(): void {
    const host = this._host;
    if (!host || this.$connectState() !== 'connected') return;

    // The CSP meta tag was built before this host existed. If it blocks the app's origin, the
    // page must be reloaded before the configuration step (the config bundle iframe would be
    // refused) — the apps page restores this stepper at the configuration step afterwards.
    if (cspAllowsFrameOrigin(this.$definition()?.baseUrl ?? host.baseUrl)) {
      this.$currentStep.set(1);
    } else {
      this.refreshModalOpen$.next(true);
    }
  }

  public onRefreshConfirm(): void {
    const host = this._host;
    if (!host) return;
    window.location.assign(this._buildResumeUrl(host.id));
  }

  public onRefreshCancel(): void {
    // Stay on the connected step; the admin can continue (and refresh) later. The app itself
    // remains registered either way.
  }

  // --- Configuration & permissions steps ---

  public onConfigValid(valid: boolean): void {
    this.$configValid.set(valid);
  }

  public onEndpointsResolved(endpoints: Array<ExternalPluginEndpoint>): void {
    this.$endpoints.set(endpoints);
  }

  public onEventSubscriptionsResolved(eventTypes: Array<string>): void {
    this.$eventSubscriptions.set(eventTypes);
  }

  public onCapabilitiesResolved(capabilities: Array<string>): void {
    this.$capabilities.set(capabilities);
  }

  public onPermissionsValid(valid: boolean): void {
    this.$permissionsValid.set(valid);
  }

  public onGrantedEndpointsChange(endpoints: Array<ExternalPluginGrantedEndpointEntry>): void {
    this._configureComponent?.setGrantedEndpoints(endpoints);
  }

  public onGrantedEventsChange(events: Array<ExternalPluginGrantedEventEntry>): void {
    this._configureComponent?.setGrantedEvents(events);
  }

  public onGrantedCapabilitiesChange(capabilities: Array<string>): void {
    this._configureComponent?.setGrantedCapabilities(capabilities);
  }

  public goToPermissionsStep(): void {
    if (this.$configValid()) this.$currentStep.set(2);
  }

  public onComplete(): void {
    if (!this.$permissionsValid() || this.$saving()) return;
    this._configureComponent?.triggerSave();
  }

  public onExternalSave(event: {
    definitionId: string;
    title: string;
    properties: Record<string, unknown>;
    grantedEndpoints: Array<ExternalPluginGrantedEndpointEntry>;
    grantedEvents: Array<ExternalPluginGrantedEventEntry>;
    grantedCapabilities: Array<string>;
  }): void {
    this.$saving.set(true);
    this._externalPluginService
      .createConfiguration({
        definitionId: event.definitionId,
        title: event.title,
        properties: event.properties,
        grantedEndpoints: event.grantedEndpoints,
        grantedEvents: event.grantedEvents,
        grantedCapabilities: event.grantedCapabilities,
      })
      .subscribe({
        next: () => {
          this.completedEvent.emit();
          this._resetAfterClose();
        },
        error: () => {
          this.$saving.set(false);
          this._logger.error('Something went wrong with saving the app configuration.');
        },
      });
  }

  public onClose(): void {
    if (this.$saving()) return;
    this.closeEvent.emit();
    this._resetAfterClose();
  }

  // --- Private helpers ---

  private _startResume(hostId: string): void {
    this.$currentStep.set(1);
    this.$connectState.set('connected');
    this.$resumeLoadFailed.set(false);

    this._externalPluginService
      .getHosts()
      .pipe(catchError(() => of([] as ExternalPluginHost[])))
      .subscribe(hosts => {
        const host = hosts.find(h => h.id === hostId) ?? null;
        if (!host) {
          this.$resumeLoadFailed.set(true);
          return;
        }
        this._host = host;
        this._pollForDefinition(host.id);
      });
  }

  /**
   * Discovery runs synchronously (best-effort) when the host is created, so the definition is
   * usually there on the first try; the poll covers an app that is slow to come up, bounded to
   * roughly the backend's own periodic discovery interval.
   */
  private _pollForDefinition(hostId: string): void {
    const MAX_TRIES = 15;
    let tries = 0;

    this._stopDefinitionPoll();
    this.$resolvingDefinition.set(true);

    this._definitionPollSubscription = timer(0, 2000)
      .pipe(
        switchMap(() =>
          this._externalPluginService
            .getDefinitions()
            .pipe(catchError(() => of([] as ExternalPluginDefinition[])))
        )
      )
      .subscribe(definitions => {
        tries++;
        const definition =
          definitions.find(d => d.hostId === hostId && d.status === 'AVAILABLE') ??
          definitions.find(d => d.hostId === hostId) ??
          null;

        if (definition) {
          this._stopDefinitionPoll();
          this.$resolvingDefinition.set(false);
          this.$definition.set(definition);
          this.$connectState.set('connected');
        } else if (tries >= MAX_TRIES) {
          this._stopDefinitionPoll();
          this.$resolvingDefinition.set(false);
          this.$connectState.set('timeout');
        }
      });
  }

  private _stopDefinitionPoll(): void {
    this._definitionPollSubscription?.unsubscribe();
    this._definitionPollSubscription = null;
  }

  private _buildResumeUrl(hostId: string): string {
    const url = new URL(window.location.href);
    url.searchParams.set('configureApp', hostId);
    return url.toString();
  }

  private _resetAfterClose(): void {
    setTimeout(() => {
      this.$currentStep.set(0);
      this.$connectState.set('idle');
      this.$connectionFormValid.set(false);
      this.$definition.set(null);
      this.$resolvingDefinition.set(false);
      this.$resumeLoadFailed.set(false);
      this.$configValid.set(false);
      this.$permissionsValid.set(false);
      this.$saving.set(false);
      this.$endpoints.set([]);
      this.$eventSubscriptions.set([]);
      this.$capabilities.set([]);
      this.$conflict.set(null);
      this.refreshModalOpen$.next(false);
      this._host = null;
      this._stopDefinitionPoll();
      this._connectionForm?.reset();
    }, CARBON_CONSTANTS.modalAnimationMs);
  }

  /**
   * Carbon's progress indicator recomputes step completion only inside its `current` setter, so a
   * rebuilt steps array must carry the `complete` flags itself: a rebuild with an unchanged current
   * step — the translation file finishing to load after the modal already resumed at the
   * configuration step — would otherwise wipe the checkmarks of the completed steps.
   */
  private _buildProgressSteps(): void {
    this.progressSteps = [
      'pluginManagement.appAdd.steps.connection',
      'pluginManagement.appAdd.steps.configuration',
      'pluginManagement.appAdd.steps.permissions',
    ].map((key, index) => ({
      label: this._translateService.instant(key),
      complete: index < this.$currentStep(),
    }));
  }
}
