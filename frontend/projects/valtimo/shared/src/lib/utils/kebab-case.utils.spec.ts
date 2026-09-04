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

import {toKebabCase} from './kebab-case.utils';

describe('toKebabCase', () => {
  it('should convert a plain name', () => {
    expect(toKebabCase('Uitvoeren onderzoeksverkenning')).toBe('uitvoeren-onderzoeksverkenning');
  });

  it('should collapse runs of separators and punctuation', () => {
    expect(toKebabCase('Beoordelen   aanvraag / besluit')).toBe('beoordelen-aanvraag-besluit');
  });

  it('should strip diacritics instead of replacing them', () => {
    expect(toKebabCase('Beëindigen coördinatie')).toBe('beeindigen-coordinatie');
  });

  it('should preserve underscores', () => {
    expect(toKebabCase('some_task name')).toBe('some_task-name');
  });

  it('should strip leading characters that are not letters', () => {
    expect(toKebabCase('1. Ontvangen aanvraag')).toBe('ontvangen-aanvraag');
  });

  it('should trim trailing separators', () => {
    expect(toKebabCase('Ontvangen aanvraag - ')).toBe('ontvangen-aanvraag');
  });

  it('should return an empty string when nothing usable remains', () => {
    expect(toKebabCase('123')).toBe('');
    expect(toKebabCase('')).toBe('');
  });

  describe('with a max length', () => {
    it('should leave short input untouched', () => {
      expect(toKebabCase('Korte taak', 64)).toBe('korte-taak');
    });

    it('should truncate on a word boundary', () => {
      const result = toKebabCase('Beoordelen volledigheid aanvraag omgevingsvergunning bouwen', 30);

      expect(result).toBe('beoordelen-volledigheid');
      expect(result.length).toBeLessThanOrEqual(30);
    });

    it('should hard truncate when a word boundary would swallow the text', () => {
      expect(toKebabCase('supercalifragilisticexpialidocious behandelen', 20)).toBe(
        'supercalifragilistic'
      );
    });

    it('should never end on a separator after truncating', () => {
      expect(toKebabCase('abcdefghij klmnop', 11)).toBe('abcdefghij');
    });
  });
});
