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
import {TaskCountConditionGroupComponent} from './task-count-condition-group.component';
import {ConditionGroupOperator} from '../../models';
import {createConditionGroup} from '../../utils';

describe('TaskCountConditionGroupComponent', () => {
  const iconServiceMock = {registerAll: () => {}};

  function createComponent(
    operator: ConditionGroupOperator = 'and',
    rows: MultiInputValues = []
  ): {component: TaskCountConditionGroupComponent; changes: number} {
    const component = new TaskCountConditionGroupComponent(iconServiceMock as any);
    const state = {component, changes: 0};

    component.group = createConditionGroup(operator, rows);
    // The form is what reports a change to the configuration component; counting the emissions
    // shows that the group no longer needs an output of its own.
    component.group.valueChanges.subscribe(() => state.changes++);

    return state;
  }

  it('changes the group operator and reports the change through the form', () => {
    const state = createComponent('and');

    state.component.setOperator('or');

    expect(state.component.operator).toBe('or');
    expect(state.changes).toBe(1);
  });

  it('ignores a selection of the operator that is already active', () => {
    const state = createComponent('and');

    state.component.setOperator('and');

    expect(state.changes).toBe(0);
  });

  it('marks the group invalid while the multi input reports an incomplete row', () => {
    const state = createComponent('and');

    state.component.onAllRowsValid(false);

    expect(state.component.group.valid).toBe(false);

    state.component.onAllRowsValid(true);

    expect(state.component.group.valid).toBe(true);
  });

  it('adds a section with one empty row that combines its own conditions with and', () => {
    const state = createComponent('and');

    state.component.addGroup();

    expect(state.component.groups.length).toBe(1);
    expect(state.component.groups.at(0).controls.operator.value).toBe('and');
    expect(state.component.groups.at(0).controls.rows.value).toEqual([
      {key: '', dropdown: '', value: ''},
    ]);
    expect(state.changes).toBe(1);
  });

  it('never changes the operator of the group when a section is added', () => {
    const state = createComponent('or');

    state.component.addGroup();
    state.component.addGroup();
    state.component.addGroup();

    expect(state.component.operator).toBe('or');
    expect(state.component.groups.length).toBe(3);
  });

  it('changes the operator of the whole group through the connector selector only', () => {
    const state = createComponent('and');
    state.component.addGroup();
    state.component.addGroup();

    state.component.setOperator('or');

    expect(state.component.operator).toBe('or');
    // The sections keep their own operator; only the way they relate to each other changed.
    expect(state.component.groups.controls.map(group => group.controls.operator.value)).toEqual([
      'and',
      'and',
    ]);
  });

  it('removes the requested nested group only', () => {
    const state = createComponent('and');
    state.component.addGroup();
    state.component.addGroup();
    const secondGroup = state.component.groups.at(1);

    state.component.removeGroup(0);

    expect(state.component.groups.length).toBe(1);
    expect(state.component.groups.at(0)).toBe(secondGroup);
  });

  it('reports the validity of a nested group as its own', () => {
    const state = createComponent('and');
    state.component.addGroup();

    state.component.groups.at(0).controls.rowsComplete.setValue(false);

    expect(state.component.group.valid).toBe(false);
  });

  it('puts the interactive connector before the first section that follows something', () => {
    const withoutRows = createComponent('and');

    expect(withoutRows.component.interactiveConnectorIndex).toBe(1);

    const withRows = createComponent('and', [{key: 'task:name', dropdown: '==', value: 'A'}]);

    expect(withRows.component.interactiveConnectorIndex).toBe(0);
  });
});
