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

import {Injectable} from '@angular/core';
import {Step} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, filter, map, Observable} from 'rxjs';
import {ProcessLinkConfigurationStep, ProcessLinkType} from '../models';
import {TranslateService} from '@ngx-translate/core';
import {ProcessLinkButtonService} from './process-link-button.service';
import {take} from 'rxjs/operators';
import {PluginStateService} from './plugin-state.service';
import {
  isExternalPluginKey,
  PluginConfiguration,
  PluginDefinition,
  PluginTranslationService,
} from '@valtimo/plugin';
import {ManagementContext} from '@valtimo/shared';

@Injectable()
export class ProcessLinkStepService {
  private readonly _steps$ = new BehaviorSubject<Array<Step>>(undefined);
  private readonly _currentStepIndex$ = new BehaviorSubject<number>(0);
  private readonly _disableSteps$ = new BehaviorSubject<boolean>(false);
  private readonly _hasOneProcessLinkType$ = new BehaviorSubject<boolean>(false);
  private readonly _skipBuildingBlockSelectionStep$ = new BehaviorSubject<boolean>(false);
  private _context: ManagementContext = 'independent';

  public get steps$(): Observable<Array<Step>> {
    return combineLatest([
      this._steps$,
      this._disableSteps$,
      this.translateService.stream('key'),
    ]).pipe(
      filter(([steps]) => !!steps),
      map(([steps, disableSteps]) =>
        steps.map(step => ({
          ...step,
          disabled: disableSteps,
          label: this.translateService.instant(`processLinkSteps.${step.label}`),
          ...(step.secondaryLabel && {
            secondaryLabel: this.translateService.instant(step.secondaryLabel),
          }),
        }))
      )
    );
  }

  public get currentStepIndex$(): Observable<number> {
    return this._currentStepIndex$.asObservable();
  }

  public get currentStepId$(): Observable<ProcessLinkConfigurationStep | ''> {
    return combineLatest([this._steps$, this.currentStepIndex$]).pipe(
      filter(([steps, currentStepIndex]) => !!steps && typeof currentStepIndex === 'number'),
      map(([steps, currentStepIndex]) =>
        steps.length > 0 ? (steps[currentStepIndex]?.label as ProcessLinkConfigurationStep) : ''
      )
    );
  }

  public get hasOneProcessLinkType$(): Observable<boolean> {
    return this._hasOneProcessLinkType$.asObservable();
  }

  public get skipBuildingBlockSelectionStep$(): Observable<boolean> {
    return this._skipBuildingBlockSelectionStep$.asObservable();
  }

  constructor(
    private readonly translateService: TranslateService,
    private readonly buttonService: ProcessLinkButtonService,
    private readonly pluginStateService: PluginStateService,
    private readonly pluginTranslateService: PluginTranslationService
  ) {}

  public reset(): void {
    this._currentStepIndex$.next(0);
    this._steps$.next([]);
    this._skipBuildingBlockSelectionStep$.next(false);
  }

  public setInitialSteps(availableProcessLinkTypes: Array<ProcessLinkType>): void {
    if (availableProcessLinkTypes.length > 1) {
      this.setChoiceSteps();
    }
  }

  public setFormSteps(): void {
    this._steps$.next([
      {label: 'chooseProcessLinkType', secondaryLabel: 'processLinkType.form'},
      {label: 'selectForm'},
    ]);
    this._currentStepIndex$.next(1);
  }

  public setSingleFormStep(): void {
    this._steps$.next([{label: 'selectForm'}]);
    this._currentStepIndex$.next(0);
  }

  public setUIComponentStep(): void {
    this._steps$.next([
      {label: 'chooseProcessLinkType', secondaryLabel: 'processLinkType.ui-component'},
      {label: 'uiComponent'},
    ]);
    this._currentStepIndex$.next(1);
  }

  public setFormFlowSteps(): void {
    this._steps$.next([
      {label: 'chooseProcessLinkType', secondaryLabel: 'processLinkType.form-flow'},
      {label: 'selectFormFlow'},
    ]);
    this._currentStepIndex$.next(1);
  }

