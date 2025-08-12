/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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

import {Injectable} from '@angular/core';
import {cloneDeepWith} from 'lodash';
import {TranslateService} from '@ngx-translate/core';

@Injectable({
  providedIn: 'root',
})
export class FormioTranslationService {
  constructor(private readonly translateService: TranslateService) {}

  public translateFormDefinition(definition: object): object {
    return cloneDeepWith(definition, value => {
      if (typeof value === 'string') {
        if (value.startsWith('translate:')) {
          return this.translateOrFallback(value.substring('translate:'.length));
        }

        if (value.includes('translate:')) {
          return value.replace(/translate:([a-zA-Z0-9_.-]+)/g, (_, key) =>
            this.translateOrFallback(key)
          );
        }
      }

      return undefined;
    });
  }

  private translateOrFallback(key: string): string {
    const translated = this.translateService.instant(key);
    return translated && translated !== key
      ? translated
      : this.translateService.instant('interface.noTranslationFound');
  }
}
