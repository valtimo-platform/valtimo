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

import {Component, EventEmitter, Input, OnDestroy, Output, ViewChild} from '@angular/core';
import {PluginManagementStateService} from '../../services';
import {map, take} from 'rxjs/operators';
import {BehaviorSubject, combineLatest, Observable, Subscription} from 'rxjs';
import {
  ExternalPluginDefinition,
  ExternalPluginGrantedEndpointEntry,
  ExternalPluginGrantedEventEntry,
  ExternalPluginEndpoint,
  ExternalPluginService,
  extractExternalDefinitionId,
  isExternalPluginDefinitionIncompatible,
  isExternalPluginKey,
  PluginConfigurationData,
  PluginManagementService,
} from '@valtimo/plugin';
import {PluginExternalConfigureComponent} from '../plugin-external-configure/plugin-external-configure.component';
import {NGXLogger} from 'ngx-logger';
import {CARBON_CONSTANTS} from '@valtimo/components';
import {TranslateService} from '@ngx-translate/core';
import {buildExternalPluginCompatibilityMessage} from '../../utils';

@Component({
  standalone: false,
  selector: 'valtimo-plugin-add-modal',
  templateUrl: './plugin-add-modal.component.html',
  styleUrls: ['./plugin-add-modal.component.scss'],
})
export class PluginAddModalComponent implements OnDestroy {
  /**
   * Opening with a plugin already selected — the "Configure plugin" action on the upload
   * notification does exactly that — skips the choose-a-plugin step and lands on the configuration
   * form, which is the whole point of that shortcut.
   */
  @Input() public set open(value: boolean) {
    const wasOpen = this._open;
    this._open = value;
    if (value && !wasOpen) this._skipSelectStepWhenPreselected();
  }
  public get open(): boolean {
    return this._open;
  }

  @Input() public set externalDefinitions(value: ExternalPluginDefinition[] | null) {
    this._externalDefinitions = value;
    this._externalDefinitions$.next(value ?? []);
  }
  public get externalDefinitions(): ExternalPluginDefinition[] | null {
    return this._externalDefinitions;
  }

  @Output() public closeModal = new EventEmitter<boolean>();

  public readonly inputDisabled$ = this._stateService.inputDisabled$;
  public readonly selectedPluginDefinition$ = this._stateService.selectedPluginDefinition$;
  public readonly configurationValid$ = new BehaviorSubject<boolean>(false);

  private _open = false;
  private _externalDefinitions: ExternalPluginDefinition[] | null = null;
  private readonly _externalDefinitions$ = new BehaviorSubject<ExternalPluginDefinition[]>([]);

  public readonly isExternalPlugin$: Observable<boolean> = this.selectedPluginDefinition$.pipe(
    map(def => isExternalPluginKey(def?.key))
  );

  /**
   * The localized compatibility warning to show on the configure step, or null when the selected
   * plugin is embedded, compatible, or not yet chosen. Recomputed on language change so the message
   * stays localized.
   */
  public readonly incompatibleWarning$: Observable<string | null> = combineLatest([
    this.selectedPluginDefinition$,
    this._externalDefinitions$,
    this._translateService.stream('key'),
  ]).pipe(
    map(([selected, definitions]) => {
      if (!selected || !isExternalPluginKey(selected.key)) return null;
      const definition = definitions.find(d => d.id === extractExternalDefinitionId(selected.key));
      if (!isExternalPluginDefinitionIncompatible(definition)) return null;
      return buildExternalPluginCompatibilityMessage(definition!, this._translateService);
    })
  );

  public readonly endpoints$ = new BehaviorSubject<
    Array<ExternalPluginEndpoint>
  >([]);
  public readonly eventSubscriptions$ = new BehaviorSubject<Array<string>>([]);
  public readonly capabilities$ = new BehaviorSubject<Array<string>>([]);
  public readonly egress$ = new BehaviorSubject<Array<string>>([]);
  public readonly derivedEgress$ = new BehaviorSubject<Array<string>>([]);
  public readonly permissionsValid$ = new BehaviorSubject<boolean>(false);

  public currentStepIndex = 0;
  public isExternal = false;
  public progressSteps: Array<{label: string}> = [];