  public setSingleFormFlowStep(): void {
    this._steps$.next([{label: 'selectFormFlow'}]);
    this._currentStepIndex$.next(0);
  }

  public setChoosePluginConfigurationSteps(): void {
    const selectionLabel = this.selectionStepLabel;
    this._steps$.next([
      {label: 'chooseProcessLinkType', secondaryLabel: 'processLinkType.plugin'},
      {label: selectionLabel},
      {label: 'choosePluginAction', disabled: true},
      {label: 'configurePluginAction', disabled: true},
    ]);
    this._currentStepIndex$.next(1);
  }

  public setSingleChoosePluginConfigurationSteps(): void {
    const selectionLabel = this.selectionStepLabel;
    this._steps$.next([
      {label: selectionLabel},
      {label: 'choosePluginAction', disabled: true},
      {label: 'configurePluginAction', disabled: true},
    ]);
    this._currentStepIndex$.next(0);
  }

  public setChoosePluginActionSteps(): void {
    combineLatest([
      this._hasOneProcessLinkType$,
      this.pluginStateService.selectedPluginConfiguration$,
      this.pluginStateService.selectedPluginDefinition$,
    ])
      .pipe(take(1))
      .subscribe(([hasOneType, selectedConfiguration, selectedDefinition]) => {
        const selectionLabel = this.selectionStepLabel;
        const selectedPluginLabel = this.getSelectedPluginLabel(
          selectedConfiguration,
          selectedDefinition
        );
        if (hasOneType) {
          this._steps$.next([
            {label: selectionLabel, secondaryLabel: selectedPluginLabel},
            {label: 'choosePluginAction'},
            {label: 'configurePluginAction', disabled: true},
          ]);
          this._currentStepIndex$.next(1);
          this.buttonService.showNextButton();
          this.buttonService.showBackButton();
          this.buttonService.hideSaveButton();
          this.buttonService.disableNextButton();
        } else {
          this._steps$.next([
            {label: 'chooseProcessLinkType', secondaryLabel: 'processLinkType.plugin'},
            {label: selectionLabel, secondaryLabel: selectedPluginLabel},
            {label: 'choosePluginAction'},
            {label: 'configurePluginAction', disabled: true},
          ]);
          this._currentStepIndex$.next(2);
          this.buttonService.showNextButton();
          this.buttonService.showBackButton();

          this.buttonService.hideSaveButton();
          this.buttonService.disableNextButton();
        }
      });
  }

  public setConfigurePluginActionSteps(): void {
    combineLatest([
      this._hasOneProcessLinkType$,
      this.pluginStateService.selectedPluginConfiguration$,
      this.pluginStateService.selectedPluginFunction$,
      this.pluginStateService.selectedPluginDefinition$,
    ])
      .pipe(take(1))
      .subscribe(([hasOneType, selectedConfiguration, selectedFunction, selectedDefinition]) => {
        const pluginKey =
          selectedDefinition?.key || selectedConfiguration?.pluginDefinition?.key || '';
        const isExternal = isExternalPluginKey(pluginKey);
        // External plugin actions/forms have no plugin-translation bundle — their display name comes
        // from the manifest and is already carried on the selected function's `title`. Using the
        // translate lookup here would render the raw `{externalKey}.{key}` fallback.
        const selectedFunctionTranslation = isExternal
          ? selectedFunction.title || selectedFunction.key
          : pluginKey
            ? this.pluginTranslateService.instant(selectedFunction.key, pluginKey)
            : selectedFunction.key;
        const selectionLabel = this.selectionStepLabel;
        const selectedPluginLabel = this.getSelectedPluginLabel(
          selectedConfiguration,
          selectedDefinition
        );
        // Only an external action that declares its `outputs` in the manifest offers the dedicated
        // output-mapping step — embedded actions have no declaration mechanism and never show it.
        const hasResultMappingsStep = isExternal && (selectedFunction?.outputs?.length ?? 0) > 0;
        const configureActionStep = hasResultMappingsStep
          ? [
              {label: 'configurePluginAction'},
              {label: 'configurePluginActionResultMappings', disabled: true},
            ]
          : [{label: 'configurePluginAction'}];

        if (hasOneType) {
          this._steps$.next([
            {label: selectionLabel, secondaryLabel: selectedPluginLabel},
            {label: 'choosePluginAction', secondaryLabel: selectedFunctionTranslation},
            ...configureActionStep,
          ]);
          this._currentStepIndex$.next(2);
        } else {
          this._steps$.next([
            {label: 'chooseProcessLinkType', secondaryLabel: 'processLinkType.plugin'},
            {label: selectionLabel, secondaryLabel: selectedPluginLabel},
            {label: 'choosePluginAction', secondaryLabel: selectedFunctionTranslation},
            ...configureActionStep,
          ]);
          this._currentStepIndex$.next(3);
        }

        if (hasResultMappingsStep) {
          this.buttonService.showNextButton();
          this.buttonService.showBackButton();
          this.buttonService.hideSaveButton();
          this.buttonService.enableNextButton();
        } else {
          this.buttonService.hideNextButton();
          this.buttonService.showSaveButton();
        }
      });
  }

