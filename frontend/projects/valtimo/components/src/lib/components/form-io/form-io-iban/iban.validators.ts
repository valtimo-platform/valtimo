import {AbstractControl, ValidatorFn, ValidationErrors} from '@angular/forms';

/**
 * Checks if the iban is valid.
 * First move the first four chracters from the beginngin to the end of the string.
 * Change the letter to a numeric representation.
 * Calculate the modulo in a parts, because javascript cannot accuratly calculate the modulus for large numbers.
 *
 * @returns True if the iban is valid or the value is empty.
 */
export function isValidIban(value: unknown): boolean {
  const valueString = value == null ? '' : String(value);
  if (!valueString) {
    return true;
  }
  const rearranged = valueString.substring(4) + valueString.substring(0, 4);
  const numeric = Array.from(rearranged)
    .map(c => (isNaN(parseInt(c, 10)) ? (c.charCodeAt(0) - 55).toString() : c))
    .join('');
  return (
    Array.from(numeric)
      .map(c => parseInt(c, 10))
      .reduce((remainder, value) => (remainder * 10 + value) % 97, 0) === 1
  );
}

/**
 * Custom iban validator for angular forms.
 *
 * @returns Null if the iban is valid or the value is an empty string, else return an object with isIbanValid property.
 */
export function ibanValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null =>
    isValidIban(control.value) ? null : {isIbanValid: 'IBAN voldoet niet'};
}
