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
import {REFERENCE_UPDATE_INPUT_SOURCE_PREFIXES} from '../constants';

/** Mirrors the backend: `doc:` or `case:` followed by a non-blank path. */
export function isValidReferenceUpdateInputSource(source: string): boolean {
  const trimmed = source.trim();
  return REFERENCE_UPDATE_INPUT_SOURCE_PREFIXES.some(
    prefix =>
      trimmed.startsWith(prefix) && trimmed.slice(prefix.length).replace(/\//g, '').trim() !== ''
  );
}

/** Empty passes; whether an input is required is decided by the preview. */
export const referenceUpdateInputSourceValidator: ValidatorFn = (
  control: AbstractControl
): ValidationErrors | null => {
  const value: string = control.value ?? '';
  if (!value.trim() || isValidReferenceUpdateInputSource(value)) return null;
  return {invalidInputSource: true};
};
