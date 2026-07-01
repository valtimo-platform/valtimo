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
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import {SelectItem} from '@valtimo/components';
import {PbacRegistryDto, PbacResourceDto} from '@valtimo/shared';
import {NO_CONTEXT_RESOURCE_TYPE, OPERATOR_LABEL} from '../constants';
import {
  ConditionOperator,
  ConditionType,
  Permission,
  PermissionCondition,
  UpdateRolePermission,
} from '../models';
import {textToValue, valueToText} from '../utils';

@Injectable()
export class AccessControlFormEditorService {
  private _resources: PbacResourceDto[] = [];
  private _resourceByType: Record<string, PbacResourceDto> = {};
  private _operatorKeys: ConditionOperator[] = [];
  private _actionsByResourceType: Record<string, string[]> = {};

  constructor(private readonly fb: FormBuilder) {}

  public setRegistry(registry: PbacRegistryDto): void {
    this._resources = registry.resources;
    this._resourceByType = registry.resources.reduce<Record<string, PbacResourceDto>>(
      (acc, resource) => {
        acc[resource.resourceType] = resource;
        return acc;
      },
      {}
    );
    this._operatorKeys = registry.operators.map(operator => operator.key as ConditionOperator);
  }

  // The available actions per resource type are provided by the metadata service, which sources
  // them from the PBAC registry (the backend discovers every ResourceActionProvider on the
  // classpath).
  public setActionsByResourceType(actionsByResourceType: Record<string, string[]>): void {
    this._actionsByResourceType = actionsByResourceType;
  }

  // ----- Form construction -----

  public buildPermissionsArray(permissions: Permission[]): FormArray {
    return this.fb.array(permissions.map(permission => this.createPermissionGroup(permission)));
  }

  public createPermissionGroup(permission?: Permission): FormGroup {
    const conditions = permission?.conditions ?? [];
    const contextConditions = permission?.contextConditions ?? [];

    return this.fb.group({
      resourceType: this.fb.control(permission?.resourceType ?? '', Validators.required),
      actions: this.fb.control(this.normalizeActions(permission), minSelectedArrayValidator(1)),
      conditions: this.fb.array(conditions.map(condition => this.createConditionGroup(condition))),
      // Context is opt-in via a toggle. `hasContext` off means "no context at all" — nothing about
      // context is serialized. On means the permission is scoped to the selected context resource,
      // which may be a real related resource or the "No context" marker (itself a deliberate,
      // distinct choice, as opposed to leaving context off entirely). The resource defaults to the
      // marker so the dropdown always has a valid, non-empty value while the toggle is on.
      hasContext: this.fb.control(!!permission?.contextResourceType),
      contextResourceType: this.fb.control(
        permission?.contextResourceType || NO_CONTEXT_RESOURCE_TYPE
      ),
      contextConditions: this.fb.array(
        contextConditions.map(condition => this.createConditionGroup(condition))
      ),
    });
  }

  public createConditionGroup(condition?: PermissionCondition, type?: ConditionType): FormGroup {
    const conditionType: ConditionType = condition?.type ?? type ?? 'field';
    const nested = condition && condition.type === 'container' ? (condition.conditions ?? []) : [];

    return this.fb.group(
      {
        type: this.fb.control<ConditionType>(conditionType),
        field: this.fb.control(this.conditionField(condition)),
        operator: this.fb.control<ConditionOperator>(this.conditionOperator(condition)),
        value: this.fb.control(valueToText(this.conditionValue(condition))),
        path: this.fb.control(condition && condition.type === 'expression' ? condition.path : ''),
        clazz: this.fb.control(condition && condition.type === 'expression' ? condition.clazz : ''),
        resourceType: this.fb.control(
          condition && condition.type === 'container' ? condition.resourceType : ''
        ),
        conditions: this.fb.array(nested.map(child => this.createConditionGroup(child))),
      },
      {validators: conditionValidator}
    );
  }

  // ----- Serialization back to the PUT contract -----

  public serialize(permissionsArray: FormArray): UpdateRolePermission[] {
    return permissionsArray.controls.map(control => this.serializePermission(control as FormGroup));
  }

  public serializePermission(group: FormGroup): UpdateRolePermission {
    const result: UpdateRolePermission = {
      resourceType: group.get('resourceType')!.value,
      actions: group.get('actions')!.value ?? [],
      conditions: this.serializeConditions(group.get('conditions') as FormArray),
    };

    // Context is only written when the toggle is on. The selected resource may be a real related
    // resource or the "No context" marker (a distinct, deliberate choice); either way it is
    // persisted. Toggling context off drops the context fields entirely.
    if (group.get('hasContext')!.value) {
      result.contextResourceType = group.get('contextResourceType')!.value;
      result.contextConditions = this.serializeConditions(
        group.get('contextConditions') as FormArray
      );
    }

    return result;
  }

  private serializeConditions(conditionsArray: FormArray): PermissionCondition[] {
    return conditionsArray.controls.map(control => {
      const group = control as FormGroup;
      const type: ConditionType = group.get('type')!.value;

      if (type === 'container') {
        return {
          type: 'container',
          resourceType: group.get('resourceType')!.value,
          conditions: this.serializeConditions(group.get('conditions') as FormArray),
        };
      }

      if (type === 'expression') {
        return {
          type: 'expression',
          field: group.get('field')!.value,
          path: group.get('path')!.value,
          operator: group.get('operator')!.value,
          value: textToValue(group.get('value')!.value),
          clazz: group.get('clazz')!.value,
        };
      }

      return {
        type: 'field',
        field: group.get('field')!.value,
        operator: group.get('operator')!.value,
        value: textToValue(group.get('value')!.value),
      };
    });
  }

  // ----- Registry-driven select options -----