  public setConfigurePluginActionResultMappingsSteps(): void {
    combineLatest([
      this._hasOneProcessLinkType$,
      this.pluginStateService.selectedPluginConfiguration$,
      this.pluginStateService.selectedPluginFunction$,
      this.pluginStateService.selectedPluginDefinition$,
    ])
      .pipe(take(1))
      .subscribe(([hasOneType, selectedConfiguration, selectedFunction, selectedDefinition]) => {
        const pluginKey =
          selectedDefinition?.key || selectedConfiguration?.pluginDefinition?.key || '';
        const selectedFunctionTranslation = isExternalPluginKey(pluginKey)
          ? selectedFunction.title || selectedFunction.key
          : pluginKey
            ? this.pluginTranslateService.instant(selectedFunction.key, pluginKey)
            : selectedFunction.key;
        const selectionLabel = this.selectionStepLabel;
        const selectedPluginLabel = this.getSelectedPluginLabel(
          selectedConfiguration,
          selectedDefinition
        );
        const configureActionSteps = [
          {label: 'configurePluginAction'},
          {label: 'configurePluginActionResultMappings'},
        ];

        if (hasOneType) {
          this._steps$.next([
            {label: selectionLabel, secondaryLabel: selectedPluginLabel},
            {label: 'choosePluginAction', secondaryLabel: selectedFunctionTranslation},
            ...configureActionSteps,
          ]);
          this._currentStepIndex$.next(3);
        } else {
          this._steps$.next([
            {label: 'chooseProcessLinkType', secondaryLabel: 'processLinkType.plugin'},
            {label: selectionLabel, secondaryLabel: selectedPluginLabel},
            {label: 'choosePluginAction', secondaryLabel: selectedFunctionTranslation},
            ...configureActionSteps,
          ]);
          this._currentStepIndex$.next(4);
        }

        this.buttonService.hideNextButton();
        this.buttonService.showSaveButton();
        this.buttonService.showBackButton();
      });
  }

  public setBuildingBlockSteps(): void {
    this._hasOneProcessLinkType$.pipe(take(1)).subscribe(hasOneType => {
      this._steps$.next([
        {label: 'chooseProcessLinkType', secondaryLabel: 'processLinkType.building-block'},
        {label: 'selectBuildingBlock'},
        {label: 'configureBuildingBlockPlugins', disabled: true},
        {label: 'configureBuildingBlockMappings', disabled: true},
      ]);
      this._currentStepIndex$.next(hasOneType ? 0 : 1);
      this.buttonService.showBackButton();
      this.buttonService.showNextButton();
      this.buttonService.hideSaveButton();
      this.buttonService.disableNextButton();
    });
  }

