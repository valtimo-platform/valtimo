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

import {MultiInputValues} from '@valtimo/components';
import {WireConditionNode} from '../../../models';

interface TaskCountConfiguration {
  caseDefinitionName?: string;
  conditions?: WireConditionNode[];
  /** Legacy alias for [conditions], used by configuration saved before groups existed. */
  queryConditions?: WireConditionNode[];
}

type ConditionGroupOperator = 'and' | 'or';

/**
 * Editor state for a single condition group. Mirrors the backend `AndConditionGroup` /
 * `OrConditionGroup`: the group combines its own condition rows and its nested groups with
 * [operator]. Groups nest to arbitrary depth.
 *
 * [unsupportedNodes] holds children that the editor cannot render (array values for the `in`
 * operator, operators outside the dropdown). They are emitted unchanged so that configuration
 * authored in a file survives an edit in the admin UI.
 */
interface ConditionGroupForm {
  operator: ConditionGroupOperator;
  rows: MultiInputValues;
  groups: ConditionGroupForm[];
  unsupportedNodes: WireConditionNode[];
}

/**
 * The result of walking a [ConditionGroupForm] tree once: everything the configuration component
 * needs to emit, gathered in a single traversal.
 */
interface SerializedConditionGroup {
  /** The group as a wire node, or null when it holds no complete condition at all. */
  node: WireConditionNode | null;
  /** False when a condition row is partially filled in. */
  valid: boolean;
  /** True when the tree holds nodes the editor cannot render. */
  hasUnsupportedNodes: boolean;
}

export {
  TaskCountConfiguration,
  ConditionGroupOperator,
  ConditionGroupForm,
  SerializedConditionGroup,
};
