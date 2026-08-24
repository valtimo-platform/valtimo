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

import {WireConditionNode} from '../../../models';
import {ConditionGroupForm, ConditionGroupValue} from '../models';
import {createConditionGroup, resetRootGroup, serializeConditionGroup} from './index';

describe('task count condition utils', () => {
  function rootGroupOf(nodes: WireConditionNode[]): ConditionGroupForm {
    const rootGroup = createConditionGroup('and');
    resetRootGroup(rootGroup, nodes);

    return rootGroup;
  }

  function serialize(group: ConditionGroupForm) {
    return serializeConditionGroup(group.getRawValue() as ConditionGroupValue);
  }

  function roundTrip(nodes: WireConditionNode[]): WireConditionNode | null {
    return serialize(rootGroupOf(nodes)).node;
  }

  describe('resetRootGroup', () => {
    it('reads a legacy flat list of aliased leaves as an AND root group', () => {
      const rootGroup = rootGroupOf([
        {queryPath: 'task:assignee', queryOperator: '==', queryValue: 'x'},
      ]);

      expect(rootGroup.controls.operator.value).toBe('and');
      expect(rootGroup.controls.rows.value).toEqual([
        {key: 'task:assignee', dropdown: '==', value: 'x'},
      ]);
    });

    it('adopts a single top-level group as the root group, so its operator round-trips', () => {
      const rootGroup = rootGroupOf([
        {
          or: [
            {path: 'task:name', operator: '==', value: 'A'},
            {path: 'task:name', operator: '==', value: 'B'},
          ],
        },
      ]);

      expect(rootGroup.controls.operator.value).toBe('or');
      expect(rootGroup.controls.rows.value.length).toBe(2);
      expect(rootGroup.controls.groups.length).toBe(0);
    });

    it('splits a flat leaf plus a group into root rows and one nested group', () => {
      const rootGroup = rootGroupOf([
        {path: 'task:assignee', operator: '!=', value: 'x'},
        {or: [{path: 'task:name', operator: '==', value: 'A'}]},
      ]);

      expect(rootGroup.controls.operator.value).toBe('and');
      expect(rootGroup.controls.rows.value.length).toBe(1);
      expect(rootGroup.controls.groups.length).toBe(1);
      expect(rootGroup.controls.groups.at(0).controls.operator.value).toBe('or');
    });

    it('stringifies non-string scalar values so they fit the row inputs', () => {
      const rootGroup = rootGroupOf([{path: 'task:priority', operator: '>', value: 50}]);

      expect(rootGroup.controls.rows.value).toEqual([
        {key: 'task:priority', dropdown: '>', value: '50'},
      ]);
    });

    it('keeps leaves the row inputs cannot represent out of the rows', () => {
      const arrayValueLeaf = {path: 'task:name', operator: 'in', value: ['A', 'B']};
      const objectValueLeaf = {path: 'task:name', operator: '==', value: {nested: true}};

      const rootGroup = rootGroupOf([arrayValueLeaf, objectValueLeaf]);

      expect(rootGroup.controls.rows.value).toEqual([]);
      expect(rootGroup.controls.unsupportedNodes.value).toEqual([arrayValueLeaf, objectValueLeaf]);
    });

    it('replaces the previous contents of the group it is applied to', () => {
      const rootGroup = rootGroupOf([{or: [{path: 'task:name', operator: '==', value: 'A'}]}]);

      resetRootGroup(rootGroup, [{and: [{or: [{path: 'task:name', operator: '==', value: 'B'}]}]}]);

      expect(rootGroup.controls.operator.value).toBe('and');
      expect(rootGroup.controls.rows.value).toEqual([]);
      expect(rootGroup.controls.groups.length).toBe(1);
    });
  });

  describe('serializeConditionGroup', () => {
    it('round-trips a tree nested more than one level deep', () => {
      const conditions: WireConditionNode[] = [
        {
          and: [
            {path: 'task:assignee', operator: '!=', value: 'x'},
            {
              or: [
                {path: 'task:name', operator: '==', value: 'A'},
                {
                  and: [
                    {path: 'task:name', operator: '==', value: 'B'},
                    {path: 'task:assignee', operator: '==', value: 'y'},
                  ],
                },
              ],
            },
          ],
        },
      ];

      expect(roundTrip(conditions)).toEqual(conditions[0]);
    });

    it('normalises a legacy flat list into an AND group with canonical keys', () => {
      expect(
        roundTrip([{queryPath: 'task:assignee', queryOperator: '==', queryValue: 'x'}])
      ).toEqual({
        and: [{path: 'task:assignee', operator: '==', value: 'x'}],
      });
    });

    it('preserves unsupported nodes inside the group they were configured in', () => {
      const inLeaf = {path: 'task:name', operator: 'in', value: ['A', 'B']};

      const result = serialize(
        rootGroupOf([{or: [inLeaf, {path: 'task:name', operator: '==', value: 'A'}]}])
      );

      expect(result.hasUnsupportedNodes).toBe(true);
      expect(result.node).toEqual({
        or: [{path: 'task:name', operator: '==', value: 'A'}, inLeaf],
      });
    });

    it('reports unsupported nodes nested deeper in the tree', () => {
      const result = serialize(
        rootGroupOf([{and: [{or: [{path: 'task:name', operator: 'in', value: ['A']}]}]}])
      );

      expect(result.hasUnsupportedNodes).toBe(true);
    });

    it('serializes a group holding nothing but empty rows to nothing', () => {
      const group = createConditionGroup('and', [{key: '', dropdown: '', value: ''}]);

      expect(serialize(group)).toEqual({node: null, hasUnsupportedNodes: false});
    });

    it('leaves a partially filled row out of the node', () => {
      const group = createConditionGroup('and', [
        {key: 'task:name', dropdown: '==', value: 'A'},
        {key: 'task:name', dropdown: '', value: ''},
      ]);

      expect(serialize(group).node).toEqual({
        and: [{path: 'task:name', operator: '==', value: 'A'}],
      });
    });

    it('drops a nested group without complete conditions', () => {
      const group = createConditionGroup('and', [{key: 'task:name', dropdown: '==', value: 'A'}]);
      group.controls.groups.push(createConditionGroup('or', [{key: '', dropdown: '', value: ''}]));

      expect(serialize(group)).toEqual({
        node: {and: [{path: 'task:name', operator: '==', value: 'A'}]},
        hasUnsupportedNodes: false,
      });
    });
  });

  describe('validity', () => {
    it('is valid while every row of every group is complete', () => {
      const group = createConditionGroup('and', [{key: 'task:name', dropdown: '==', value: 'A'}]);
      group.controls.groups.push(createConditionGroup('or'));

      expect(group.valid).toBe(true);
    });

    it('is invalid while a group reports an incomplete row', () => {
      const group = createConditionGroup('and');

      group.controls.rowsComplete.setValue(false);

      expect(group.valid).toBe(false);
    });

    it('is invalid while a nested group reports an incomplete row', () => {
      const group = createConditionGroup('and');
      const nestedGroup = createConditionGroup('or');
      group.controls.groups.push(nestedGroup);

      nestedGroup.controls.rowsComplete.setValue(false);

      expect(group.valid).toBe(false);
    });
  });
});