  public setConfigureBuildingBlockPluginsStep(selectionLabel?: string): void {
    this._hasOneProcessLinkType$.pipe(take(1)).subscribe(hasOneType => {
      const skipSelection = this._skipBuildingBlockSelectionStep$.getValue();
      const {steps, targetIndex} = this.buildBuildingBlockSteps({
        hasOneType,
        skipSelection,
        selectionLabel,
        activeStep: 'configureBuildingBlockPlugins',
        disabledAfterActive: true,
      });

      this._steps$.next(steps);
      this._currentStepIndex$.next(targetIndex);
      this.buttonService.showNextButton();
      this.buttonService.hideSaveButton();
      this.buttonService.disableNextButton();
      if (skipSelection) {
        this.buttonService.hideBackButton();
      } else {
        this.buttonService.showBackButton();
      }
    });
  }

  public setConfigureBuildingBlockMappingsStep(selectionLabel?: string): void {
    this._hasOneProcessLinkType$.pipe(take(1)).subscribe(hasOneType => {
      const {steps, targetIndex} = this.buildBuildingBlockSteps({
        hasOneType,
        skipSelection: this._skipBuildingBlockSelectionStep$.getValue(),
        selectionLabel,
        activeStep: 'configureBuildingBlockMappings',
        disabledAfterActive: false,
      });

      this._steps$.next(steps);
      this._currentStepIndex$.next(targetIndex);
      this.buttonService.hideNextButton();
      this.buttonService.showSaveButton();
      this.buttonService.disableSaveButton();
      this.buttonService.showBackButton();
    });
  }

  public updateBuildingBlockSelectionStepLabel(label: string): void {
    const steps = this._steps$.getValue();
    if (!steps?.length) return;
    const updatedSteps = steps.map(step =>
      step.label === 'selectBuildingBlock' ? {...step, secondaryLabel: label} : step
    );
    this._steps$.next(updatedSteps);
  }

  public setURLSteps(): void {
    this._steps$.next([
      {label: 'chooseProcessLinkType', secondaryLabel: 'processLinkType.url'},
      {label: 'selectURL'},
    ]);
    this._currentStepIndex$.next(1);
  }

  public setSingleURLStep(): void {
    this._steps$.next([{label: 'selectURL'}]);
    this._currentStepIndex$.next(0);
  }

  public setExternalPluginSteps(): void {
    this._steps$.next([
      {label: 'chooseProcessLinkType', secondaryLabel: 'processLinkType.external_plugin'},
      {label: 'configureExternalPlugin'},
    ]);
    this._currentStepIndex$.next(1);
  }

  public setSingleExternalPluginStep(): void {
    this._steps$.next([{label: 'configureExternalPlugin'}]);
    this._currentStepIndex$.next(0);
  }

  public disableSteps(): void {
    this._disableSteps$.next(true);
  }

  public enableSteps(): void {
    this._disableSteps$.next(false);
  }

  public setHasOneProcessLinkType(hasOne: boolean): void {
    this._hasOneProcessLinkType$.next(hasOne);
  }

  public setProcessLinkTypeSteps(processLinkTypeId: string, hasOneOption?: boolean): void {
    switch (processLinkTypeId) {
      case 'form':
        if (hasOneOption) {
          this.setSingleFormStep();
          this.buttonService.hideBackButton();
        } else {
          this.setFormSteps();
          this.buttonService.showBackButton();
        }
        this.buttonService.showSaveButton();
        break;
      case 'form-flow':
        if (hasOneOption) {
          this.setSingleFormFlowStep();
          this.buttonService.hideSaveButton();
          this.buttonService.hideBackButton();
        } else {
          this.setFormFlowSteps();
          this.buttonService.showSaveButton();
          this.buttonService.showBackButton();
        }
        break;
      case 'plugin':
        if (hasOneOption) {
          this.setSingleChoosePluginConfigurationSteps();
          this.buttonService.hideBackButton();
          this.buttonService.showNextButton();
        } else {
          this.setChoosePluginConfigurationSteps();
          this.buttonService.showBackButton();
          this.buttonService.showNextButton();
        }
        break;
      case 'building-block':
        this.setBuildingBlockSteps();
        break;
      case 'url':
        if (hasOneOption) {
          this.setSingleURLStep();
          this.buttonService.hideBackButton();
          this.buttonService.showSaveButton();
        } else {
          this.setURLSteps();
          this.buttonService.showBackButton();
          this.buttonService.showSaveButton();
        }
        break;
      case 'ui-component':
        this.setUIComponentStep();
        this.buttonService.showBackButton();
        this.buttonService.showSaveButton();
        break;
      case 'external_plugin':
        if (hasOneOption) {
          this.setSingleExternalPluginStep();
          this.buttonService.hideBackButton();
        } else {
          this.setExternalPluginSteps();
          this.buttonService.showBackButton();
        }
        this.buttonService.showSaveButton();
        break;
    }
  }

