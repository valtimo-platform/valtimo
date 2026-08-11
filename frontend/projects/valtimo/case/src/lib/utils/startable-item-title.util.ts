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

/**
 * Resolves the display title of a startable item (process or building block): a translation keyed on
 * the item key when one exists, otherwise the item name.
 *
 * The key is guarded because it is not always available (for example while a title is derived from
 * observables that have not emitted yet); `TranslateService.instant` throws on an empty key.
 */
export function resolveStartableItemTitle(
  translateService: TranslateService,
  key: string | null | undefined,
  name: string | null | undefined
): string {
  if (!key) return name ?? '';

  const translated = translateService.instant(key);

  return translated !== key ? translated : name || key;
}
