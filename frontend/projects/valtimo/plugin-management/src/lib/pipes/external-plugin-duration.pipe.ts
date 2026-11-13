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
import {isoDurationUnits, parseIsoDuration} from '../utils';

/**
 * Renders an ISO-8601 duration (`PT2H30M`) as localized short text (`2 h 30 min`). Falls back to
 * the raw value when it cannot be parsed. Impure so it follows language changes, like `translate`.
 */
@Pipe({name: 'externalPluginDuration', standalone: true, pure: false})
export class ExternalPluginDurationPipe implements PipeTransform {
  constructor(private readonly _translateService: TranslateService) {}

  public transform(value: string | null | undefined): string {
    if (!value) return '';
    const parts = parseIsoDuration(value);
    if (!parts) return value;
    const units = isoDurationUnits(parts);
    if (units.length === 0) return value;
    return units
      .map(({unit, value: amount}) =>
        this._translateService.instant(`pluginManagement.contracts.durationUnits.${unit}`, {
          value: amount,
        })
      )
      .join(' ');
  }
}
