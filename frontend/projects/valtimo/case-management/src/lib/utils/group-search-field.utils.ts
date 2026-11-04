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

import {AbstractControl, ValidationErrors, ValidatorFn} from '@angular/forms';
import {GROUP_SEARCH_FIELD_SEARCHABLE_PATH_PREFIXES} from '../constants';

export const searchablePathValidator: ValidatorFn = (
  control: AbstractControl
): ValidationErrors | null => {
  const path = (control.value ?? '').trim();
  const isSearchable =
    !path ||
    GROUP_SEARCH_FIELD_SEARCHABLE_PATH_PREFIXES.some(prefix => path.startsWith(`${prefix}:`));
  return isSearchable ? null : {unsupportedPathPrefix: true};
};
