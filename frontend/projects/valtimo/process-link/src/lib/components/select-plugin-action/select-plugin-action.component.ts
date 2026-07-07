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
import {Component, Injector, OnDestroy, OnInit} from '@angular/core';
import {
  ExternalPluginAction,
  ExternalPluginService,
  extractExternalDefinitionId,
  isExternalPluginKey,
  PluginDefinition,
  PluginFunction,
  PluginManagementService,
  PluginService,
} from '@valtimo/plugin';
import {combineLatest, forkJoin, Observable, of, Subscription} from 'rxjs';
import {catchError, filter, map, switchMap, take, withLatestFrom} from 'rxjs/operators';

import {
  PluginStateService,
  ProcessLinkButtonService,
  ProcessLinkStateService,
  ProcessLinkStepService,
} from '../../services';

/**
 * Maps the manifest action `activityTypes` (backend `ActivityTypeWithEventName` names) to the
 * `bpmn:{Type}:{event}` value the BPMN editor reports as `activityListenerType`. Only the activity
 * types an external plugin action can realistically declare need to be listed; an unrecognised name
 * never causes an action to be hidden (see `_actionSupportsActivity`).
 */
const ACTIVITY_TYPE_NAME_TO_VALUE: Record<string, string> = {
  SERVICE_TASK_START: 'bpmn:ServiceTask:start',
  SERVICE_TASK_END: 'bpmn:ServiceTask:end',
  CALL_ACTIVITY_START: 'bpmn:CallActivity:start',
  CALL_ACTIVITY_END: 'bpmn:CallActivity:end',
  START_EVENT_START: 'bpmn:StartEvent:start',
  USER_TASK_CREATE: 'bpmn:UserTask:create',
};

/** The `activityListenerType` the BPMN editor reports for a user task. */
const USER_TASK_ACTIVITY = 'bpmn:UserTask:create';

@Component({
  standalone: false,
  selector: 'valtimo-select-plugin-action',
  templateUrl: './select-plugin-action.component.html',
  styleUrls: ['./select-plugin-action.component.scss'],
})
export class SelectPluginActionComponent implements OnInit, OnDestroy {
  public readonly pluginFunctions$: Observable<Array<PluginFunction> | undefined> = combineLatest([
    this._stateService.selectedPluginDefinition$,
    this._processLinkStateService.modalParams$,
    this._stateService.selectedPluginConfiguration$,
    this._pluginService.pluginSpecifications$,
  ]).pipe(
    switchMap(([selectedDefinition, modalParams, selectedConfiguration, pluginSpecifications]) => {
      if (!selectedDefinition) return of(undefined);

      if (isExternalPluginKey(selectedDefinition.key)) {
        const definitionId = extractExternalDefinitionId(selectedDefinition.key);
        const activityType = modalParams?.element?.activityListenerType;
        return this._externalPluginService.getDefinition(definitionId).pipe(
          map(definition => {
            // On a user task an external plugin contributes its `task-form` bundle(s) — the form the
            // plugin renders and completes — rather than service-task actions (which are invoked by
            // execution listeners and could never render on a user task). Offering them here keeps a
            // single "Plugin" entry point: pick the plugin, then pick its form.
            if (activityType === USER_TASK_ACTIVITY) {
              return (definition.manifest?.frontendBundles ?? [])
                .filter(bundle => bundle.type === 'task-form')
                .map(bundle => ({
                  key: bundle.key ?? '',
                  title: bundle.title ?? bundle.key ?? 'Form',
                  description: '',
                }));
            }

            const actions = definition.manifest?.actions;
            if (!actions?.length) return [];
            // Only offer actions valid for the activity being configured (mirrors the activity-type
            // filtering applied to embedded plugins below).
            return actions
              .filter(action => this._actionSupportsActivity(action, activityType))
              .map(action => ({
                key: action.key,
                title: action.title ?? action.key,
                description: action.description ?? '',
              }));
          }),
          catchError(() => of([]))
        );
      }

      return this._pluginManagementService
        .getPluginFunctions(selectedDefinition.key, modalParams.element.activityListenerType)
        .pipe(
          switchMap(functions => {
            const specification = pluginSpecifications.find(
              s => s.pluginId === selectedDefinition.key
            );
            if (!specification?.functionConfigurationComponentsFilter) return of(functions);

            const props = (selectedConfiguration?.properties ?? {}) as {[key: string]: any};
            const filterFn = specification.functionConfigurationComponentsFilter;

            return forkJoin(
              functions.map(fn =>
                filterFn(props, fn.key, this._injector).pipe(map(visible => ({fn, visible})))
              )
            ).pipe(map(results => results.filter(r => r.visible).map(r => r.fn)));
          })
        );
    })
  );

  public readonly selectedPluginDefinition$: Observable<PluginDefinition> =
    this._stateService.selectedPluginDefinition$;
  public readonly selectedPluginFunction$: Observable<PluginFunction> =
    this._stateService.selectedPluginFunction$;
  public readonly isExternalPlugin$: Observable<boolean> = this.selectedPluginDefinition$.pipe(
    map(def => isExternalPluginKey(def?.key))
  );

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly _buttonService: ProcessLinkButtonService,
    private readonly _injector: Injector,
    private readonly _pluginManagementService: PluginManagementService,
    private readonly _pluginService: PluginService,
    private readonly _stateService: PluginStateService,
    private readonly _stepService: ProcessLinkStepService,
    private readonly _processLinkStateService: ProcessLinkStateService,
    private readonly _externalPluginService: ExternalPluginService
  ) {}

  public ngOnInit(): void {
    this._openBackButtonSubscription();
    this._openNextButtonSubscription();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  /**
   * Whether an external plugin action may be linked to the activity currently being configured. An
   * action with no declared `activityTypes` is always shown. Otherwise it is shown when the current
   * activity matches one of its declared types, or when none of its declared types are recognised
   * (so an incomplete {@link ACTIVITY_TYPE_NAME_TO_VALUE} never hides a valid action).
   */
  private _actionSupportsActivity(action: ExternalPluginAction, activityType?: string): boolean {
    const declaredTypes = action.activityTypes;
    if (!activityType || !declaredTypes?.length) return true;

    const supportedValues = declaredTypes
      .map(name => ACTIVITY_TYPE_NAME_TO_VALUE[name])
      .filter((value): value is string => !!value);

    return supportedValues.length === 0 || supportedValues.includes(activityType);
  }

  public selectFunction(pluginFunction: PluginFunction): void {
    this._stateService.selectPluginFunction(pluginFunction);
  }

  public selected(event: {value: string}): void {
    this.selectFunction(JSON.parse(event.value));
    this._buttonService.enableNextButton();
  }

  public stringify(object: object): string {
    return JSON.stringify(object);
  }

  private _openBackButtonSubscription(): void {
    this._buttonService.backButtonClick$
      .pipe(
        withLatestFrom(this._processLinkStateService.isEditing$),
        filter(([, isEditing]) => !isEditing),
        switchMap(() => this._stepService.hasOneProcessLinkType$),
        take(1)
      )
      .subscribe((hasOneOption: boolean) => {
        this._stepService.setProcessLinkTypeSteps('plugin', hasOneOption);
      });
  }

  private _openNextButtonSubscription(): void {
    this._subscriptions.add(
      this._buttonService.nextButtonClick$
        .pipe(
          withLatestFrom(this._processLinkStateService.isEditing$),
          filter(([, isEditing]) => !isEditing)
        )
        .subscribe(() => {
          this._stepService.setConfigurePluginActionSteps();
        })
    );
  }
}
