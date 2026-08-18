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

import {TaskCountConditionGroupComponent} from './task-count-condition-group.component';
import {ConditionGroupForm} from '../../models';

describe('TaskCountConditionGroupComponent', () => {
  const iconServiceMock = {registerAll: () => {}};

  function createComponent(group: ConditionGroupForm): {
    component: TaskCountConditionGroupComponent;
    changes: number;
  } {
    const component = new TaskCountConditionGroupComponent(iconServiceMock as any);
    const state = {component, changes: 0};
    component.groupChange.subscribe(() => state.changes++);
    component.group = group;

    return state;
  }

  function emptyGroup(operator: 'and' | 'or' = 'and'): ConditionGroupForm {
    return {operator, rows: [], groups: [], unsupportedNodes: []};
  }

  it('does not feed the live rows back into the multi input', () => {
    const state = createComponent(emptyGroup());

    expect(state.component.initialRows).toBeNull();

    const withRows = createComponent({
      ...emptyGroup(),
      rows: [{key: 'task:name', dropdown: '==', value: 'A'}],
    });

    expect(withRows.component.initialRows).toEqual([
      {key: 'task:name', dropdown: '==', value: 'A'},
    ]);
    expect(withRows.component.initialRows).not.toBe(withRows.component.group.rows);
  });

  it('changes the group operator and reports the change', () => {
    const state = createComponent(emptyGroup('and'));

    state.component.setOperator('or');

    expect(state.component.group.operator).toBe('or');
    expect(state.changes).toBe(1);
  });

  it('ignores a selection of the operator that is already active', () => {
    const state = createComponent(emptyGroup('and'));

    state.component.setOperator('and');

    expect(state.changes).toBe(0);
  });

  it('stores changed rows and ignores an unchanged emission', () => {
    const state = createComponent(emptyGroup());
    const rows = [{key: 'task:name', dropdown: '==', value: 'A'}];

    state.component.rowsValueChange(rows);
    state.component.rowsValueChange([{key: 'task:name', dropdown: '==', value: 'A'}]);

    expect(state.component.group.rows).toEqual(rows);
    expect(state.changes).toBe(1);
  });

  it('adds a section with one empty row and joins it with the chosen operator', () => {
    const state = createComponent(emptyGroup('and'));

    state.component.addGroup('or');

    expect(state.component.group.operator).toBe('or');
    expect(state.component.group.groups.length).toBe(1);
    expect(state.component.group.groups[0].operator).toBe('and');
    expect(state.component.group.groups[0].rows).toEqual([{key: '', dropdown: '', value: ''}]);
    expect(state.changes).toBe(1);
  });

  it('applies the operator of the last addition to every connector of the group', () => {
    const state = createComponent(emptyGroup('and'));

    state.component.addGroup('or');
    state.component.addGroup('or');

    expect(state.component.group.operator).toBe('or');

    state.component.addGroup('and');

    expect(state.component.group.operator).toBe('and');
    expect(state.component.group.groups.length).toBe(3);
  });

  it('removes the requested nested group only', () => {
    const state = createComponent(emptyGroup());
    state.component.addGroup('or');
    state.component.addGroup('and');
    const [firstGroup, secondGroup] = state.component.group.groups;

    state.component.removeGroup(firstGroup);

    expect(state.component.group.groups).toEqual([secondGroup]);
  });

  it('puts the interactive connector before the first section that follows something', () => {
    const withoutRows = createComponent(emptyGroup());

    expect(withoutRows.component.interactiveConnectorIndex).toBe(1);

    const withRows = createComponent({
      ...emptyGroup(),
      rows: [{key: 'task:name', dropdown: '==', value: 'A'}],
    });

    expect(withRows.component.interactiveConnectorIndex).toBe(0);
  });

  it('qualifies test ids with the position of the group in the tree', () => {
    const state = createComponent(emptyGroup());

    expect(state.component.testId('taskCountConditionGroup')).toBe('taskCountConditionGroup--root');

    state.component.groupId = 'root-1';

    expect(state.component.testId('taskCountConditionGroup')).toBe(
      'taskCountConditionGroup--root-1'
    );
    expect(state.component.testId('taskCountGroupOperatorSwitcher', 2)).toBe(
      'taskCountGroupOperatorSwitcher--root-1-2'
    );
  });
});
