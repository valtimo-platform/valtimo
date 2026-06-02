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

import {Component, EventEmitter, Input, OnDestroy, OnInit, Output} from '@angular/core';
import {
  PluginStateService,
  ProcessLinkButtonService,
  ProcessLinkService,
  ProcessLinkStateService,
  ProcessLinkStepService,
} from '../../services';
import {BehaviorSubject, combineLatest, Observable, of, Subscription} from 'rxjs';
import {filter, map, switchMap, take, withLatestFrom} from 'rxjs/operators';
import {
  ExternalPluginDefinition,
  ExternalPluginService,
  extractExternalDefinitionId,
  isExternalPluginKey,
  PluginConfiguration,
  PluginConfigurationData,
} from '@valtimo/plugin';
import {
  ExternalPluginProcessLinkCreateDto,
  ExternalPluginProcessLinkUpdateDto,
  PluginConfigurationReferenceType,
  PluginProcessLinkCreateDto,
  PluginProcessLinkUpdateDto,
  ProcessLink,
} from '../../models';

@Component({
  standalone: false,
  selector: 'valtimo-plugin-action-configuration',
  templateUrl: './plugin-action-configuration.component.html',
  styleUrls: ['./plugin-action-configuration.component.scss'],
})
export class PluginActionConfigurationComponent implements OnInit, OnDestroy {
  @Input() public selectedPluginConfiguration$: Observable<PluginConfiguration>;
  @Output() public valid: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() public configuration: EventEmitter<PluginConfigurationData> =
    new EventEmitter<PluginConfigurationData>();

  public readonly pluginDefinitionKey$ = this._pluginStateService.pluginDefinitionKey$;
  public readonly functionKey$ = this._pluginStateService.functionKey$;
  public readonly save$ = this._pluginStateService.save$;
  public readonly saving$ = this._stateService.saving$;

  public readonly isExternalPlugin$: Observable<boolean> =
    this._pluginStateService.selectedPluginDefinition$.pipe(
      map(definition => isExternalPluginKey(definition?.key))
    );

  public externalActionProperties: Record<string, unknown> = {};
  public externalActionPropertiesJson = '{}';
  public externalActionPropertiesValid = true;

  /** URL for the process-link-action iframe bundle: undefined = loading, null = no bundle, string = bundle URL */
  public readonly externalActionBundleUrl$ = new BehaviorSubject<string | null | undefined>(
    undefined
  );

  /** Emits true once the bundle URL lookup has completed */
  public readonly externalBundleResolved$: Observable<boolean> =
    this.externalActionBundleUrl$.pipe(map(url => url !== undefined));

  /** Prefill data for the iframe when editing an existing process link */
  public readonly externalActionPrefill$ = new BehaviorSubject<{
    title: string;
    configuration: Record<string, unknown>;
  } | null>(null);

  private readonly _prefillConfigurationSubject$ = new BehaviorSubject<
    ProcessLink['actionProperties'] | null
  >(null);
  private readonly _prefillConfiguration$ = combineLatest([
    this._stateService.selectedProcessLink$,
    this._pluginStateService.selectedPluginFunction$,
  ]).pipe(
    map(([processLink, selectedFunction]) => {
      if (!processLink) return undefined;
      const savedActionKey = processLink.pluginActionDefinitionKey;
      const currentActionKey = selectedFunction?.key;
      if (currentActionKey && savedActionKey !== currentActionKey) {
        return undefined;
      }
      return processLink.actionProperties;
    })
  );
  public readonly prefillConfiguration$ = combineLatest([
    this._prefillConfigurationSubject$,
    this._prefillConfiguration$,
  ]).pipe(
    map(
      ([prefillConfigurationSubjectValue, prefillConfiguration]) =>
        prefillConfigurationSubjectValue || prefillConfiguration
    )
  );

  private _subscriptions = new Subscription();

  constructor(
    private readonly _stateService: ProcessLinkStateService,
    private readonly _pluginStateService: PluginStateService,
    private readonly _buttonService: ProcessLinkButtonService,
    private readonly _stepService: ProcessLinkStepService,
    private readonly _processLinkService: ProcessLinkService,
    private readonly _externalPluginService: ExternalPluginService
  ) {}

  ngOnInit(): void {
    this.openBackButtonSubscription();
    this.openSaveButtonSubscription();

    this._subscriptions.add(
      this.isExternalPlugin$.subscribe(isExternal => {
        if (isExternal) {
          this._buttonService.enableSaveButton();
        }
      })
    );

    this._subscriptions.add(
      this._stateService.selectedProcessLink$.pipe(take(1)).subscribe(processLink => {
        if (processLink?.actionProperties) {
          const json = JSON.stringify(processLink.actionProperties, null, 2);
          this.externalActionPropertiesJson = json;
          this.externalActionProperties = processLink.actionProperties;
        }
      })
    );

    this.resolveExternalActionBundleUrl();
  }

  ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  onValid(valid: boolean): void {
    if (valid) this._buttonService.enableSaveButton();
    else this._buttonService.disableSaveButton();
  }

