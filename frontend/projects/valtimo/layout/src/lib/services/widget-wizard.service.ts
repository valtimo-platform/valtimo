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
import {computed, Injectable, Signal, signal, WritableSignal} from '@angular/core';

import {
  BasicWidget,
  WidgetAction,
  WidgetContentProperties,
  WidgetContext,
  WidgetDensity,
  WidgetStyle,
  WidgetType,
  WidgetTypeSelection,
  WidgetWidth,
  WidgetWizardStep,
} from '../models';
import {Condition} from '@valtimo/shared';
import {CARBON_CONSTANTS} from '@valtimo/components';

@Injectable({
  providedIn: 'root',
})
export class WidgetWizardService {
  public readonly $currentStepIndex: WritableSignal<number> = signal(0);

  public readonly $currentStep: WritableSignal<WidgetWizardStep> = signal(WidgetWizardStep.TYPE);

  public readonly $selectedWidget: WritableSignal<WidgetTypeSelection | null> = signal(null);

  public readonly $widgetWidth: WritableSignal<WidgetWidth | null> = signal(null);

  public readonly $widgetStyle: WritableSignal<WidgetStyle | null> = signal(null);

  public readonly $widgetDensity: WritableSignal<WidgetDensity | null> = signal(null);

  public readonly $widgetContent: WritableSignal<WidgetContentProperties | null> = signal(null);

  public readonly $widgetDisplayConditions: WritableSignal<Array<Condition> | null> = signal(null);

  public readonly $widgetTitle: WritableSignal<string | null> = signal(null);

  public readonly $widgetIcon: WritableSignal<string | null> = signal(null);

  public readonly $widgetKey: WritableSignal<string | null> = signal(null);

  public readonly $widgetActions: WritableSignal<WidgetAction[] | undefined> = signal(undefined);

  public readonly $widgetContext: WritableSignal<WidgetContext | null> = signal(null);

  public readonly $widgetContentValid: WritableSignal<boolean> = signal(false);

  public readonly $widgetConditionsValid: WritableSignal<boolean> = signal(false);

  public readonly $widgetFiltersValid: WritableSignal<boolean> = signal(false);

  public readonly $disableTitleInput: WritableSignal<boolean> = signal(false);

  public readonly $disableActionButton: WritableSignal<boolean> = signal(false);

  public readonly $widgetWizardSteps: WritableSignal<WidgetWizardStep[]> = signal([
    WidgetWizardStep.TYPE,
    WidgetWizardStep.WIDTH,
    WidgetWizardStep.DENSITY,
    WidgetWizardStep.STYLE,
    WidgetWizardStep.CONTENT,
    WidgetWizardStep.FILTERS,
    WidgetWizardStep.DISPLAY_CONDITIONS,
  ]);

  public readonly $editMode: WritableSignal<boolean> = signal(false);

  private readonly _$stepCompleteCondition: Signal<Record<WidgetWizardStep, boolean>> = computed(
    () => ({
      [WidgetWizardStep.TYPE]: !!this.$selectedWidget()?.type,
      [WidgetWizardStep.WIDTH]: !!this.$widgetWidth(),
      [WidgetWizardStep.DENSITY]: this.$widgetDensity() !== null,
      [WidgetWizardStep.STYLE]: !!this.$widgetStyle(),
      [WidgetWizardStep.CONTENT]:
        !!this.$widgetContent() &&
        this.$widgetContentValid() &&
        (!!this.$widgetTitle() || this.$disableTitleInput()),
      [WidgetWizardStep.FILTERS]: this.$widgetFiltersValid(),
      [WidgetWizardStep.DISPLAY_CONDITIONS]: this.$widgetConditionsValid(),
    })
  );

  public readonly $widgetWizardStepEnableCondition: Signal<
    Record<any, {dependingStep: WidgetWizardStep; condition: () => boolean}>
  > = computed(() => ({
    [WidgetWizardStep.DENSITY]: {
      dependingStep: WidgetWizardStep.TYPE,
      condition: () => {
        const selectedType = this.$selectedWidget()?.type;
        return !selectedType
          ? false
          : [WidgetType.COLLECTION, WidgetType.FIELDS, WidgetType.TABLE].includes(selectedType);
      },
    },
    [WidgetWizardStep.FILTERS]: {
      dependingStep: WidgetWizardStep.TYPE,
      condition: () => this.$selectedWidget()?.type === WidgetType.INTERACTIVE_TABLE,
    },
  }));

