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

import {compareValtimoVersions} from './version-compare';

describe('compareValtimoVersions', () => {
  const cases: Array<[string, string, string]> = [
    ['13', '13.53.0', 'COMPATIBLE'],
    ['13.53.0', '13.53.0', 'COMPATIBLE'],
    ['13.52.9', '13.53.0', 'COMPATIBLE'],
    ['12.99.99', '13.53.0', 'COMPATIBLE'],
    ['13.60.0', '13.53.0', 'NEWER'],
    ['14', '13.53.0', 'NEWER'],
    ['13.53.1', '13.53.0', 'NEWER'],
    ['13.53.0-SNAPSHOT', '13.53.0', 'COMPATIBLE'],
    ['13.54.0+build5', '13.53.0', 'NEWER'],
    ['', '13.53.0', 'UNKNOWN'],
    ['13.53.0', '', 'UNKNOWN'],
    ['abc', '13.53.0', 'UNKNOWN'],
    ['13.x', '13.53.0', 'UNKNOWN'],
  ];

  cases.forEach(([artifact, running, expected]) => {
    it(`${artifact || '(blank)'} against ${running || '(blank)'} is ${expected}`, () => {
      expect(compareValtimoVersions(artifact, running)).toBe(expected as never);
    });
  });

  it('treats missing versions as unknown', () => {
    expect(compareValtimoVersions(null, '13.53.0')).toBe('UNKNOWN');
    expect(compareValtimoVersions('13.53.0', undefined)).toBe('UNKNOWN');
  });
});
