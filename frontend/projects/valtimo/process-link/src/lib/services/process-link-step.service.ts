/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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
import {PluginConfiguration, PluginDefinition, PluginTranslationService} from '@valtimo/plugin';
import {ManagementContext} from '@valtimo/shared';

@Injectable({
  providedIn: 'root',
})
export class ProcessLinkStepService {
  private readonly _steps$ = new BehaviorSubject<Array<Step>>(undefined);
  private readonly _currentStepIndex$ = new BehaviorSubject<number>(0);
  private readonly _disableSteps$ = new BehaviorSubject<boolean>(false);
  private readonly _hasOneProcessLinkType$ = new BehaviorSubject<boolean>(false);
  private _context: ManagementContext = 'independent';

  get steps$(): Observable<Array<Step>> {
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

  get currentStepIndex$(): Observable<number> {
    return this._currentStepIndex$.asObservable();
  }

  get currentStepId$(): Observable<ProcessLinkConfigurationStep | ''> {
    return combineLatest([this._steps$, this.currentStepIndex$]).pipe(
      filter(([steps, currentStepIndex]) => !!steps && typeof currentStepIndex === 'number'),
      map(([steps, currentStepIndex]) =>
        steps.length > 0 ? (steps[currentStepIndex]?.label as ProcessLinkConfigurationStep) : ''
      )
    );
  }

  get hasOneProcessLinkType$(): Observable<boolean> {
    return this._hasOneProcessLinkType$.asObservable();
  }

  constructor(
    private readonly translateService: TranslateService,
    private readonly buttonService: ProcessLinkButtonService,
    private readonly pluginStateService: PluginStateService,
    private readonly pluginTranslateService: PluginTranslationService
  ) {}

  reset(): void {
    this._currentStepIndex$.next(0);
    this._steps$.next([]);
  }

  setInitialSteps(availableProcessLinkTypes: Array<ProcessLinkType>): void {
    if (availableProcessLinkTypes.length > 1) {
      this.setChoiceSteps();
    }
  }

  setFormSteps(): void {
    this._steps$.next([
      {label: 'chooseProcessLinkType', secondaryLabel: 'processLinkType.form'},
      {label: 'selectForm'},
    ]);
    this._currentStepIndex$.next(1);
  }

  setSingleFormStep(): void {
    this._steps$.next([{label: 'selectForm'}]);
    this._currentStepIndex$.next(0);
  }

  setUIComponentStep(): void {
    this._steps$.next([
      {label: 'chooseProcessLinkType', secondaryLabel: 'processLinkType.ui-component'},
      {label: 'uiComponent'},
    ]);
    this._currentStepIndex$.next(1);
  }

  setFormFlowSteps(): void {
    this._steps$.next([
      {label: 'chooseProcessLinkType', secondaryLabel: 'processLinkType.form-flow'},
      {label: 'selectFormFlow'},
    ]);
    this._currentStepIndex$.next(1);
  }

  setSingleFormFlowStep(): void {
    this._steps$.next([{label: 'selectFormFlow'}]);
    this._currentStepIndex$.next(0);
  }

  setChoosePluginConfigurationSteps(): void {
    const selectionLabel =
      this._context === 'buildingBlock' ? 'choosePluginDefinition' : 'choosePluginConfiguration';
    this._steps$.next([
      {label: 'chooseProcessLinkType', secondaryLabel: 'processLinkType.plugin'},
      {label: selectionLabel},
      {label: 'choosePluginAction', disabled: true},
      {label: 'configurePluginAction', disabled: true},
    ]);
    this._currentStepIndex$.next(1);
  }

  setSingleChoosePluginConfigurationSteps(): void {
    const selectionLabel =
      this._context === 'buildingBlock' ? 'choosePluginDefinition' : 'choosePluginConfiguration';
    this._steps$.next([
      {label: selectionLabel},
      {label: 'choosePluginAction', disabled: true},
      {label: 'configurePluginAction', disabled: true},
    ]);
    this._currentStepIndex$.next(0);
  }

  setChoosePluginActionSteps(): void {
    combineLatest([
      this._hasOneProcessLinkType$,
      this.pluginStateService.selectedPluginConfiguration$,
      this.pluginStateService.selectedPluginDefinition$,
    ])
      .pipe(take(1))
      .subscribe(([hasOneType, selectedConfiguration, selectedDefinition]) => {
        const selectionLabel =
          this._context === 'buildingBlock'
            ? 'choosePluginDefinition'
            : 'choosePluginConfiguration';
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

  setConfigurePluginActionSteps(): void {
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
        const selectedFunctionTranslation = pluginKey
          ? this.pluginTranslateService.instant(selectedFunction.key, pluginKey)
          : selectedFunction.key;
        const selectionLabel =
          this._context === 'buildingBlock'
            ? 'choosePluginDefinition'
            : 'choosePluginConfiguration';
        const selectedPluginLabel = this.getSelectedPluginLabel(
          selectedConfiguration,
          selectedDefinition
        );

        if (hasOneType) {
          this._steps$.next([
            {label: selectionLabel, secondaryLabel: selectedPluginLabel},
            {label: 'choosePluginAction', secondaryLabel: selectedFunctionTranslation},
            {label: 'configurePluginAction'},
          ]);
          this._currentStepIndex$.next(2);
          this.buttonService.hideNextButton();
          this.buttonService.showSaveButton();
        } else {
          this._steps$.next([
            {label: 'chooseProcessLinkType', secondaryLabel: 'processLinkType.plugin'},
            {label: selectionLabel, secondaryLabel: selectedPluginLabel},
            {label: 'choosePluginAction', secondaryLabel: selectedFunctionTranslation},
            {label: 'configurePluginAction'},
          ]);
          this._currentStepIndex$.next(3);
          this.buttonService.hideNextButton();
          this.buttonService.showSaveButton();
        }
      });
  }

  setBuildingBlockSteps(): void {
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

  setConfigureBuildingBlockPluginsStep(selectionLabel?: string): void {
    this._hasOneProcessLinkType$.pipe(take(1)).subscribe(hasOneType => {
      const steps = hasOneType
        ? [
            {label: 'selectBuildingBlock', secondaryLabel: selectionLabel},
            {label: 'configureBuildingBlockPlugins'},
            {label: 'configureBuildingBlockMappings', disabled: true},
          ]
        : [
            {label: 'chooseProcessLinkType', secondaryLabel: 'processLinkType.building-block'},
            {label: 'selectBuildingBlock', secondaryLabel: selectionLabel},
            {label: 'configureBuildingBlockPlugins'},
            {label: 'configureBuildingBlockMappings', disabled: true},
          ];

      this._steps$.next(steps);
      this._currentStepIndex$.next(hasOneType ? 1 : 2);
      this.buttonService.showNextButton();
      this.buttonService.hideSaveButton();
      this.buttonService.disableNextButton();
      this.buttonService.showBackButton();
    });
  }

  setConfigureBuildingBlockMappingsStep(selectionLabel?: string): void {
    this._hasOneProcessLinkType$.pipe(take(1)).subscribe(hasOneType => {
      const steps = hasOneType
        ? [
            {label: 'selectBuildingBlock', secondaryLabel: selectionLabel},
            {label: 'configureBuildingBlockPlugins'},
            {label: 'configureBuildingBlockMappings'},
          ]
        : [
            {label: 'chooseProcessLinkType', secondaryLabel: 'processLinkType.building-block'},
            {label: 'selectBuildingBlock', secondaryLabel: selectionLabel},
            {label: 'configureBuildingBlockPlugins'},
            {label: 'configureBuildingBlockMappings'},
          ];

      this._steps$.next(steps);
      this._currentStepIndex$.next(hasOneType ? 2 : 3);
      this.buttonService.hideNextButton();
      this.buttonService.showSaveButton();
      this.buttonService.disableSaveButton();
      this.buttonService.showBackButton();
    });
  }

  updateBuildingBlockSelectionStepLabel(label: string): void {
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

  disableSteps(): void {
    this._disableSteps$.next(true);
  }

  enableSteps(): void {
    this._disableSteps$.next(false);
  }

  setHasOneProcessLinkType(hasOne: boolean): void {
    this._hasOneProcessLinkType$.next(hasOne);
  }

  setProcessLinkTypeSteps(processLinkTypeId: string, hasOneOption?: boolean): void {
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
    }
  }

  private setChoiceSteps(): void {
    this._steps$.next([
      {label: 'chooseProcessLinkType'},
      {label: 'empty', disabled: true},
      {label: 'empty', disabled: true},
    ]);
    this._currentStepIndex$.next(0);
  }

  private getSelectedPluginLabel(
    selectedConfiguration: PluginConfiguration | undefined,
    selectedDefinition: PluginDefinition | undefined
  ): string {
    if (this._context === 'buildingBlock') {
      const definitionKey = selectedDefinition?.key || selectedConfiguration?.pluginDefinition?.key;
      return definitionKey ? this.pluginTranslateService.instant('title', definitionKey) : '';
    }
    return selectedConfiguration?.title || '';
  }

  public setContext(context: ManagementContext): void {
    this._context = context;
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
      case 'plugin':
        const selectionLabel =
          this._context === 'buildingBlock' ? 'choosePluginDefinition' : 'choosePluginConfiguration';
        // Plugin has 3 config steps: select config, select action, configure action
        this._steps$.next([
          {label: selectionLabel},
          {label: 'choosePluginAction'},
          {label: 'configurePluginAction'},
        ]);
        this._currentStepIndex$.next(2); // Start at last step
        break;
      case 'building-block':
        // Building block has 3 config steps: select BB, configure plugins, configure mappings
        this._steps$.next([
          {label: 'selectBuildingBlock'},
          {label: 'configureBuildingBlockPlugins'},
          {label: 'configureBuildingBlockMappings'},
        ]);
        this._currentStepIndex$.next(2); // Start at last step
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
