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
 * Translates a key and falls back to the given value when no translation exists (ngx-translate
 * returns the key itself in that case). Used for registry-driven labels where only the well-known
 * entries have translations.
 */
export function translateWithFallback(
  translateService: TranslateService,
  key: string,
  fallback: string
): string {
  const translation = translateService.instant(key);
  return translation === key ? fallback : translation;
}
