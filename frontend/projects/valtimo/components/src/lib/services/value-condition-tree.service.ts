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
import {FormArray, FormBuilder, FormGroup} from '@angular/forms';
import {
  ValueCondition,
  ValueConditionGroup,
  ValueConditionGroupMode,
  ValueConditionKind,
  ValueConditionNode,
} from '../models';

/** Translates a condition tree between its JSON form and the nested reactive form. Every row holds both a condition's and a group's controls, so switching a row between the two is lossless. */
@Injectable({providedIn: 'root'})
export class ValueConditionTreeService {
  constructor(private readonly fb: FormBuilder) {}

  public buildArray(nodes: ValueConditionNode[] = []): FormArray {
    return this.fb.array(nodes.map(node => this.createNodeGroup(node)));
  }

  public createNodeGroup(node?: ValueConditionNode): FormGroup {
    const mode = this.groupModeOf(node);
    const condition = mode ? undefined : (node as ValueCondition | undefined);

    return this.fb.group({
      kind: this.fb.control<ValueConditionKind>(mode ? 'group' : 'condition'),
      path: this.fb.control(condition?.path ?? ''),
      operator: this.fb.control(condition?.operator ?? '=='),
      value: this.fb.control(condition?.value != null ? String(condition.value) : ''),
      mode: this.fb.control<ValueConditionGroupMode>(mode ?? 'anyOf'),
      conditions: mode
        ? this.buildArray((node as ValueConditionGroup)[mode])
        : this.fb.array<FormGroup>([]),
    });
  }

  public serialize(conditions: FormArray): ValueConditionNode[] {
    return conditions.controls
      .map(control => this.serializeNode(control as FormGroup))
      .filter((node): node is ValueConditionNode => node !== null);
  }

  /** Which way the node groups its entries, or `null` when the node is a single condition. */
  private groupModeOf(node?: ValueConditionNode): ValueConditionGroupMode | null {
    if (!node) return null;
    if (Array.isArray((node as ValueConditionGroup).allOf)) return 'allOf';
    if (Array.isArray((node as ValueConditionGroup).anyOf)) return 'anyOf';
    return null;
  }

  private serializeNode(group: FormGroup): ValueConditionNode | null {
    if (group.get('kind')?.value === 'group') {
      const mode: ValueConditionGroupMode = group.get('mode')?.value ?? 'anyOf';
      const nested = this.serialize(group.get('conditions') as FormArray);

      // An empty group is dropped: the backend rejects one, and an unfilled group should not block saving the rest.
      return nested.length ? {[mode]: nested} : null;
    }

    const path = group.get('path')?.value ?? '';
    if (!path) return null;

    const operator = group.get('operator')?.value ?? '==';
    const value = group.get('value')?.value ?? '';

    return {
      path,
      operator,
      // 'exists' needs no value of its own, unless the author typed one ('false').
      value: operator === 'exists' && !value ? null : value,
    };
  }
}
