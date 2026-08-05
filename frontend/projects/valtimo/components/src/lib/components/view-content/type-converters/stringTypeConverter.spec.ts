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
import {StringTypeConverter} from './stringTypeConverter';

describe('StringTypeConverter', () => {
  let converter: StringTypeConverter;

  beforeEach(() => {
    converter = new StringTypeConverter();
  });

  it('should return the value when it is not empty', () => {
    expect(converter.convert('My title', {})).toBe('My title');
  });

  it('should return a dash for an empty value by default', () => {
    expect(converter.convert('', {})).toBe('-');
    expect(converter.convert(null, {})).toBe('-');
    expect(converter.convert(undefined, undefined)).toBe('-');
  });

  it('should return the configured placeholder for an empty value', () => {
    expect(converter.convert('', {emptyPlaceholder: ''})).toBe('');
    expect(converter.convert(null, {emptyPlaceholder: ''})).toBe('');
  });

  it('should join an array of strings', () => {
    expect(converter.convert(['first', 'second'], {})).toBe('first, second');
  });
});
