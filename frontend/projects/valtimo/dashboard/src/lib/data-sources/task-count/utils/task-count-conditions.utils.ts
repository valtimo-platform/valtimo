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
import {ConditionGroupForm, ConditionGroupOperator, SerializedConditionGroup} from '../models';

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
  rows: MultiInputValues = []
): ConditionGroupForm {
  return {operator, rows, groups: [], unsupportedNodes: []};
}

export function createEmptyConditionRow(): MultiInputKeyValue {
  return {key: '', dropdown: '', value: ''};
}

/**
 * Turns the conditions of a stored configuration into the root group of the editor.
 *
 * A single group at the top level is adopted as the root group itself, so that its operator
 * survives a save/reload round-trip. Anything else - including a legacy flat list of conditions -
 * becomes a set of children combined with AND, matching the backend's list semantics.
 */
export function wireNodesToRootGroup(nodes: WireConditionNode[]): ConditionGroupForm {
  const [firstNode] = nodes;

  return nodes.length === 1 && isWireGroup(firstNode)
    ? wireGroupToForm(firstNode)
    : {operator: 'and', ...wireChildrenToForm(nodes)};
}

/**
 * Walks [group] once and collects the wire node to emit, whether the tree is valid, and whether it
 * holds nodes the editor cannot render.
 *
 * Groups without a single complete condition serialize to `null`: the backend rejects empty
 * `and`/`or` groups, because `cb.or()` without predicates evaluates to false and would silently
 * zero out the count.
 */
export function serializeConditionGroup(group: ConditionGroupForm): SerializedConditionGroup {
  const children: WireConditionNode[] = [];
  let valid = true;
  let hasUnsupportedNodes = group.unsupportedNodes.length > 0;

  group.rows.forEach(row => {
    if (isRowComplete(row)) {
      children.push(rowToLeaf(row));
    } else if (!isRowEmpty(row)) {
      valid = false;
    }
  });

  group.groups.forEach(nestedGroup => {
    const nested = serializeConditionGroup(nestedGroup);
    valid = valid && nested.valid;
    hasUnsupportedNodes = hasUnsupportedNodes || nested.hasUnsupportedNodes;

    if (nested.node) {
      children.push(nested.node);
    }
  });

  children.push(...group.unsupportedNodes);

  return {
    node: children.length ? toWireGroup(group.operator, children) : null,
    valid,
    hasUnsupportedNodes,
  };
}

function toWireGroup(
  operator: ConditionGroupOperator,
  children: WireConditionNode[]
): WireConditionGroup {
  return operator === 'or' ? {or: children} : {and: children};
}

function wireGroupToForm(group: WireConditionGroup): ConditionGroupForm {
  return isWireOrGroup(group)
    ? {operator: 'or', ...wireChildrenToForm(group.or)}
    : {operator: 'and', ...wireChildrenToForm(group.and)};
}

function wireChildrenToForm(nodes: WireConditionNode[]): Omit<ConditionGroupForm, 'operator'> {
  const form: Omit<ConditionGroupForm, 'operator'> = {rows: [], groups: [], unsupportedNodes: []};

  nodes.forEach(node => {
    if (isWireGroup(node)) {
      form.groups.push(wireGroupToForm(node));
    } else if (isEditableLeaf(node)) {
      form.rows.push(wireLeafToRow(node));
    } else {
      form.unsupportedNodes.push(node);
    }
  });

  return form;
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

function isRowEmpty(row: MultiInputKeyValue): boolean {
  return !row.key && !row.dropdown && !row.value;
}
