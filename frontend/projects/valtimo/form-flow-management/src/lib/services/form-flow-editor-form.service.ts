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
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import {FormFlowRegistryDto} from '@valtimo/shared';
import {FormFlowDefinition, FormFlowNextStep, FormFlowStep} from '../models';

/**
 * Builds and reads the reactive form tree that backs the visual form flow editor.
 *
 * The form mirrors the definition JSON: a `startStep` control and a `steps` array where every step
 * has its key, title, type (name plus a dynamic properties group driven by the registry),
 * transitions and the three expression lists. Serialization produces the same JSON contract the
 * JSON editor tab emits, so both tabs are interchangeable to the surrounding editor page.
 */
@Injectable()
export class FormFlowEditorFormService {
  constructor(private readonly fb: FormBuilder) {}

  public buildDefinitionForm(
    definition: FormFlowDefinition,
    registry: FormFlowRegistryDto
  ): FormGroup {
    return this.fb.group(
      {
        startStep: this.fb.control(definition.startStep ?? '', Validators.required),
        steps: this.fb.array(
          (definition.steps ?? []).map(step => this.buildStepGroup(step, registry)),
          [uniqueStepKeysValidator]
        ),
      },
      {validators: [startStepExistsValidator, transitionTargetsExistValidator]}
    );
  }

  public buildStepGroup(step: FormFlowStep, registry: FormFlowRegistryDto): FormGroup {
    const typeName = step.type?.name ?? '';
    // The legacy single `nextStep` field is normalized into a `nextSteps` transition, mirroring
    // how the backend interprets it.
    const transitions =
      step.nextSteps ?? (step.nextStep ? [{step: step.nextStep} as FormFlowNextStep] : []);

    return this.fb.group({
      key: this.fb.control(step.key ?? '', Validators.required),
      title: this.fb.control(step.title ?? ''),
      typeName: this.fb.control(typeName, Validators.required),
      properties: this.buildPropertiesGroup(
        typeName,
        (step.type?.properties ?? {}) as Record<string, string>,
        registry
      ),
      nextSteps: this.fb.array(
        transitions.map(transition => this.buildTransitionGroup(transition)),
        [singleDefaultTransitionValidator]
      ),
      onOpen: this.buildExpressionArray(step.onOpen),
      onComplete: this.buildExpressionArray(step.onComplete),
      onBack: this.buildExpressionArray(step.onBack),
    });
  }

  public buildNewStepGroup(existingKeys: string[], registry: FormFlowRegistryDto): FormGroup {
    const defaultType =
      registry.stepTypes.find(stepType => stepType.name === 'form')?.name ??
      registry.stepTypes[0]?.name ??
      'form';

    return this.buildStepGroup(
      {
        key: this.generateStepKey(existingKeys),
        type: {name: defaultType, properties: {}},
        nextSteps: [],
      },
      registry
    );
  }

  /**
   * Builds the dynamic properties group for a step type. Known types get one required control per
   * registry property; unknown (custom) types keep controls for whatever properties the loaded
   * definition already contained. Values for properties that exist in both the old and the new
   * type are preserved.
   */
  public buildPropertiesGroup(
    typeName: string,
    currentProperties: Record<string, string>,
    registry: FormFlowRegistryDto
  ): FormGroup {
    const registryStepType = registry.stepTypes.find(stepType => stepType.name === typeName);
    const propertyNames = registryStepType
      ? registryStepType.properties.map(property => property.name)
      : Object.keys(currentProperties);

    return this.fb.group(
      Object.fromEntries(
        propertyNames.map(name => [
          name,
          this.fb.control(currentProperties[name] ?? '', Validators.required),
        ])
      )
    );
  }

  public buildTransitionGroup(transition?: FormFlowNextStep): FormGroup {
    return this.fb.group({
      step: this.fb.control(transition?.step ?? '', Validators.required),
      condition: this.fb.control(transition?.condition ?? ''),
    });
  }

  public buildExpressionControl(expression = ''): FormControl {
    return this.fb.control(expression, Validators.required);
  }