  onConfiguration(configuration: PluginConfigurationData): void {
    this._stateService.startSaving();

    this._stateService.selectedProcessLink$.pipe(take(1)).subscribe(selectedProcessLink => {
      if (selectedProcessLink) {
        this.updateProcessLink(configuration);
      } else {
        this.saveNewProcessLink(configuration);
      }
    });
  }

  public onImportConfiguration(configuration: ProcessLink['actionProperties']): void {
    this._prefillConfigurationSubject$.next(configuration);
  }

  public onExternalActionPropertiesChange(value: string): void {
    this.externalActionPropertiesJson = value;
    try {
      this.externalActionProperties = JSON.parse(value);
      this.externalActionPropertiesValid = true;
      this._buttonService.enableSaveButton();
    } catch {
      this.externalActionPropertiesValid = false;
      this._buttonService.disableSaveButton();
    }
  }

  public onIframeConfigurationChanged(event: {
    valid: boolean;
    title: string;
    data: Record<string, unknown>;
  }): void {
    this.externalActionProperties = event.data;
    this.externalActionPropertiesJson = JSON.stringify(event.data, null, 2);
    this.externalActionPropertiesValid = event.valid;

    if (event.valid) {
      this._buttonService.enableSaveButton();
    } else {
      this._buttonService.disableSaveButton();
    }
  }

  private resolveExternalActionBundleUrl(): void {
    this._subscriptions.add(
      combineLatest([
        this._pluginStateService.selectedPluginDefinition$,
        this._pluginStateService.selectedPluginFunction$,
        this._stateService.selectedProcessLink$,
      ])
        .pipe(
          switchMap(([definition, selectedFunction, selectedProcessLink]) => {
            if (!definition?.key || !isExternalPluginKey(definition.key)) {
              return of(null);
            }

            const actionKey =
              selectedFunction?.key || selectedProcessLink?.actionKey || null;

            const definitionId = extractExternalDefinitionId(definition.key);
            return this._externalPluginService.getDefinition(definitionId).pipe(
              map((extDef: ExternalPluginDefinition) => ({extDef, actionKey}))
            );
          })
        )
        .subscribe(result => {
          if (!result) {
            this.externalActionBundleUrl$.next(null);
            return;
          }

          const {extDef, actionKey} = result;
          const actionBundle = extDef.manifest?.frontendBundles?.find(
            b => b.type === 'process-link-action' && (!b.key || b.key === actionKey)
          );

          if (actionBundle) {
            const bundleUrl = `${extDef.baseUrl}/${extDef.version}${actionBundle.path}`;
            this.externalActionBundleUrl$.next(bundleUrl);

            // Set up prefill for editing existing process links
            if (this.externalActionProperties && Object.keys(this.externalActionProperties).length > 0) {
              this.externalActionPrefill$.next({
                title: '',
                configuration: this.externalActionProperties,
              });
            }
          } else {
            this.externalActionBundleUrl$.next(null);
          }
        })
    );
  }

  private updateProcessLink(configuration: PluginConfigurationData): void {
    combineLatest([
      this._stateService.selectedProcessLink$,
      this._pluginStateService.selectedPluginFunction$,
    ])
      .pipe(take(1))
      .subscribe(([selectedProcessLink, selectedFunction]) => {
        const inferredReferenceType: PluginConfigurationReferenceType =
          (selectedProcessLink.referenceType as PluginConfigurationReferenceType) ||
          (selectedProcessLink.pluginDefinitionKey ? 'BUILDING_BLOCK' : 'FIXED');
        const pluginConfigurationId =
          inferredReferenceType === 'FIXED'
            ? (selectedProcessLink.pluginConfigurationId ?? '')
            : undefined;
        const actionKey =
          selectedFunction?.key ?? selectedProcessLink.pluginActionDefinitionKey ?? '';
        const updateProcessLinkRequest: PluginProcessLinkUpdateDto = {
          id: selectedProcessLink.id,
          pluginConfigurationId,
          pluginActionDefinitionKey: actionKey,
          actionProperties: configuration,
          activityId: selectedProcessLink.activityId,
          referenceType: inferredReferenceType,
          pluginDefinitionKey: selectedProcessLink.pluginDefinitionKey,
        };

        this._stateService.sendProcessLinkUpdateEvent(updateProcessLinkRequest);
      });
  }

