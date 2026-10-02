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

import {TranslateService} from '@ngx-translate/core';
import {resolveStartableItemTitle} from './startable-item-title.util';

/**
 * Stub that mirrors the relevant TranslateService behaviour: it throws on an empty key, and returns
 * the key itself when no translation exists.
 */
function translateServiceStub(translations: Record<string, string> = {}): TranslateService {
  return {
    instant: (key: string) => {
      if (!key) throw new Error('Parameter "key" is required and cannot be empty');
      return translations[key] ?? key;
    },
  } as TranslateService;
}

describe('resolveStartableItemTitle', () => {
  it('returns the translation when the key is translated', () => {
    const translateService = translateServiceStub({'hello-world': 'Hallo wereld'});

    expect(resolveStartableItemTitle(translateService, 'hello-world', 'Hello World')).toBe(
      'Hallo wereld'
    );
  });

  it('falls back to the name when the key has no translation', () => {
    expect(resolveStartableItemTitle(translateServiceStub(), 'hello-world', 'Hello World')).toBe(
      'Hello World'
    );
  });

  it('falls back to the key when there is neither a translation nor a name', () => {
    expect(resolveStartableItemTitle(translateServiceStub(), 'hello-world', null)).toBe(
      'hello-world'
    );
  });

  it('returns the name without translating when the key is empty', () => {
    const translateService = translateServiceStub();
    const instantSpy = spyOn(translateService, 'instant').and.callThrough();

    expect(resolveStartableItemTitle(translateService, '', 'Hello World')).toBe('Hello World');
    expect(resolveStartableItemTitle(translateService, null, 'Hello World')).toBe('Hello World');
    expect(resolveStartableItemTitle(translateService, undefined, 'Hello World')).toBe(
      'Hello World'
    );
    expect(instantSpy).not.toHaveBeenCalled();
  });

  it('returns an empty string when neither a key nor a name is available', () => {
    expect(resolveStartableItemTitle(translateServiceStub(), '', null)).toBe('');
  });
});
