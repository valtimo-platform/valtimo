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

import {isoDurationUnits, parseIsoDuration} from './iso-duration.util';

describe('parseIsoDuration', () => {
  it('parses hours, minutes and seconds', () => {
    expect(parseIsoDuration('PT2H30M15S')).toEqual({days: 0, hours: 2, minutes: 30, seconds: 15});
  });

  it('folds weeks into days', () => {
    expect(parseIsoDuration('P1W2D')).toEqual({days: 9, hours: 0, minutes: 0, seconds: 0});
  });

  it('rejects calendar units, a bare designator and garbage', () => {
    expect(parseIsoDuration('P1M')).toBeNull();
    expect(parseIsoDuration('P')).toBeNull();
    expect(parseIsoDuration('PT')).toBeNull();
    expect(parseIsoDuration('2 hours')).toBeNull();
    expect(parseIsoDuration(null)).toBeNull();
  });

  it('lists only non-zero units in display order', () => {
    expect(isoDurationUnits(parseIsoDuration('P1DT0H5M')!)).toEqual([
      {unit: 'days', value: 1},
      {unit: 'minutes', value: 5},
    ]);
  });
});
