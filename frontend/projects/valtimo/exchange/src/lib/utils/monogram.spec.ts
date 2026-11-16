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

import {monogramColorIndex, monogramInitials} from './monogram';

describe('monogram', () => {
  describe('monogramInitials', () => {
    it('uses the initials of up to four words', () => {
      expect(monogramInitials('Aanvraag energietoeslag')).toBe('AEN');
      expect(monogramInitials('Alpha Beta Gamma Delta Epsilon')).toBe('ABGD');
    });

    it('skips Dutch stopwords', () => {
      expect(monogramInitials('Aanvraag van de energietoeslag')).toBe('AEN');
    });

    it('falls back to all words when only stopwords are present', () => {
      expect(monogramInitials('van de')).toBe('VDE');
    });

    it('pads from the last word to three characters', () => {
      expect(monogramInitials('Terugbelnotitie V3')).toBe('TV3');
      expect(monogramInitials('Inkomenstoets')).toBe('INK');
    });

    it('stays short when the title is short', () => {
      expect(monogramInitials('Ab')).toBe('AB');
    });

    it('ignores punctuation around words', () => {
      expect(monogramInitials('Subsidieberekening (Valtimo 14)')).toBe('SV1');
      expect(monogramInitials('Één-loket "aanvraag"')).toBe('ÉAA');
    });

    it('returns a question mark without usable characters', () => {
      expect(monogramInitials('')).toBe('?');
      expect(monogramInitials('  ---  ')).toBe('?');
      expect(monogramInitials(null)).toBe('?');
    });
  });

  describe('monogramColorIndex', () => {
    it('is deterministic and within the palette', () => {
      const index = monogramColorIndex('Inkomenstoets');

      expect(monogramColorIndex('Inkomenstoets')).toBe(index);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(6);
    });

    it('handles empty titles', () => {
      expect(monogramColorIndex('')).toBe(7 % 6);
      expect(monogramColorIndex(null)).toBe(7 % 6);
    });
  });
});
