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

import {
  createDmnXml,
  parseDecisionForm,
  toDecisionFileName,
  toDecisionKey,
  updateDmnXml,
} from './dmn-template';

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe('dmn-template', () => {
  describe('toDecisionKey', () => {
    it('keeps a valid identifier untouched', () => {
      expect(toDecisionKey('eligibility')).toBe('eligibility');
    });

    it('replaces whitespace and invalid characters with underscores', () => {
      expect(toDecisionKey('Eligibility decision')).toBe('Eligibility_decision');
    });

    it('prefixes keys that would start with a digit', () => {
      expect(toDecisionKey('123abc')).toBe('decision_123abc');
    });

    it('falls back to a default key when empty', () => {
      expect(toDecisionKey('   ')).toBe('decision');
    });
  });

  describe('toDecisionFileName', () => {
    it('appends the .dmn extension to the derived key', () => {
      expect(toDecisionFileName('Eligibility decision')).toBe('Eligibility_decision.dmn');
    });
  });

  describe('createDmnXml', () => {
    it('creates one input column per provided input variable with label and expression', () => {
      const {dmnXml} = createDmnXml({
        name: 'D',
        inputVariables: [
          {label: 'Age', expression: 'age'},
          {label: 'Income', expression: 'income'},
        ],
      });

      expect(dmnXml).toContain('label="Age"');
      expect(dmnXml).toContain('<text>age</text>');
      expect(dmnXml).toContain('label="Income"');
      expect(dmnXml).toContain('<text>income</text>');
      expect(countOccurrences(dmnXml, '<input ')).toBe(2);
      expect(countOccurrences(dmnXml, '<inputEntry')).toBe(2);
    });

    it('defaults the label to the process variable when no label is provided', () => {
      const {dmnXml} = createDmnXml({name: 'D', inputVariables: [{label: '', expression: 'age'}]});

      expect(dmnXml).toContain('label="age"');
      expect(dmnXml).toContain('<text>age</text>');
    });

    it('drops rows without a process variable (expression is required)', () => {
      const {dmnXml} = createDmnXml({
        name: 'D',
        inputVariables: [
          {label: 'Age', expression: 'age'},
          {label: 'Orphan label', expression: ''},
        ],
      });

      expect(countOccurrences(dmnXml, '<input ')).toBe(1);
      expect(dmnXml).toContain('label="Age"');
      expect(dmnXml).not.toContain('Orphan label');
    });

    it('drops fully blank rows and keeps a single empty column when none are given', () => {
      const {dmnXml} = createDmnXml({
        name: 'D',
        inputVariables: [
          {label: '', expression: ''},
          {label: '  ', expression: '  '},
        ],
      });

      expect(countOccurrences(dmnXml, '<input ')).toBe(1);
      expect(countOccurrences(dmnXml, '<inputEntry')).toBe(1);
    });

    it('escapes XML-significant characters in label and expression', () => {
      const {dmnXml} = createDmnXml({
        name: 'A & B',
        inputVariables: [{label: 'A & B', expression: 'x < y'}],
      });

      expect(dmnXml).toContain('name="A &amp; B"');
      expect(dmnXml).toContain('label="A &amp; B"');
      expect(dmnXml).toContain('<text>x &lt; y</text>');
    });
  });

  describe('parseDecisionForm', () => {
    it('reads the decision name and input columns (label + expression) back', () => {
      const {dmnXml} = createDmnXml({
        name: 'Discount',
        inputVariables: [
          {label: 'Age', expression: 'age'},
          {label: 'Country', expression: 'country'},
        ],
      });

      const parsed = parseDecisionForm(dmnXml);

      expect(parsed.name).toBe('Discount');
      expect(parsed.inputVariables).toEqual([
        {label: 'Age', expression: 'age'},
        {label: 'Country', expression: 'country'},
      ]);
    });

    it('treats a label equal to the process variable as no explicit label', () => {
      // createDmnXml defaults the label to the expression; parsing should hide that default.
      const {dmnXml} = createDmnXml({name: 'D', inputVariables: [{label: '', expression: 'age'}]});

      expect(parseDecisionForm(dmnXml).inputVariables).toEqual([{label: '', expression: 'age'}]);
    });
  });

  describe('updateDmnXml', () => {
    const baseXml = createDmnXml({
      name: 'Original',
      inputVariables: [{label: 'Age', expression: 'age'}],
    }).dmnXml;

    it('renames the decision while keeping the key', () => {
      const updated = updateDmnXml(baseXml, {
        name: 'Renamed',
        inputVariables: [{label: 'Age', expression: 'age'}],
      });

      expect(updated).toContain('name="Renamed"');
      expect(updated).toContain('id="Original"');
      expect(parseDecisionForm(updated).name).toBe('Renamed');
    });

    it('updates an existing column label and expression in place', () => {
      const updated = updateDmnXml(baseXml, {
        name: 'Original',
        inputVariables: [{label: 'Customer age', expression: 'customerAge'}],
      });

      expect(parseDecisionForm(updated).inputVariables).toEqual([
        {label: 'Customer age', expression: 'customerAge'},
      ]);
    });

    it('adds a column and a blank entry to every rule when a column is added', () => {
      const updated = updateDmnXml(baseXml, {
        name: 'Original',
        inputVariables: [
          {label: 'Age', expression: 'age'},
          {label: 'Income', expression: 'income'},
        ],
      });

      expect(parseDecisionForm(updated).inputVariables).toEqual([
        {label: 'Age', expression: 'age'},
        {label: 'Income', expression: 'income'},
      ]);
      expect(countOccurrences(updated, '<input ')).toBe(2);
      expect(countOccurrences(updated, '<inputEntry')).toBe(2);
    });

    it('removes a column and its rule entries when a column is removed', () => {
      const twoInputs = createDmnXml({
        name: 'D',
        inputVariables: [
          {label: 'Age', expression: 'age'},
          {label: 'Income', expression: 'income'},
        ],
      }).dmnXml;

      const updated = updateDmnXml(twoInputs, {
        name: 'D',
        inputVariables: [{label: 'Age', expression: 'age'}],
      });

      expect(parseDecisionForm(updated).inputVariables).toEqual([
        {label: 'Age', expression: 'age'},
      ]);
      expect(countOccurrences(updated, '<input ')).toBe(1);
      expect(countOccurrences(updated, '<inputEntry')).toBe(1);
    });

    it('preserves the single output column', () => {
      const updated = updateDmnXml(baseXml, {
        name: 'Original',
        inputVariables: [
          {label: 'Age', expression: 'age'},
          {label: 'Income', expression: 'income'},
        ],
      });

      expect(countOccurrences(updated, '<output ')).toBe(1);
      expect(updated).toContain('name="result"');
    });

    it('returns the original xml when it cannot be parsed', () => {
      const garbage = 'not xml at all <<<';
      expect(
        updateDmnXml(garbage, {name: 'X', inputVariables: [{label: 'A', expression: 'a'}]})
      ).toBe(garbage);
    });
  });
});
