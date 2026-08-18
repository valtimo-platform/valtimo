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
import {createConditionGroup, serializeConditionGroup, wireNodesToRootGroup} from './index';

describe('task count condition utils', () => {
  function roundTrip(nodes: WireConditionNode[]): WireConditionNode | null {
    return serializeConditionGroup(wireNodesToRootGroup(nodes)).node;
  }

  describe('wireNodesToRootGroup', () => {
    it('reads a legacy flat list of aliased leaves as an AND root group', () => {
      const rootGroup = wireNodesToRootGroup([
        {queryPath: 'task:assignee', queryOperator: '==', queryValue: 'x'},
      ]);

      expect(rootGroup.operator).toBe('and');
      expect(rootGroup.rows).toEqual([{key: 'task:assignee', dropdown: '==', value: 'x'}]);
    });

    it('adopts a single top-level group as the root group, so its operator round-trips', () => {
      const rootGroup = wireNodesToRootGroup([
        {
          or: [
            {path: 'task:name', operator: '==', value: 'A'},
            {path: 'task:name', operator: '==', value: 'B'},
          ],
        },
      ]);

      expect(rootGroup.operator).toBe('or');
      expect(rootGroup.rows.length).toBe(2);
      expect(rootGroup.groups.length).toBe(0);
    });

    it('splits a flat leaf plus a group into root rows and one nested group', () => {
      const rootGroup = wireNodesToRootGroup([
        {path: 'task:assignee', operator: '!=', value: 'x'},
        {or: [{path: 'task:name', operator: '==', value: 'A'}]},
      ]);

      expect(rootGroup.operator).toBe('and');
      expect(rootGroup.rows.length).toBe(1);
      expect(rootGroup.groups.length).toBe(1);
      expect(rootGroup.groups[0].operator).toBe('or');
    });

    it('stringifies non-string scalar values so they fit the row inputs', () => {
      const rootGroup = wireNodesToRootGroup([{path: 'task:priority', operator: '>', value: 50}]);

      expect(rootGroup.rows).toEqual([{key: 'task:priority', dropdown: '>', value: '50'}]);
    });

    it('keeps leaves the row inputs cannot represent out of the rows', () => {
      const arrayValueLeaf = {path: 'task:name', operator: 'in', value: ['A', 'B']};
      const objectValueLeaf = {path: 'task:name', operator: '==', value: {nested: true}};

      const rootGroup = wireNodesToRootGroup([arrayValueLeaf, objectValueLeaf]);

      expect(rootGroup.rows).toEqual([]);
      expect(rootGroup.unsupportedNodes).toEqual([arrayValueLeaf, objectValueLeaf]);
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

      const result = serializeConditionGroup(
        wireNodesToRootGroup([{or: [inLeaf, {path: 'task:name', operator: '==', value: 'A'}]}])
      );

      expect(result.hasUnsupportedNodes).toBe(true);
      expect(result.node).toEqual({
        or: [{path: 'task:name', operator: '==', value: 'A'}, inLeaf],
      });
    });

    it('reports unsupported nodes nested deeper in the tree', () => {
      const result = serializeConditionGroup(
        wireNodesToRootGroup([{and: [{or: [{path: 'task:name', operator: 'in', value: ['A']}]}]}])
      );

      expect(result.hasUnsupportedNodes).toBe(true);
    });

    it('is valid and empty for a group holding nothing but empty rows', () => {
      const group = createConditionGroup('and', [{key: '', dropdown: '', value: ''}]);

      expect(serializeConditionGroup(group)).toEqual({
        node: null,
        valid: true,
        hasUnsupportedNodes: false,
      });
    });

    it('is invalid when a condition row is partially filled', () => {
      const group = createConditionGroup('and', [{key: 'task:name', dropdown: '', value: ''}]);

      const result = serializeConditionGroup(group);

      expect(result.valid).toBe(false);
      expect(result.node).toBeNull();
    });

    it('is invalid when a row of a nested group is partially filled', () => {
      const group = createConditionGroup('and');
      group.groups = [createConditionGroup('or', [{key: '', dropdown: '==', value: ''}])];

      expect(serializeConditionGroup(group).valid).toBe(false);
    });

    it('drops a nested group without complete conditions and stays valid', () => {
      const group = createConditionGroup('and', [{key: 'task:name', dropdown: '==', value: 'A'}]);
      group.groups = [createConditionGroup('or', [{key: '', dropdown: '', value: ''}])];

      expect(serializeConditionGroup(group)).toEqual({
        node: {and: [{path: 'task:name', operator: '==', value: 'A'}]},
        valid: true,
        hasUnsupportedNodes: false,
      });
    });
  });
});