  // Resource types, fields and container targets are shown by their raw technical name (the exact
  // value written to the permission JSON). Actions, operators and condition types instead use
  // natural-language labels (actions fall back to the technical key when untranslated).
  public resourceTypeItems(include?: string | string[] | null): SelectItem[] {
    const items = this._resources.map(resource => ({
      id: resource.resourceType,
      text: resource.resourceType,
    }));
    return this.sortByText(this.withIncluded(items, include));
  }

  // The context options are "No context" plus the resource types reachable from the permission's
  // resource type via an entity mapper (the same set as the container-condition targets). "No
  // context" maps to the backend NoContext marker.
  public contextResourceTypeItems(
    resourceType: string,
    include?: string | string[] | null
  ): SelectItem[] {
    const noContext: SelectItem = {
      id: NO_CONTEXT_RESOURCE_TYPE,
      translationKey: 'accessControl.overview.noContext',
    };
    // "No context" is added explicitly here, so the NoContext marker must never also be
    // force-included among the container targets: doing so appends a second item with the same id
    // (the marker is not a real target), which renders as a duplicate row and two selected
    // checkmarks. Only real resources are kept visible via `include`.
    const targetInclude = Array.isArray(include)
      ? include.filter(value => value !== NO_CONTEXT_RESOURCE_TYPE)
      : include === NO_CONTEXT_RESOURCE_TYPE
        ? null
        : include;
    return [noContext, ...this.containerTargetItems(resourceType, targetInclude)];
  }

  public actionItems(resourceType: string, include?: string | string[] | null): SelectItem[] {
    const actions = this._actionsByResourceType[resourceType] ?? [];
    const items = actions.map(action => ({
      id: action,
      text: action,
    }));
    return this.withIncluded(items, include);
  }

  public fieldItems(resourceType: string, include?: string | string[] | null): SelectItem[] {
    const resource = this._resourceByType[resourceType];
    const names = new Set<string>();
    // Only string names are kept; a malformed registry entry must not render as "[object Object]".
    for (const field of resource?.fields ?? []) {
      if (typeof field?.name === 'string' && field.name) names.add(field.name);
    }
    for (const alias of resource?.fieldAliases ?? []) {
      if (typeof alias?.alias === 'string' && alias.alias) names.add(alias.alias);
    }
    // Fields are shown by their technical name (e.g. "isFinal", "createdBy") since that is the
    // exact value used in the permission condition.
    const items = Array.from(names).map(name => ({id: name, text: name}));
    return this.sortByText(this.withIncluded(items, include));
  }

  public containerTargetItems(
    resourceType: string,
    include?: string | string[] | null
  ): SelectItem[] {
    const targets = this._resourceByType[resourceType]?.containerTargets ?? [];
    const items = targets.map(target => ({
      id: target,
      text: target,
    }));
    return this.sortByText(this.withIncluded(items, include));
  }

  public operatorItems(): SelectItem[] {
    // Operators are shown in natural language (e.g. "equals", "is greater than") via their
    // translation key; the stored value stays the technical symbol (the item id).
    return this._operatorKeys.map(key => ({
      id: key,
      translationKey: OPERATOR_LABEL[key],
    }));
  }

  // ----- Helpers -----

  private normalizeActions(permission?: Permission): string[] {
    if (permission?.actions?.length) return [...permission.actions];
    if (permission?.action) return [permission.action];
    return [];
  }

  private conditionField(condition?: PermissionCondition): string {
    if (condition && (condition.type === 'field' || condition.type === 'expression')) {
      return condition.field;
    }
    return '';
  }

  private conditionOperator(condition?: PermissionCondition): ConditionOperator {
    if (condition && (condition.type === 'field' || condition.type === 'expression')) {
      return condition.operator;
    }
    return '==';
  }

  private conditionValue(condition?: PermissionCondition): unknown {
    if (condition && (condition.type === 'field' || condition.type === 'expression')) {
      return condition.value;
    }
    // A freshly-added field/expression row has no value yet; default it to null, which renders as
    // the literal "null". The value field is required and may not be left empty — to express "no
    // value" the user types null explicitly.
    return null;
  }

  private withIncluded(items: SelectItem[], include?: string | string[] | null): SelectItem[] {
    // Only genuine, non-empty strings are added. A truthy non-string (e.g. an object that somehow
    // reached a field/value control) would otherwise be pushed as {id, text} and render as
    // "[object Object]" — guard against that here rather than trusting the caller.
    const values = (Array.isArray(include) ? include : [include]).filter(
      (value): value is string => typeof value === 'string' && !!value
    );
    const result = [...items];
    for (const value of values) {
      if (!result.some(item => item.id === value)) result.push({id: value, text: value});
    }
    return result;
  }

  private sortByText(items: SelectItem[]): SelectItem[] {
    return [...items].sort((a, b) => (a.text ?? '').localeCompare(b.text ?? ''));
  }
}

function minSelectedArrayValidator(min: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    return Array.isArray(value) && value.length >= min ? null : {minSelected: {min}};
  };
}

function conditionValidator(group: AbstractControl): ValidationErrors | null {
  const type: ConditionType = group.get('type')?.value;
  const errors: ValidationErrors = {};

  if (type === 'container') {
    if (!group.get('resourceType')?.value) errors['resourceTypeRequired'] = true;
  } else {
    if (!group.get('field')?.value) errors['fieldRequired'] = true;
    // The value may not be left empty; "null" must be typed for an explicit null value.
    if (!group.get('value')?.value) errors['valueRequired'] = true;
    if (type === 'expression') {
      if (!group.get('path')?.value) errors['pathRequired'] = true;
      if (!group.get('clazz')?.value) errors['clazzRequired'] = true;
    }
  }

  return Object.keys(errors).length ? errors : null;
}
