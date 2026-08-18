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
import {FormControl} from '@angular/forms';
import {
  PluginStateService,
  ProcessLinkButtonService,
  ProcessLinkService,
  ProcessLinkStateService,
  ProcessLinkStepService,
} from '../../services';
import {BehaviorSubject, combineLatest, Observable, of, Subscription} from 'rxjs';
import {
  catchError,
  filter,
  map,
  shareReplay,
  switchMap,
  take,
  withLatestFrom,
} from 'rxjs/operators';
import {
  ExternalPluginDefinition,
  ExternalPluginService,
  extractExternalDefinitionId,
  isExternalPluginKey,
  PluginConfiguration,
  PluginConfigurationData,
  PluginFunction,
} from '@valtimo/plugin';
import {
  ExternalPluginProcessLinkCreateDto,
  ExternalPluginProcessLinkUpdateDto,
  ExternalPluginTaskFormProcessLinkCreateDto,
  ExternalPluginTaskFormProcessLinkUpdateDto,
  PluginActionResultMapping,
  PluginConfigurationReferenceType,
  PluginProcessLinkCreateDto,
  PluginProcessLinkUpdateDto,
  ProcessLink,
} from '../../models';
import {USER_TASK_ACTIVITY} from '../../constants';
import {ActivatedRoute} from '@angular/router';
import {getBuildingBlockManagementRouteParams, getCaseManagementRouteParams} from '@valtimo/shared';

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

  public readonly currentStepId$ = this._stepService.currentStepId$;
  public readonly selectedFunction$: Observable<PluginFunction> =
    this._pluginStateService.selectedPluginFunction$;

  /**
   * The selected external action's declared `outputs`, resolved from the selected function when
   * available and falling back to a manifest lookup (edit mode: `loadExternalPluginStateForProcessLink`
   * only sets the selected function's `key`, not its `outputs`). Passed to the mappings editor as
   * `sourceKeys` — a dropdown of these keys replaces the free-text pointer input.
   */
  public readonly selectedFunctionOutputs$: Observable<Array<string>> = combineLatest([
    this.isExternalPlugin$,
    this._pluginStateService.selectedPluginDefinition$,
    this.selectedFunction$,
    this._stateService.selectedProcessLink$,
  ]).pipe(
    switchMap(([isExternal, definition, selectedFunction, selectedProcessLink]) => {
      if (!isExternal || !definition?.key) return of([]);
      if (selectedFunction?.outputs?.length) return of(selectedFunction.outputs);

      const actionKey = selectedFunction?.key || selectedProcessLink?.actionKey;
      if (!actionKey) return of([]);

      const definitionId = extractExternalDefinitionId(definition.key);
      return this._externalPluginService.getDefinition(definitionId).pipe(
        map((extDef: ExternalPluginDefinition) => {
          const action = extDef.manifest?.actions?.find(a => a.key === actionKey);
          return action?.outputs ?? [];
        }),
        // A failed manifest lookup must not kill the outer stream — fall back to "no outputs".
        catchError(() => of([] as Array<string>))
      );
    }),
    shareReplay({bufferSize: 1, refCount: true})
  );

  /**
   * True when the selected external action declares `outputs` in its manifest — the only case the
   * dedicated output-mapping step (and its Next/Save button swap) applies. Embedded actions have
   * no declaration mechanism and never carry this.
   */
  public readonly hasResultMappingsStep$: Observable<boolean> = this.selectedFunctionOutputs$.pipe(
    map(outputs => outputs.length > 0)
  );

  /**
   * True when the external plugin is being linked to a user task: the plugin contributes a
   * `task-form` (rendered + completed by the plugin), not a service-task action. In that case this
   * step has nothing to configure — the selected form is saved as an `external_plugin_task_form`
   * link. Derived from the edited link's type (edit) or the activity being configured (create).
   */
  public readonly isTaskForm$: Observable<boolean> = combineLatest([
    this.isExternalPlugin$,
    this._stateService.modalParams$,
    this._stateService.selectedProcessLink$,
  ]).pipe(
    map(([isExternal, modalParams, selectedProcessLink]) =>
      selectedProcessLink
        ? selectedProcessLink.processLinkType === 'external_plugin_task_form'
        : isExternal && modalParams?.element?.activityListenerType === USER_TASK_ACTIVITY
    )
  );

  public externalActionProperties: Record<string, unknown> = {};
  public externalActionPropertiesValid = true;

  /** Reactive control backing the raw-JSON textarea fallback (no iframe bundle available). */
  public readonly externalActionPropertiesControl = new FormControl<string>('{}', {
    nonNullable: true,
  });

  /**
   * `actionResultMappings` (#771): row-based JSON-pointer -> value-resolver-target write-back
   * rules for the action's return value, kept by `PluginActionResultMappingsComponent` and read
   * here purely as a plain value (that component owns its own form state).
   */
  public actionResultMappings: Array<PluginActionResultMapping> = [];

  private readonly _resultMappingsValid$ = new BehaviorSubject<boolean>(true);

  /** URL for the process-link-action iframe bundle: undefined = loading, null = no bundle, string = bundle URL */
  public readonly externalActionBundleUrl$ = new BehaviorSubject<string | null | undefined>(
    undefined
  );

  /** Emits true once the bundle URL lookup has completed */
  public readonly externalBundleResolved$: Observable<boolean> = this.externalActionBundleUrl$.pipe(
    map(url => url !== undefined)
  );

  /** Prefill data for the iframe when editing an existing process link */
  public readonly externalActionPrefill$ = new BehaviorSubject<{
    title: string;
    configuration: Record<string, unknown>;
  } | null>(null);

  private readonly _prefillConfigurationSubject$ = new BehaviorSubject<
    ProcessLink['actionProperties'] | null
  >(null);
  // Only prefill if the action key hasn't changed from what's saved in the process link
  private readonly _prefillConfiguration$ = combineLatest([
    this._stateService.selectedProcessLink$,
    this._pluginStateService.selectedPluginFunction$,
  ]).pipe(
    map(([processLink, selectedFunction]) => {
      if (!processLink) return undefined;
      // Only prefill if the action hasn't been changed
      const savedActionKey = processLink.pluginActionDefinitionKey;
      const currentActionKey = selectedFunction?.key;
      if (currentActionKey && savedActionKey !== currentActionKey) {
        return undefined; // Action changed, don't prefill old configuration
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

  /** Case/building-block route context, forwarded to the result-mapping target's value-path selector. */
  public readonly caseParams$ = getCaseManagementRouteParams(this._route);
  public readonly buildingBlockParams$ = getBuildingBlockManagementRouteParams(this._route);

  private _subscriptions = new Subscription();

  constructor(
    private readonly _stateService: ProcessLinkStateService,
    private readonly _pluginStateService: PluginStateService,
    private readonly _buttonService: ProcessLinkButtonService,
    private readonly _stepService: ProcessLinkStepService,
    private readonly _processLinkService: ProcessLinkService,
    private readonly _externalPluginService: ExternalPluginService,
    private readonly _route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.openBackButtonSubscription();
    this.openSaveButtonSubscription();
    this.openNextButtonSubscription();
    this.openMappingsBackButtonSubscription();

    this._subscriptions.add(
      combineLatest([this.isExternalPlugin$, this.hasResultMappingsStep$]).subscribe(
        ([isExternal, hasResultMappingsStep]) => {
          // A pending output-mapping step keeps Next/Save handled by
          // `setConfigurePluginActionSteps()`/`setConfigurePluginActionResultMappingsSteps()` — do
          // not race that with an unconditional enableSaveButton() here. Save is only enabled when
          // the current action configuration is valid — an invalid configuration must never be
          // saveable (subsequent validity changes are handled by `applyActionPropertiesValidity`).
          if (isExternal && !hasResultMappingsStep && this.externalActionPropertiesValid) {
            this._buttonService.enableSaveButton();
          }
        }
      )
    );

    this._subscriptions.add(
      this.externalActionPropertiesControl.valueChanges.subscribe(value => {
        this.handleExternalActionPropertiesChange(value);
      })
    );

    this._subscriptions.add(
      // Save on the mappings step is gated only by the rows' own validity (zero rows is valid;
      // every present row needs both source and target). The action properties were already
      // validated to reach this step — their validity gated the Next button — and neither the
      // create path (step service shows Save without enabling it) nor edit mode (the generic edit
      // navigation only toggles visibility) enables Save on arrival.
      combineLatest([this.currentStepId$, this._resultMappingsValid$])
        .pipe(filter(([stepId]) => stepId === 'configurePluginActionResultMappings'))
        .subscribe(([, mappingsValid]) => {
          if (mappingsValid) {
            this._buttonService.enableSaveButton();
          } else {
            this._buttonService.disableSaveButton();
          }
        })
    );

    this._subscriptions.add(
      this._stateService.selectedProcessLink$.pipe(take(1)).subscribe(processLink => {
        if (processLink?.actionProperties) {
          const json = JSON.stringify(processLink.actionProperties, null, 2);
          // Programmatic update: properties/validity are set directly, so skip re-parsing.
          this.externalActionPropertiesControl.setValue(json, {emitEvent: false});
          this.externalActionProperties = processLink.actionProperties;
        }
        this.actionResultMappings = processLink?.actionResultMappings ?? [];
      })
    );

    this.openEditModeResultMappingsSubscription();
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

  private handleExternalActionPropertiesChange(value: string): void {
    try {
      this.externalActionProperties = JSON.parse(value);
      this.externalActionPropertiesValid = true;
    } catch {
      this.externalActionPropertiesValid = false;
    }
    this.applyActionPropertiesValidity();
  }

  public onIframeConfigurationChanged(event: {
    valid: boolean;
    title: string;
    data: Record<string, unknown>;
  }): void {
    this.externalActionProperties = event.data;
    // Programmatic update: properties/validity are set directly, so skip re-parsing.
    this.externalActionPropertiesControl.setValue(JSON.stringify(event.data, null, 2), {
      emitEvent: false,
    });
    this.externalActionPropertiesValid = event.valid;
    this.applyActionPropertiesValidity();
  }

  /**
   * The action-properties step's validity gates whichever button is visible on it: `Save` when the
   * action has no pending output-mapping step, `Next` when it does (Save only appears on the
   * mappings step in that case — see {@link openNextButtonSubscription}).
   */
  private applyActionPropertiesValidity(): void {
    this.hasResultMappingsStep$.pipe(take(1)).subscribe(hasResultMappingsStep => {
      const toggle = hasResultMappingsStep
        ? ['enableNextButton', 'disableNextButton']
        : ['enableSaveButton', 'disableSaveButton'];
      this._buttonService[this.externalActionPropertiesValid ? toggle[0] : toggle[1]]();
    });
  }

  public onActionResultMappingsChange(mappings: Array<PluginActionResultMapping>): void {
    this.actionResultMappings = mappings;
  }

  public onActionResultMappingsValidityChange(valid: boolean): void {
    this._resultMappingsValid$.next(valid);
  }

  /**
   * Edit mode opens directly on the last step, bypassing `setConfigurePluginActionSteps()` (which
   * normally decides whether the mappings step exists). `loadExternalPluginStateForProcessLink`
   * only sets the selected function's `key` (no `outputs`), so this relies on
   * {@link selectedFunctionOutputs$}'s manifest-lookup fallback to find the declared `outputs`.
   */
  private openEditModeResultMappingsSubscription(): void {
    this._subscriptions.add(
      combineLatest([this._stateService.selectedProcessLink$, this.hasResultMappingsStep$])
        .pipe(
          // The outputs resolution is async (definition + manifest lookups) and its first emission
          // can be a premature empty result — taking a single emission would lock in the 3-step
          // layout whenever those lookups lose the race. Wait for the first conclusive
          // "has outputs" instead; links whose action declares none simply never switch.
          filter(
            ([selectedProcessLink, hasResultMappingsStep]) =>
              selectedProcessLink?.processLinkType === 'external_plugin' && hasResultMappingsStep
          ),
          take(1)
        )
        .subscribe(() => {
          this._stepService.initializeEditModeResultMappingsSteps();
        })
    );
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

            const actionKey = selectedFunction?.key || selectedProcessLink?.actionKey || null;

            const definitionId = extractExternalDefinitionId(definition.key);
            return this._externalPluginService.getDefinition(definitionId).pipe(
              map((extDef: ExternalPluginDefinition) => ({extDef, actionKey})),
              // A failed bundle resolve must not break the flow: emit null so the subscriber
              // marks the lookup as resolved without a bundle URL, which makes the template fall
              // back to the raw-JSON textarea configuration mode.
              catchError(() => of(null))
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
            if (
              this.externalActionProperties &&
              Object.keys(this.externalActionProperties).length > 0
            ) {
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
        // Use the currently selected function key (user may have changed it)
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
          actionResultMappings: this.actionResultMappings,
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
            actionResultMappings: this.actionResultMappings,
          };

          this._stateService.sendProcessLinkCreateEvent(processLinkRequest);
        }
      );
  }

  private openBackButtonSubscription(): void {
    this._subscriptions.add(
      this._buttonService.backButtonClick$
        .pipe(
          withLatestFrom(this._stateService.isEditing$, this.currentStepId$),
          filter(
            ([, isEditing, currentStepId]) =>
              !isEditing && currentStepId === 'configurePluginAction'
          )
        )
        .subscribe(() => {
          this._stepService.setChoosePluginActionSteps();
        })
    );
  }

  /**
   * Distinct from {@link openBackButtonSubscription}: back from the output-mapping step returns to
   * the (still-alive) properties step instead of `choosePluginAction`, guarded on this component's
   * own step relevance the same way the other back-handlers guard on `!isEditing`.
   */
  private openMappingsBackButtonSubscription(): void {
    this._subscriptions.add(
      this._buttonService.backButtonClick$
        .pipe(
          withLatestFrom(this._stateService.isEditing$, this.currentStepId$),
          filter(
            ([, isEditing, currentStepId]) =>
              !isEditing && currentStepId === 'configurePluginActionResultMappings'
          )
        )
        .subscribe(() => {
          this._stepService.setConfigurePluginActionSteps();
        })
    );
  }

  private openNextButtonSubscription(): void {
    this._subscriptions.add(
      this._buttonService.nextButtonClick$
        .pipe(
          withLatestFrom(
            this._stateService.isEditing$,
            this.currentStepId$,
            this.hasResultMappingsStep$
          ),
          filter(
            ([, isEditing, currentStepId, hasResultMappingsStep]) =>
              !isEditing && currentStepId === 'configurePluginAction' && hasResultMappingsStep
          )
        )
        .subscribe(() => {
          this._stepService.setConfigurePluginActionResultMappingsSteps();
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

    const isBuildingBlock = this._stateService.isBuildingBlockContext();

    combineLatest([
      this._stateService.modalParams$,
      this._pluginStateService.selectedPluginConfiguration$,
      this._pluginStateService.selectedPluginFunction$,
      this._stateService.selectedProcessLink$,
      this._pluginStateService.selectedPluginDefinition$,
    ])
      .pipe(
        take(1),
        switchMap(
          ([
            modalData,
            selectedConfiguration,
            selectedFunction,
            selectedProcessLink,
            selectedDefinition,
          ]) => {
            if (!selectedFunction || !selectedDefinition) {
              this._stateService.stopSaving();
              return of(null);
            }
            if (!isBuildingBlock && !selectedConfiguration) {
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
                pluginDefinitionKey: definition.pluginId,
              })),
              // A failed definition lookup would otherwise leave the modal in the "saving" state
              // forever — release it and bail out (the global HTTP interceptor shows the error).
              catchError(() => {
                this._stateService.stopSaving();
                return of(null);
              })
            );
          }
        )
      )
      .subscribe(result => {
        if (!result) return;

        const {
          modalData,
          selectedConfiguration,
          selectedFunction,
          selectedProcessLink,
          pluginVersion,
          pluginDefinitionKey,
        } = result;

        // A user-task link is the plugin's task-form (rendered + completed by the plugin), not a
        // service-task action — persist it as the dedicated `external_plugin_task_form` type.
        const isTaskForm = selectedProcessLink
          ? selectedProcessLink.processLinkType === 'external_plugin_task_form'
          : modalData?.element?.activityListenerType === USER_TASK_ACTIVITY;

        if (isTaskForm) {
          // A task-form link always references a concrete configuration — without one (or its id)
          // there is nothing valid to persist, so release the saving state and bail out.
          if (!selectedConfiguration?.id) {
            this._stateService.stopSaving();
            return;
          }

          // The selected "function" is a task-form bundle; its key is the bundle key (empty = the
          // plugin's sole task-form bundle → null).
          const bundleKey = selectedFunction.key || null;
          if (selectedProcessLink) {
            const updateRequest: ExternalPluginTaskFormProcessLinkUpdateDto = {
              id: selectedProcessLink.id,
              processLinkType: 'external_plugin_task_form',
              externalPluginConfigurationId: selectedConfiguration.id,
              pluginVersion,
              bundleKey,
            };
            this._stateService.sendProcessLinkUpdateEvent(updateRequest);
          } else {
            const createRequest: ExternalPluginTaskFormProcessLinkCreateDto = {
              processDefinitionId: modalData?.processDefinitionId,
              activityId: modalData?.element?.id,
              activityType: modalData?.element?.activityListenerType ?? '',
              processLinkType: 'external_plugin_task_form',
              externalPluginConfigurationId: selectedConfiguration.id,
              pluginVersion,
              bundleKey,
            };
            this._stateService.sendProcessLinkCreateEvent(createRequest);
          }
          return;
        }

        const actionProperties = this.externalActionProperties;
        const actionResultMappings = this.actionResultMappings;

        // In building-block context we send referenceType 'BUILDING_BLOCK' + pluginDefinitionKey +
        // pluginVersion and omit externalPluginConfigurationId — the concrete configuration is
        // resolved at runtime from the building block's plugin mappings (D1/D2), mirroring the
        // embedded save path's building-block branch.
        if (selectedProcessLink) {
          const updateRequest: ExternalPluginProcessLinkUpdateDto = {
            id: selectedProcessLink.id,
            processLinkType: 'external_plugin',
            externalPluginConfigurationId: isBuildingBlock ? undefined : selectedConfiguration.id,
            actionKey: selectedFunction.key,
            pluginVersion,
            referenceType: isBuildingBlock ? 'BUILDING_BLOCK' : 'FIXED',
            pluginDefinitionKey: isBuildingBlock ? pluginDefinitionKey : undefined,
            actionProperties,
            actionResultMappings,
          };
          this._stateService.sendProcessLinkUpdateEvent(updateRequest);
        } else {
          const createRequest: ExternalPluginProcessLinkCreateDto = {
            processDefinitionId: modalData?.processDefinitionId,
            activityId: modalData?.element?.id,
            activityType: modalData?.element?.activityListenerType ?? '',
            processLinkType: 'external_plugin',
            externalPluginConfigurationId: isBuildingBlock ? undefined : selectedConfiguration.id,
            actionKey: selectedFunction.key,
            pluginVersion,
            referenceType: isBuildingBlock ? 'BUILDING_BLOCK' : 'FIXED',
            pluginDefinitionKey: isBuildingBlock ? pluginDefinitionKey : undefined,
            actionProperties,
            actionResultMappings,
          };
          this._stateService.sendProcessLinkCreateEvent(createRequest);
        }
      });
  }
}