  private saveNewProcessLink(configuration: PluginConfigurationData): void {
    combineLatest([
      this._stateService.modalParams$,
      this._pluginStateService.selectedPluginConfiguration$,
      this._pluginStateService.selectedPluginFunction$,
      this._stateService.selectedProcessLinkTypeId$,
      this._pluginStateService.selectedPluginDefinition$,
    ])
      .pipe(take(1))
      .subscribe(
        ([
          modalData,
          selectedConfiguration,
          selectedFunction,
          selectedProcessLinkTypeId,
          selectedDefinition,
        ]) => {
          const isBuildingBlock = this._stateService.isBuildingBlockContext();
          const pluginDefinitionKey =
            selectedConfiguration?.pluginDefinition?.key || selectedDefinition?.key;

          if (!selectedFunction || (isBuildingBlock && !pluginDefinitionKey)) {
            this._stateService.stopSaving();
            return;
          }

          if (!isBuildingBlock && !selectedConfiguration) {
            this._stateService.stopSaving();
            return;
          }

          const referenceType: PluginConfigurationReferenceType = isBuildingBlock
            ? 'BUILDING_BLOCK'
            : 'FIXED';

          const processLinkRequest: PluginProcessLinkCreateDto = {
            actionProperties: configuration,
            activityId: modalData?.element?.id,
            activityType: modalData?.element?.activityListenerType ?? '',
            pluginConfigurationId: isBuildingBlock ? undefined : selectedConfiguration?.id,
            processDefinitionId: modalData?.processDefinitionId,
            pluginActionDefinitionKey: selectedFunction.key,
            processLinkType: selectedProcessLinkTypeId,
            referenceType,
            pluginDefinitionKey,
          };

          this._stateService.sendProcessLinkCreateEvent(processLinkRequest);
        }
      );
  }

  private openBackButtonSubscription(): void {
    this._subscriptions.add(
      this._buttonService.backButtonClick$
        .pipe(
          withLatestFrom(this._stateService.isEditing$),
          filter(([, isEditing]) => !isEditing)
        )
        .subscribe(() => {
          this._stepService.setChoosePluginActionSteps();
        })
    );
  }

  private openSaveButtonSubscription(): void {
    this._subscriptions.add(
      this._buttonService.saveButtonClick$
        .pipe(withLatestFrom(this.isExternalPlugin$))
        .subscribe(([, isExternal]) => {
          if (isExternal) {
            this.saveExternalPluginProcessLink();
          } else {
            this._pluginStateService.save();
          }
        })
    );
  }

  private saveExternalPluginProcessLink(): void {
    this._stateService.startSaving();

    combineLatest([
      this._stateService.modalParams$,
      this._pluginStateService.selectedPluginConfiguration$,
      this._pluginStateService.selectedPluginFunction$,
      this._stateService.selectedProcessLink$,
      this._pluginStateService.selectedPluginDefinition$,
    ])
      .pipe(
        take(1),
        switchMap(([modalData, selectedConfiguration, selectedFunction, selectedProcessLink, selectedDefinition]) => {
          if (!selectedConfiguration || !selectedFunction || !selectedDefinition) {
            this._stateService.stopSaving();
            return of(null);
          }

          const definitionId = extractExternalDefinitionId(selectedDefinition.key);
          return this._externalPluginService.getDefinition(definitionId).pipe(
            map(definition => ({
              modalData,
              selectedConfiguration,
              selectedFunction,
              selectedProcessLink,
              pluginVersion: definition.version,
            }))
          );
        })
      )
      .subscribe(result => {
        if (!result) return;

        const {modalData, selectedConfiguration, selectedFunction, selectedProcessLink, pluginVersion} = result;
        const actionProperties = this.externalActionProperties;

        if (selectedProcessLink) {
          const updateRequest: ExternalPluginProcessLinkUpdateDto = {
            id: selectedProcessLink.id,
            processLinkType: 'external_plugin',
            externalPluginConfigurationId: selectedConfiguration.id,
            actionKey: selectedFunction.key,
            pluginVersion,
            actionProperties,
          };
          this._stateService.sendProcessLinkUpdateEvent(updateRequest);
        } else {
          const createRequest: ExternalPluginProcessLinkCreateDto = {
            processDefinitionId: modalData?.processDefinitionId,
            activityId: modalData?.element?.id,
            activityType: modalData?.element?.activityListenerType ?? '',
            processLinkType: 'external_plugin',
            externalPluginConfigurationId: selectedConfiguration.id,
            actionKey: selectedFunction.key,
            pluginVersion,
            actionProperties,
          };
          this._stateService.sendProcessLinkCreateEvent(createRequest);
        }
      });
  }
}
