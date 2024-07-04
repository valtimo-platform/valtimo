/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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
import {PluginTranslationService} from '@valtimo/plugin';

@Injectable()
export class ProcessLinkStepService {
  private readonly _steps$ = new BehaviorSubject<Array<Step>>(undefined);
  private readonly _currentStepIndex$ = new BehaviorSubject<number>(0);
  private readonly _disableSteps$ = new BehaviorSubject<boolean>(false);
  private readonly _hasOneProcessLinkType$ = new BehaviorSubject<boolean>(false);

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
    this._steps$.next([
      {label: 'chooseProcessLinkType', secondaryLabel: 'processLinkType.plugin'},
      {label: 'choosePluginConfiguration'},
      {label: 'choosePluginAction', disabled: true},
      {label: 'configurePluginAction', disabled: true},
    ]);
    this._currentStepIndex$.next(1);
  }

  setSingleChoosePluginConfigurationSteps(): void {
    this._steps$.next([
      {label: 'choosePluginConfiguration'},
      {label: 'choosePluginAction', disabled: true},
      {label: 'configurePluginAction', disabled: true},
    ]);
    this._currentStepIndex$.next(0);
  }

  setChoosePluginActionSteps(): void {
    combineLatest([
      this._hasOneProcessLinkType$,
      this.pluginStateService.selectedPluginConfiguration$,
    ])
      .pipe(take(1))
      .subscribe(([hasOneType, selectedConfiguration]) => {
        if (hasOneType) {
          this._steps$.next([
            {label: 'choosePluginConfiguration', secondaryLabel: selectedConfiguration.title},
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
            {label: 'choosePluginConfiguration', secondaryLabel: selectedConfiguration.title},
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
    ])
      .pipe(take(1))
      .subscribe(([hasOneType, selectedConfiguration, selectedFunction]) => {
        const selectedFunctionTranslation = this.pluginTranslateService.instant(
          selectedFunction.key,
          selectedConfiguration.pluginDefinition.key
        );

        if (hasOneType) {
          this._steps$.next([
            {label: 'choosePluginConfiguration', secondaryLabel: selectedConfiguration.title},
            {label: 'choosePluginAction', secondaryLabel: selectedFunctionTranslation},
            {label: 'configurePluginAction'},
          ]);
          this._currentStepIndex$.next(2);
          this.buttonService.hideNextButton();
          this.buttonService.showSaveButton();
        } else {
          this._steps$.next([
            {label: 'chooseProcessLinkType', secondaryLabel: 'processLinkType.plugin'},
            {label: 'choosePluginConfiguration', secondaryLabel: selectedConfiguration.title},
            {label: 'choosePluginAction', secondaryLabel: selectedFunctionTranslation},
            {label: 'configurePluginAction'},
          ]);
          this._currentStepIndex$.next(3);
          this.buttonService.hideNextButton();
          this.buttonService.showSaveButton();
        }
      });
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
          this.buttonService.hideSaveButton();
          this.buttonService.hideBackButton();
        } else {
          this.setFormSteps();
          this.buttonService.showSaveButton();
          this.buttonService.showBackButton();
        }
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
}
