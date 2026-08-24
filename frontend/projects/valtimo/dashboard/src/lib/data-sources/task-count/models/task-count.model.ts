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

import {FormArray, FormControl, FormGroup} from '@angular/forms';
import {MultiInputValues} from '@valtimo/components';
import {WireConditionNode} from '../../../models';

interface TaskCountConfiguration {
  caseDefinitionName?: string;
  conditions?: WireConditionNode[];
  /** Legacy alias for [conditions], used by configuration saved before groups existed. */
  queryConditions?: WireConditionNode[];
}

type ConditionGroupOperator = 'and' | 'or';

interface ConditionGroupControls {
  /** Combines the rows and the nested groups of this group, mirroring `and`/`or` on the backend. */
  operator: FormControl<ConditionGroupOperator>;
  /**
   * The conditions of this group. Held as a single control because the multi input writes the whole
   * set of rows at once; it only ever contains complete rows, incomplete ones are reported through
   * [rowsComplete].
   */
  rows: FormControl<MultiInputValues>;
  /** False while the multi input holds a row that is not filled in completely. */
  rowsComplete: FormControl<boolean>;
  groups: FormArray<ConditionGroupForm>;
  /**
   * Children the editor cannot render (array values for the `in` operator, operators outside the
   * dropdown). Kept so that configuration authored in a file survives an edit in the admin UI.
   */
  unsupportedNodes: FormControl<WireConditionNode[]>;
}

/**
 * A single condition group as a form. Groups nest to arbitrary depth through [groups], so the
 * validity of the whole tree is the validity of this form.
 *
 * Declared as an interface rather than a type alias, so that the group can reference itself.
 */
interface ConditionGroupForm extends FormGroup<ConditionGroupControls> {}

/** The raw value of a [ConditionGroupForm], which is what the serializer walks. */
interface ConditionGroupValue {
  operator: ConditionGroupOperator;
  rows: MultiInputValues;
  rowsComplete: boolean;
  groups: ConditionGroupValue[];
  unsupportedNodes: WireConditionNode[];
}

/** The result of walking a [ConditionGroupValue] tree once. */
interface SerializedConditionGroup {
  /** The group as a wire node, or null when it holds no condition at all. */
  node: WireConditionNode | null;
  /** True when the tree holds nodes the editor cannot render. */
  hasUnsupportedNodes: boolean;
}

export {
  TaskCountConfiguration,
  ConditionGroupOperator,
  ConditionGroupControls,
  ConditionGroupForm,
  ConditionGroupValue,
  SerializedConditionGroup,
};