  private buildBuildingBlockSteps(options: {
    hasOneType: boolean;
    skipSelection: boolean;
    selectionLabel?: string;
    activeStep: 'configureBuildingBlockPlugins' | 'configureBuildingBlockMappings';
    disabledAfterActive: boolean;
  }): {steps: Array<Step>; targetIndex: number} {
    const bbSteps: Array<Step> = [
      {label: 'configureBuildingBlockPlugins'},
      {label: 'configureBuildingBlockMappings'},
    ];

    const activeIdx = bbSteps.findIndex(s => s.label === options.activeStep);
    if (options.disabledAfterActive) {
      for (let i = activeIdx + 1; i < bbSteps.length; i++) {
        bbSteps[i] = {...bbSteps[i], disabled: true};
      }
    }

    const prefix: Array<Step> = [];
    if (!options.skipSelection) {
      if (!options.hasOneType) {
        prefix.push({
          label: 'chooseProcessLinkType',
          secondaryLabel: 'processLinkType.building-block',
        });
      }
      prefix.push({
        label: 'selectBuildingBlock',
        ...(options.selectionLabel && {secondaryLabel: options.selectionLabel}),
      });
    }

    const steps = [...prefix, ...bbSteps];
    const targetIndex = prefix.length + activeIdx;
    return {steps, targetIndex};
  }

  private setChoiceSteps(): void {
    this._steps$.next([
      {label: 'chooseProcessLinkType'},
      {label: 'empty', disabled: true},
      {label: 'empty', disabled: true},
    ]);
    this._currentStepIndex$.next(0);
  }

  /**
   * Step label for the plugin selection step. In the building-block context the admin picks a
   * plugin *definition* (the configuration is resolved at runtime from the BB's mappings), so the
   * step must be titled accordingly — everywhere else a concrete configuration is chosen.
   */
  private get selectionStepLabel(): string {
    return this._context === 'buildingBlock'
      ? 'choosePluginDefinition'
      : 'choosePluginConfiguration';
  }

  private getSelectedPluginLabel(
    selectedConfiguration: PluginConfiguration | undefined,
    selectedDefinition: PluginDefinition | undefined
  ): string {
    if (this._context === 'buildingBlock') {
      const definitionKey = selectedDefinition?.key || selectedConfiguration?.pluginDefinition?.key;
      // External definitions have no plugin-translation bundle — looking one up would render the
      // raw `external:<uuid>.title` key. Their localized display name comes from the manifest and
      // is carried on the (synthetic) definition's title.
      if (isExternalPluginKey(definitionKey)) {
        return selectedDefinition?.title || selectedConfiguration?.pluginDefinition?.title || '';
      }
      return definitionKey ? this.pluginTranslateService.instant('title', definitionKey) : '';
    }
    return selectedConfiguration?.title || '';
  }

  public setContext(context: ManagementContext): void {
    this._context = context;
  }

  public setSkipBuildingBlockSelectionStep(skip: boolean): void {
    this._skipBuildingBlockSelectionStep$.next(skip);
  }