  public readonly $widgetWizardStepProperties: Signal<
    Record<Partial<WidgetWizardStep>, {disabled: boolean; complete: boolean}>
  > = computed(() => {
    const enabledConditions = this.$widgetWizardStepEnableCondition();
    const completeConditions = this._$stepCompleteCondition();
    const isEditMode = this.$editMode();
    const steps = this.$widgetWizardSteps().filter(
      step => enabledConditions[step]?.condition() ?? true
    );

    return steps.reduce(
      (acc, step, index) => ({
        ...acc,
        [step]: {
          disabled:
            (isEditMode && index === 0) ||
            (!isEditMode && index > 0 && !completeConditions[steps[index - 1]]),
          complete: !!completeConditions[step] || isEditMode,
        },
      }),
      {} as Record<Partial<WidgetWizardStep>, {disabled: boolean; complete: boolean}>
    );
  });

  public readonly $nextButtonDisabled = computed(
    () => !this._$stepCompleteCondition()[this.$currentStep()]
  );

  private _defaultWidth!: WidgetWidth | null;

  public get defaultWidth(): WidgetWidth | null {
    return this._defaultWidth;
  }

  public readonly $widgetsConfig: Signal<BasicWidget> = computed(() => ({
    key: this.$widgetKey() ?? '',
    title: this.$widgetTitle() ?? '',
    icon: this.$widgetIcon() ?? '',
    type: this.$selectedWidget()?.type ?? WidgetType.FIELDS,
    width: this.$widgetWidth() || this._defaultWidth || 4,
    highContrast: (this.$widgetStyle() ?? WidgetStyle.DEFAULT) === WidgetStyle.HIGH_CONTRAST,
    isCompact: this.$widgetDensity() === WidgetDensity.COMPACT,
    properties: this.$widgetContent() ?? ({} as any),
    actions: this.$widgetActions() ?? [],
    displayConditions: this.$widgetDisplayConditions() ?? [],
  }));

  public readonly $usedWidgetKeys: WritableSignal<string[]> = signal([]);

  public readonly $availableWidgetTypes: WritableSignal<WidgetType[] | null> = signal(null);

  public resetWizard(): void {
    setTimeout(() => {
      this.$currentStepIndex.set(0);
      this.$currentStep.set(WidgetWizardStep.TYPE);
      this.$selectedWidget.set(null);
      this.$widgetWidth.set(this._defaultWidth || null);
      this.$widgetStyle.set(null);
      this.$widgetContent.set(null);
      this.$widgetTitle.set(null);
      this.$widgetIcon.set(null);
      this.$widgetKey.set(null);
      this.$widgetActions.set(undefined);
      this.$widgetDisplayConditions.set(null);
      this.$widgetFiltersValid.set(false);
      this.$editMode.set(false);
      this.$widgetDensity.set(null);
      this.$disableActionButton.set(false);
      this.$disableTitleInput.set(false);
    }, CARBON_CONSTANTS.modalAnimationMs);
  }

  public resetWizardSteps(): void {
    this.$widgetWizardSteps.set([
      WidgetWizardStep.TYPE,
      WidgetWizardStep.WIDTH,
      WidgetWizardStep.DENSITY,
      WidgetWizardStep.STYLE,
      WidgetWizardStep.CONTENT,
      WidgetWizardStep.FILTERS,
      WidgetWizardStep.DISPLAY_CONDITIONS,
    ]);
  }

  public setDefaultWidth(width: number | null): void {
    if (!this.isWidgetWidth(width)) return;
    this._defaultWidth = width;
    this.$widgetWidth.set(this._defaultWidth);
  }

  private isWidgetWidth(value: number | null): value is WidgetWidth | null {
    return [1, 2, 3, 4, null].includes(value as number);
  }
}
