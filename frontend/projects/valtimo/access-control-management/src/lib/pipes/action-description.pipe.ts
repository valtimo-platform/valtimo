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

import {Pipe, PipeTransform} from '@angular/core';
import {TranslateService} from '@ngx-translate/core';

// Resolves a short, human description for a permission action (e.g. "view_list") from
// accessControl.actionDescriptions.<action>. Returns an empty string when no description is
// configured, so callers can hide the tooltip. Impure so it follows runtime language changes.
@Pipe({
  standalone: true,
  name: 'actionDescription',
  pure: false,
})
export class ActionDescriptionPipe implements PipeTransform {
  constructor(private readonly translateService: TranslateService) {}

  public transform(action: string | null | undefined): string {
    if (!action) return '';
    const key = `accessControl.actionDescriptions.${action}`;
    const translated = this.translateService.instant(key);
    return translated === key ? '' : translated;
  }
}