  @ViewChild(PluginExternalConfigureComponent)
  private _externalConfigureComponent: PluginExternalConfigureComponent | undefined;

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly _stateService: PluginManagementStateService,
    private readonly _pluginManagementService: PluginManagementService,
    private readonly _externalPluginService: ExternalPluginService,
    private readonly _logger: NGXLogger,
    private readonly _translateService: TranslateService
  ) {
    this._buildProgressSteps();
    this._subscriptions.add(
      this._translateService.onLangChange.subscribe(() => this._buildProgressSteps())
    );
    this._subscriptions.add(
      this.isExternalPlugin$.subscribe(isExternal => {
        this.isExternal = isExternal;
        this._buildProgressSteps();
      })
    );
  }

  ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  /**
   * Lands on the configuration step when the modal is opened while a plugin is already selected.
   * The step count itself is already right by now: `isExternal` is kept in sync from the
   * constructor's `isExternalPlugin$` subscription, which fires synchronously off the selection.
   */
  private _skipSelectStepWhenPreselected(): void {
    this.selectedPluginDefinition$
      .pipe(take(1))
      .subscribe(definition => {
        if (definition) this.currentStepIndex = 1;
      });
  }

  public goToNextStep(): void {
    if (this.currentStepIndex < this.progressSteps.length - 1) {
      this.currentStepIndex++;
    }
  }

  public complete(): void {
    this._stateService.save();
  }

  public hide(): void {
    this.closeModal.emit();

    setTimeout(() => {
      this.currentStepIndex = 0;
      this.isExternal = false;
      this._stateService.enableInput();
      this._stateService.clear();
      this.configurationValid$.next(false);
      this.endpoints$.next([]);
      this.eventSubscriptions$.next([]);
      this.capabilities$.next([]);
      this.permissionsValid$.next(false);
      this._buildProgressSteps();
    }, CARBON_CONSTANTS.modalAnimationMs);
  }

  public onValid(valid: boolean): void {
    this.configurationValid$.next(valid);
  }

  public onConfiguration(configuration: PluginConfigurationData): void {
    const pluginConfiguration = {...configuration};
    delete pluginConfiguration['configurationId'];
    delete pluginConfiguration['configurationTitle'];

    this._stateService.disableInput();

    this._stateService.selectedPluginDefinition$.pipe(take(1)).subscribe(selectedDefinition => {
      this._pluginManagementService
        .savePluginConfiguration({
          id: configuration.configurationId,
          definitionKey: selectedDefinition.key,
          title: configuration.configurationTitle,
          properties: pluginConfiguration,
        })
        .subscribe({
          next: () => {
            this._stateService.refresh();
            this.hide();
          },
          error: () => {
            this._logger.error('Something went wrong with saving the plugin configuration.');
            this._stateService.enableInput();
          },
        });
    });
  }

  public onEndpointsResolved(
    endpoints: Array<ExternalPluginEndpoint>
  ): void {
    this.endpoints$.next(endpoints);
    this._recomputePermissionsValid();
  }

  public onEventSubscriptionsResolved(eventTypes: Array<string>): void {
    this.eventSubscriptions$.next(eventTypes);
    this._recomputePermissionsValid();
  }

  public onPermissionsValid(valid: boolean): void {
    this.permissionsValid$.next(valid);
  }

  public onGrantedEndpointsChange(endpoints: Array<ExternalPluginGrantedEndpointEntry>): void {
    this._externalConfigureComponent?.setGrantedEndpoints(endpoints);
  }

  public onGrantedEventsChange(events: Array<ExternalPluginGrantedEventEntry>): void {
    this._externalConfigureComponent?.setGrantedEvents(events);
  }

  public onCapabilitiesResolved(caps: Array<string>): void {
    this.capabilities$.next(caps);
    this._recomputePermissionsValid();
  }

  public onGrantedCapabilitiesChange(caps: Array<string>): void {
    this._externalConfigureComponent?.setGrantedCapabilities(caps);
  }

  public onEgressResolved(targets: Array<string>): void {
    this.egress$.next(targets);
    this._recomputePermissionsValid();
  }

  /**
   * Derived destinations don't gate the step — the admin already supplied them by typing the value —
   * so this only refreshes the display.
   */
  public onDerivedEgressResolved(targets: Array<string>): void {
    this.derivedEgress$.next(targets);
  }

  public onGrantedEgressChange(targets: Array<string>): void {
    this._externalConfigureComponent?.setGrantedEgress(targets);
  }

  public onExternalSave(event: {
    definitionId: string;
    title: string;
    properties: Record<string, unknown>;
    grantedEndpoints: Array<ExternalPluginGrantedEndpointEntry>;
    grantedEvents: Array<ExternalPluginGrantedEventEntry>;
    grantedCapabilities: Array<string>;
    grantedEgress: Array<string>;
  }): void {
    this._stateService.disableInput();

    this._externalPluginService
      .createConfiguration({
        definitionId: event.definitionId,
        title: event.title,
        properties: event.properties,
        grantedEndpoints: event.grantedEndpoints,
        grantedEvents: event.grantedEvents,
        grantedCapabilities: event.grantedCapabilities,
        grantedEgress: event.grantedEgress,
      })
      .subscribe({
        next: () => {
          this._stateService.refresh();
          this.hide();
        },
        error: () => {
          this._logger.error(
            'Something went wrong with saving the external plugin configuration.'
          );
          this._stateService.enableInput();
        },
      });
  }

  /**
   * Permissions step starts valid (no acknowledgement required) only when the plugin declared nothing
   * to acknowledge — no endpoints, events, capabilities or manifest egress targets. The
   * acknowledgement otherwise gates the step.
   */
  private _recomputePermissionsValid(): void {
    const hasNothing = this.endpoints$.value.length === 0
      && this.eventSubscriptions$.value.length === 0
      && this.capabilities$.value.length === 0
      && this.egress$.value.length === 0;
    if (hasNothing) {
      this.permissionsValid$.next(true);
    }
  }

  private _buildProgressSteps(): void {
    const steps = [
      {label: this._translateService.instant('pluginManagement.addSteps.step0')},
      {label: this._translateService.instant('pluginManagement.addSteps.step1')},
    ];

    if (this.isExternal) {
      steps.push({
        label: this._translateService.instant('pluginManagement.addSteps.step2'),
      });
    }

    this.progressSteps = steps;
  }
}
