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

import {FormArray, FormControl, FormGroup, Validators} from '@angular/forms';
import {MultiInputKeyValue, MultiInputValues} from '@valtimo/components';
import {ExpressionOperator} from '@valtimo/shared';
import {
  ConditionLeaf,
  WireAndConditionGroup,
  WireConditionGroup,
  WireConditionLeaf,
  WireConditionNode,
  WireOrConditionGroup,
} from '../../../models';
import {
  ConditionGroupForm,
  ConditionGroupOperator,
  ConditionGroupValue,
  SerializedConditionGroup,
} from '../models';

/** The operators the condition rows offer. Anything else is preserved but not editable. */
export const EDITABLE_CONDITION_OPERATORS: Array<ExpressionOperator> = [
  '!=',
  '==',
  '>',
  '>=',
  '<',
  '<=',
];

export function createConditionGroup(
  operator: ConditionGroupOperator,
  rows: MultiInputValues = [],
  unsupportedNodes: WireConditionNode[] = []
): ConditionGroupForm {
  return new FormGroup({
    operator: new FormControl<ConditionGroupOperator>(operator, {nonNullable: true}),
    rows: new FormControl<MultiInputValues>(rows, {nonNullable: true}),
    // The multi input drops incomplete rows from its value, so a group that is still being filled
    // in can only be recognised through the event the multi input emits for it. Until that event
    // arrives - and for a group that is never rendered - the rows themselves decide, so that a
    // group created with an empty row does not report itself as complete in the meantime.
    rowsComplete: new FormControl<boolean>(rows.every(isRowComplete), {
      nonNullable: true,
      validators: [Validators.requiredTrue],
    }),
    groups: new FormArray<ConditionGroupForm>([]),
    unsupportedNodes: new FormControl<WireConditionNode[]>(unsupportedNodes, {nonNullable: true}),
  });
}

export function createEmptyConditionRow(): MultiInputKeyValue {
  return {key: '', dropdown: '', value: ''};
}

/**
 * Applies the conditions of a stored configuration to [root], leaving the form instance itself
 * intact so that subscriptions on it survive a prefill.
 *
 * A single group at the top level is adopted as the root group itself, so that its operator
 * survives a save/reload round-trip. Anything else - including a legacy flat list of conditions -
 * becomes a set of children combined with AND, matching the backend's list semantics.
 */
export function resetRootGroup(root: ConditionGroupForm, nodes: WireConditionNode[]): void {
  const [firstNode] = nodes;

  if (nodes.length === 1 && isWireGroup(firstNode)) {
    applyWireGroup(root, firstNode);

    return;
  }

  root.controls.operator.setValue('and');
  applyWireChildren(root, nodes);
}

/**
 * Walks [group] once and collects the wire node to emit and whether the tree holds nodes the editor
 * cannot render.
 *
 * Groups without a single condition serialize to `null`: the backend rejects empty `and`/`or`
 * groups, because `cb.or()` without predicates evaluates to false and would silently zero out the
 * count.
 */
export function serializeConditionGroup(group: ConditionGroupValue): SerializedConditionGroup {
  const children: WireConditionNode[] = [];
  let hasUnsupportedNodes = group.unsupportedNodes.length > 0;

  group.rows.filter(isRowComplete).forEach(row => children.push(rowToLeaf(row)));

  group.groups.forEach(nestedGroup => {
    const nested = serializeConditionGroup(nestedGroup);
    hasUnsupportedNodes = hasUnsupportedNodes || nested.hasUnsupportedNodes;

    if (nested.node) {
      children.push(nested.node);
    }
  });

  children.push(...group.unsupportedNodes);

  return {
    node: children.length ? toWireGroup(group.operator, children) : null,
    hasUnsupportedNodes,
  };
}

function toWireGroup(
  operator: ConditionGroupOperator,
  children: WireConditionNode[]
): WireConditionGroup {
  return operator === 'or' ? {or: children} : {and: children};
}

function applyWireGroup(group: ConditionGroupForm, wireGroup: WireConditionGroup): void {
  if (isWireOrGroup(wireGroup)) {
    group.controls.operator.setValue('or');
    applyWireChildren(group, wireGroup.or);
  } else {
    group.controls.operator.setValue('and');
    applyWireChildren(group, wireGroup.and);
  }
}

function applyWireChildren(group: ConditionGroupForm, nodes: WireConditionNode[]): void {
  const rows: MultiInputValues = [];
  const unsupportedNodes: WireConditionNode[] = [];

  group.controls.groups.clear();

  nodes.forEach(node => {
    if (isWireGroup(node)) {
      const nestedGroup = createConditionGroup('and');
      applyWireGroup(nestedGroup, node);
      group.controls.groups.push(nestedGroup);
    } else if (isEditableLeaf(node)) {
      rows.push(wireLeafToRow(node));
    } else {
      unsupportedNodes.push(node);
    }
  });

  group.controls.rows.setValue(rows);
  // The rows that were reported as incomplete are gone, and a group whose rows are all removed no
  // longer renders a multi input to report on them, so the flag is reset here rather than waited on.
  group.controls.rowsComplete.setValue(rows.every(isRowComplete));
  group.controls.unsupportedNodes.setValue(unsupportedNodes);
}

function isWireOrGroup(node: WireConditionNode): node is WireOrConditionGroup {
  return Array.isArray((node as WireOrConditionGroup).or);
}

function isWireAndGroup(node: WireConditionNode): node is WireAndConditionGroup {
  return Array.isArray((node as WireAndConditionGroup).and);
}

function isWireGroup(node: WireConditionNode | undefined): node is WireConditionGroup {
  return !!node && (isWireOrGroup(node) || isWireAndGroup(node));
}

/** A leaf is editable when every part of it fits the three inputs of a condition row. */
function isEditableLeaf(leaf: WireConditionLeaf): boolean {
  const value = leaf.value ?? leaf.queryValue;

  return (
    typeof (leaf.path ?? leaf.queryPath) === 'string' &&
    (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') &&
    EDITABLE_CONDITION_OPERATORS.includes(
      (leaf.operator ?? leaf.queryOperator) as ExpressionOperator
    )
  );
}

function wireLeafToRow(leaf: WireConditionLeaf): MultiInputKeyValue {
  return {
    key: (leaf.path ?? leaf.queryPath) as string,
    dropdown: (leaf.operator ?? leaf.queryOperator) as string,
    value: String(leaf.value ?? leaf.queryValue),
  };
}

function rowToLeaf(row: MultiInputKeyValue): ConditionLeaf {
  return {
    path: row.key,
    operator: row.dropdown as ExpressionOperator,
    value: row.value,
  };
}

function isRowComplete(row: MultiInputKeyValue): boolean {
  return !!row.key && !!row.dropdown && !!row.value;
}
