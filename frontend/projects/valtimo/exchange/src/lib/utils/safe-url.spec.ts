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

import {httpUrlOrNull} from './safe-url';

describe('httpUrlOrNull', () => {
  it('returns http and https urls', () => {
    expect(httpUrlOrNull('https://example.org/repo')).toBe('https://example.org/repo');
    expect(httpUrlOrNull('http://example.org/')).toBe('http://example.org/');
  });

  it('rejects other protocols', () => {
    expect(httpUrlOrNull('javascript:alert(1)')).toBeNull();
    expect(httpUrlOrNull('data:text/html,<b>x</b>')).toBeNull();
    expect(httpUrlOrNull('ftp://example.org')).toBeNull();
  });

  it('rejects empty and unparseable values', () => {
    expect(httpUrlOrNull(null)).toBeNull();
    expect(httpUrlOrNull(undefined)).toBeNull();
    expect(httpUrlOrNull('')).toBeNull();
    expect(httpUrlOrNull('not a url')).toBeNull();
  });
});
