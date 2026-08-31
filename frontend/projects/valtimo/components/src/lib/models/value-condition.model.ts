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

/** A single condition: a value-resolver path compared with a value. */
interface ValueCondition {
  path: string;
  operator: string;
  value: unknown;
}

/** A group of conditions combined with AND (`allOf`) or OR (`anyOf`). Exactly one key is present — the key itself carries the meaning, matching the backend JSON. */
interface ValueConditionGroup {
  allOf?: ValueConditionNode[];
  anyOf?: ValueConditionNode[];
}

/** An entry in a condition list: either a condition or a (possibly nested) group of them. */
type ValueConditionNode = ValueCondition | ValueConditionGroup;

/** Which way a group combines its entries. Also the JSON key the group is written under. */
type ValueConditionGroupMode = 'allOf' | 'anyOf';

/** Whether a row in the editor holds a single condition or a group. */
type ValueConditionKind = 'condition' | 'group';

export {
  ValueCondition,
  ValueConditionGroup,
  ValueConditionGroupMode,
  ValueConditionKind,
  ValueConditionNode,
};