  /**
   * Initialize steps for editing an existing process link.
   * Sets up configuration steps only (skipping type selection since type can't be changed).
   * Navigates to the final step.
   */
  public initializeEditModeSteps(processLinkType: string): void {
    switch (processLinkType) {
      case 'form':
        // Single step for form - just the form selection
        this._steps$.next([{label: 'selectForm'}]);
        this._currentStepIndex$.next(0);
        break;
      case 'form-flow':
        // Single step for form-flow - just the form flow selection
        this._steps$.next([{label: 'selectFormFlow'}]);
        this._currentStepIndex$.next(0);
        break;
      case 'plugin': {
        // Plugin has 3 config steps: select config, select action, configure action
        this._steps$.next([
          {label: this.selectionStepLabel},
          {label: 'choosePluginAction'},
          {label: 'configurePluginAction'},
        ]);
        this._currentStepIndex$.next(2); // Start at last step
        break;
      }
      case 'building-block': {
        const {steps: bbSteps, targetIndex: bbIndex} = this.buildBuildingBlockSteps({
          hasOneType: true,
          skipSelection: this._skipBuildingBlockSelectionStep$.getValue(),
          activeStep: 'configureBuildingBlockMappings',
          disabledAfterActive: false,
        });
        this._steps$.next(bbSteps);
        this._currentStepIndex$.next(bbIndex);
        break;
      }
      case 'external_plugin':
      case 'external_plugin_task_form':
        // Both external-plugin surfaces reuse the plugin wizard: select config, select action/form,
        // configure. A task-form's configure step has nothing to fill in (see the action-config
        // component), but the flow and step layout are identical.
        this._steps$.next([
          {label: this.selectionStepLabel},
          {label: 'choosePluginAction'},
          {label: 'configurePluginAction'},
        ]);
        this._currentStepIndex$.next(2); // Start at last step (configure action)
        break;
      case 'ui-component':
        // Single step for UI component
        this._steps$.next([{label: 'uiComponent'}]);
        this._currentStepIndex$.next(0);
        break;
      case 'url':
        // Single step for URL
        this._steps$.next([{label: 'selectURL'}]);
        this._currentStepIndex$.next(0);
        break;
    }
  }

  /**
   * Edit-mode variant of {@link initializeEditModeSteps} for an `external_plugin` link whose
   * selected action declares `outputs` — inserts the fourth `configurePluginActionResultMappings`
   * step, active, with Next shown (to reach it isn't needed, edit mode opens directly on it) and
   * Save hidden until the admin steps forward from the properties step.
   */
  public initializeEditModeResultMappingsSteps(): void {
    this._steps$.next([
      {label: this.selectionStepLabel},
      {label: 'choosePluginAction'},
      {label: 'configurePluginAction'},
      {label: 'configurePluginActionResultMappings'},
    ]);
    this._currentStepIndex$.next(2);
    this.buttonService.showNextButton();
    this.buttonService.hideSaveButton();
    this.buttonService.enableNextButton();
  }

  /**
   * Navigate to a specific step by index (for edit mode navigation)
   */
  public goToStep(stepIndex: number): void {
    const steps = this._steps$.getValue();
    if (steps && stepIndex >= 0 && stepIndex < steps.length) {
      this._currentStepIndex$.next(stepIndex);
    }
  }

  /**
   * Navigate to the previous step (for edit mode navigation)
   * Returns true if navigation was successful, false if already at first step
   */
  public goToPreviousStep(): boolean {
    const currentIndex = this._currentStepIndex$.getValue();
    if (currentIndex > 0) {
      this._currentStepIndex$.next(currentIndex - 1);
      return true;
    }
    return false;
  }

  /**
   * Navigate to the next step (for edit mode navigation)
   * Returns true if navigation was successful, false if already at last step
   */
  public goToNextStep(): boolean {
    const steps = this._steps$.getValue();
    const currentIndex = this._currentStepIndex$.getValue();
    if (steps && currentIndex < steps.length - 1) {
      this._currentStepIndex$.next(currentIndex + 1);
      return true;
    }
    return false;
  }

  /**
   * Check if currently at the first step
   */
  public isFirstStep(): boolean {
    return this._currentStepIndex$.getValue() === 0;
  }

  /**
   * Check if currently at the last step
   */
  public isLastStep(): boolean {
    const steps = this._steps$.getValue();
    const currentIndex = this._currentStepIndex$.getValue();
    return steps ? currentIndex === steps.length - 1 : false;
  }

  /**
   * Get the total number of steps
   */
  public getStepCount(): number {
    return this._steps$.getValue()?.length || 0;
  }

  /**
   * Get the current step index
   */
  public getCurrentStepIndex(): number {
    return this._currentStepIndex$.getValue();
  }
}
