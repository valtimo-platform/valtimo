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

import {AbstractControl, ValidatorFn, ValidationErrors} from '@angular/forms';

/**
 * Custom iban validator for angular forms.
 * Checks if the iban is valid.
 * First move the first four chracters from the beginngin to the end of the string.
 * Change the letter to a numeric representation.
 * Calculate the modulo in a parts, because javascript cannot accuratly calculate the modulus for large numbers.
 *
 * @returns Null if the iban is valid or the value is an empty string, else return an object with isIbanValid property.
 */
export function ibanValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valueString = String(control.value);
    if (valueString.match(/^$/)) {
      return null;
    }
    const rearranged = valueString.substring(4, valueString.length) + valueString.substring(0, 4);
    const numeric = Array.from(rearranged)
      .map(c => (isNaN(parseInt(c, 10)) ? (c.charCodeAt(0) - 55).toString() : c))
      .join('');
    const isValidIban = Array.from(numeric)
      .map(c => parseInt(c, 10))
      .reduce((remainder, value) => (remainder * 10 + value) % 97, 0);
    return isValidIban === 1 ? null : {isIbanValid: 'IBAN voldoet niet'};
  };
}
