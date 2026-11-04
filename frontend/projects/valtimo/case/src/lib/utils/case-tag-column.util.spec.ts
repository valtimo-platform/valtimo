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

import {mapCaseTagColumnValue} from './case-tag-column.util';

describe('mapCaseTagColumnValue', () => {
  const caseTag = {
    key: 'urgent',
    caseDefinitionKey: 'person',
    caseDefinitionVersionTag: '1.0.0',
    title: 'Urgent',
    color: 'RED',
    order: 0,
  };

  it('converts case tags to carbon tags', () => {
    expect(mapCaseTagColumnValue([caseTag])).toEqual([{content: 'Urgent', type: 'red'}]);
  });

  it('maps multi-word case tag colours to their carbon tag type', () => {
    expect(mapCaseTagColumnValue([{...caseTag, color: 'COOLGRAY'}])).toEqual([
      {content: 'Urgent', type: 'cool-gray'},
    ]);
  });

  it('leaves plain strings untouched', () => {
    expect(mapCaseTagColumnValue(['first', 'second'])).toEqual(['first', 'second']);
  });

  it('leaves values that already are carbon tags untouched', () => {
    const carbonTag = {content: 'Done', type: 'green'};

    expect(mapCaseTagColumnValue([carbonTag])).toEqual([carbonTag]);
  });

  it('leaves objects of another shape untouched', () => {
    const other = {name: 'something'};

    expect(mapCaseTagColumnValue([other])).toEqual([other]);
  });

  it('converts only the case tags in a mixed value', () => {
    expect(mapCaseTagColumnValue([caseTag, 'label'])).toEqual([
      {content: 'Urgent', type: 'red'},
      'label',
    ]);
  });

  it('returns an empty array for an empty array', () => {
    expect(mapCaseTagColumnValue([])).toEqual([]);
  });

  it('returns values that are not arrays as is', () => {
    expect(mapCaseTagColumnValue('label')).toBe('label');
    expect(mapCaseTagColumnValue(null)).toBeNull();
    expect(mapCaseTagColumnValue(undefined)).toBeUndefined();
  });
});
