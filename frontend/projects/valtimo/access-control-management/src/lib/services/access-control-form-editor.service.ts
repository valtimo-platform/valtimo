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
import {TranslateService} from '@ngx-translate/core';
import {SelectItem} from '@valtimo/components';
import {PbacRegistryDto, PbacResourceDto} from '@valtimo/shared';
import {NO_CONTEXT_RESOURCE_TYPE} from '../constants';
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

  constructor(
    private readonly fb: FormBuilder,
    private readonly translateService: TranslateService
  ) {}

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

    return this.fb.group(
      {
        resourceType: this.fb.control(permission?.resourceType ?? '', Validators.required),
        actions: this.fb.control(this.normalizeActions(permission), minSelectedArrayValidator(1)),
        conditions: this.fb.array(
          conditions.map(condition => this.createConditionGroup(condition))
        ),
        hasContext: this.fb.control(!!permission?.contextResourceType),
        contextResourceType: this.fb.control(permission?.contextResourceType ?? null),
        contextConditions: this.fb.array(
          contextConditions.map(condition => this.createConditionGroup(condition))
        ),
      },
      {validators: contextResourceTypeValidator}
    );
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
    return permissionsArray.controls.map(control => {
      const group = control as FormGroup;
      const result: UpdateRolePermission = {
        resourceType: group.get('resourceType')!.value,
        actions: group.get('actions')!.value ?? [],
        conditions: this.serializeConditions(group.get('conditions') as FormArray),
      };

      if (group.get('hasContext')!.value && group.get('contextResourceType')!.value) {
        result.contextResourceType = group.get('contextResourceType')!.value;
        result.contextConditions = this.serializeConditions(
          group.get('contextConditions') as FormArray
        );
      }

      return result;
    });
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

  // Resource types, actions, operators, container targets and condition types are all shown by
  // their raw technical name (the exact value written to the permission JSON), not a translated
  // display name, so the editor reflects precisely what is being configured.
  public resourceTypeItems(include?: string | string[] | null): SelectItem[] {
    const items = this._resources.map(resource => ({
      id: resource.resourceType,
      text: resource.resourceType,
    }));
    return this.sortByText(this.withIncluded(items, include));
  }

  // Only resource types reachable from the permission's resource type via an entity mapper can be
  // used as its context (the same set as the container-condition targets). A context with no
  // mapper can never match at runtime, so the options are scoped per resource type rather than
  // listing every resource.
  public contextResourceTypeItems(
    resourceType: string,
    include?: string | string[] | null
  ): SelectItem[] {
    const noContext: SelectItem = {
      id: NO_CONTEXT_RESOURCE_TYPE,
      text: this.translateService.instant('accessControl.overview.noContext'),
    };
    return this.withIncluded([noContext, ...this.containerTargetItems(resourceType)], include);
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
    for (const field of resource?.fields ?? []) names.add(field.name);
    for (const alias of resource?.fieldAliases ?? []) names.add(alias.alias);
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
    return this._operatorKeys.map(key => ({
      id: key,
      text: key,
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
    // A freshly-added row (no condition) or a container has no value to edit. Returning undefined
    // renders the value field empty; only an existing field/expression condition whose value is
    // genuinely null renders the literal "null".
    return undefined;
  }

  private withIncluded(items: SelectItem[], include?: string | string[] | null): SelectItem[] {
    const values = (Array.isArray(include) ? include : [include]).filter(
      (value): value is string => !!value
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

function contextResourceTypeValidator(group: AbstractControl): ValidationErrors | null {
  const hasContext = group.get('hasContext')?.value;
  const contextResourceType = group.get('contextResourceType')?.value;
  return hasContext && !contextResourceType ? {contextResourceTypeRequired: true} : null;
}

function conditionValidator(group: AbstractControl): ValidationErrors | null {
  const type: ConditionType = group.get('type')?.value;
  const errors: ValidationErrors = {};

  if (type === 'container') {
    if (!group.get('resourceType')?.value) errors['resourceTypeRequired'] = true;
  } else {
    if (!group.get('field')?.value) errors['fieldRequired'] = true;
    if (type === 'expression') {
      if (!group.get('path')?.value) errors['pathRequired'] = true;
      if (!group.get('clazz')?.value) errors['clazzRequired'] = true;
    }
  }

  return Object.keys(errors).length ? errors : null;
}
