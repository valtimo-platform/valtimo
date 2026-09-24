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

import {pickedInstant, planInstant, toDateTimeLocal} from './migration-schedule.utils';

describe('migration schedule utils', () => {
  const localPickerValue = (instant: string): string => toDateTimeLocal(instant);

  describe('planInstant', () => {
    it('reads an offset-less value as UTC, as the server does', () => {
      expect(planInstant('2026-10-01T16:13:00')).toBe('2026-10-01T16:13:00Z');
      expect(planInstant('2026-10-01T16:13')).toBe('2026-10-01T16:13:00Z');
    });

    it('honours an offset', () => {
      expect(planInstant('2026-10-01T18:13:00+02:00')).toBe('2026-10-01T16:13:00Z');
      expect(planInstant('2026-10-01T16:13:45Z')).toBe('2026-10-01T16:13:45Z');
    });

    it('returns null for nothing or nonsense', () => {
      expect(planInstant(null)).toBeNull();
      expect(planInstant('')).toBeNull();
      expect(planInstant('not a date')).toBeNull();
    });
  });

  describe('toDateTimeLocal', () => {
    it('shows an offset-less plan value at the same moment the server will run it', () => {
      expect(toDateTimeLocal('2026-10-01T16:13:00')).toBe(
        toDateTimeLocal('2026-10-01T16:13:00Z')
      );
    });

    it('round-trips through the picker to the same minute', () => {
      const shown = toDateTimeLocal('2026-10-01T16:13:00Z');

      expect(pickedInstant(shown, null)).toBe('2026-10-01T16:13:00Z');
    });
  });

  describe('pickedInstant', () => {
    it('keeps the loaded seconds while the picker still shows the loaded minute', () => {
      const loaded = '2026-01-01T03:00:45Z';

      expect(pickedInstant(localPickerValue(loaded), loaded)).toBe(loaded);
    });

    it('takes the picked minute once the author changes it', () => {
      const loaded = '2026-01-01T03:00:45Z';

      expect(pickedInstant(localPickerValue('2026-01-01T03:05:00Z'), loaded)).toBe(
        '2026-01-01T03:05:00Z'
      );
    });

    it('returns null when the picker is cleared', () => {
      expect(pickedInstant('', '2026-01-01T03:00:45Z')).toBeNull();
    });
  });
});