  public serialize(form: FormGroup, definitionKey: string): FormFlowDefinition {
    const value = form.getRawValue();

    return {
      key: definitionKey,
      startStep: value.startStep,
      steps: (value.steps as StepFormValue[]).map(step => ({
        key: step.key,
        ...(step.title?.trim() ? {title: step.title.trim()} : {}),
        type: {
          name: step.typeName,
          properties: step.properties,
        },
        nextSteps: step.nextSteps.map(transition => ({
          step: transition.step,
          ...(transition.condition?.trim() ? {condition: transition.condition.trim()} : {}),
        })),
        onBack: step.onBack,
        onOpen: step.onOpen,
        onComplete: step.onComplete,
      })),
    };
  }

  /**
   * Rewrites every reference to a renamed step key: the start step and all transition targets.
   * Used while the user types a new key, so the definition stays internally consistent.
   */
  public renameStepReferences(form: FormGroup, oldKey: string, newKey: string): void {
    if (!oldKey || oldKey === newKey) return;

    const startStepControl = form.get('startStep');
    if (startStepControl?.value === oldKey) {
      startStepControl.setValue(newKey, {emitEvent: false});
    }

    this.getStepsArray(form).controls.forEach(stepGroup => {
      (stepGroup.get('nextSteps') as FormArray).controls.forEach(transitionGroup => {
        const stepControl = transitionGroup.get('step');
        if (stepControl?.value === oldKey) {
          stepControl.setValue(newKey, {emitEvent: false});
        }
      });
    });
  }

  public getStepsArray(form: FormGroup): FormArray {
    return form.get('steps') as FormArray;
  }

  private buildExpressionArray(expressions: string[] | undefined): FormArray {
    return this.fb.array(
      (expressions ?? []).map(expression => this.buildExpressionControl(expression))
    );
  }

  private generateStepKey(existingKeys: string[]): string {
    let index = existingKeys.length + 1;
    while (existingKeys.includes(`step-${index}`)) {
      index++;
    }

    return `step-${index}`;
  }
}

interface StepFormValue {
  key: string;
  title: string;
  typeName: string;
  properties: Record<string, string>;
  nextSteps: Array<{step: string; condition: string}>;
  onOpen: string[];
  onComplete: string[];
  onBack: string[];
}

/** Marks duplicated step keys invalid on the `steps` array. */
const uniqueStepKeysValidator: ValidatorFn = (
  control: AbstractControl
): ValidationErrors | null => {
  const keys = (control as FormArray).controls
    .map(stepGroup => (stepGroup.get('key')?.value ?? '').trim())
    .filter(key => key !== '');
  const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);

  return duplicates.length ? {duplicateStepKeys: {keys: [...new Set(duplicates)]}} : null;
};

/** The configured start step must reference an existing step. */
const startStepExistsValidator: ValidatorFn = (
  control: AbstractControl
): ValidationErrors | null => {
  const startStep = control.get('startStep')?.value;
  if (!startStep) return null;

  const keys = (control.get('steps') as FormArray).controls.map(
    stepGroup => stepGroup.get('key')?.value
  );

  return keys.includes(startStep) ? null : {startStepMissing: {startStep}};
};

/** Every transition must point to an existing step. */
const transitionTargetsExistValidator: ValidatorFn = (
  control: AbstractControl
): ValidationErrors | null => {
  const steps = (control.get('steps') as FormArray).controls;
  const keys = steps.map(stepGroup => stepGroup.get('key')?.value);

  const unknownTargets = steps.flatMap(stepGroup =>
    (stepGroup.get('nextSteps') as FormArray).controls
      .map(transitionGroup => transitionGroup.get('step')?.value)
      .filter(target => !!target && !keys.includes(target))
  );

  return unknownTargets.length
    ? {unknownTransitionTargets: {targets: [...new Set(unknownTargets)]}}
    : null;
};

/**
 * Transitions are evaluated in order and the first condition-less entry acts as the default, so at
 * most one transition per step may omit its condition.
 */
const singleDefaultTransitionValidator: ValidatorFn = (
  control: AbstractControl
): ValidationErrors | null => {
  const defaultCount = (control as FormArray).controls.filter(
    transitionGroup => !(transitionGroup.get('condition')?.value ?? '').trim()
  ).length;

  return defaultCount > 1 ? {multipleDefaultTransitions: true} : null;
};

export {
  uniqueStepKeysValidator,
  startStepExistsValidator,
  transitionTargetsExistValidator,
  singleDefaultTransitionValidator,
};
