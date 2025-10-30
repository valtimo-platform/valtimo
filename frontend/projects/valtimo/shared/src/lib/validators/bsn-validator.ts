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

import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function bsnValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value?.toString().trim();

    if (!value) return null;

    // Can only contain digits
    if (!/^\d+$/.test(value)) {
      return { invalidFormat: true };
    }

    // Verify the length
    if (value.length < 8 || value.length > 9) {
      return { invalidLength: true };
    }

    // Cannot be full of zeros or ones
    if (/^0+$/.test(value) || /^9+$/.test(value)) {
      return { invalidSequence: true };
    }

    // BSN check digit validation (11-test)
    const digits = value.split('').map(d => parseInt(d, 10));
    let sum = 0;
    const length = digits.length;

    for (let i = 0; i < length; i++) {
      const weight = (i === length - 1) ? -1 : (length - i);
      sum += digits[i] * weight;
    }

    if (sum % 11 !== 0) {
      return { invalidBsn: true };
    }

    return null;
  };
}
