import {AbstractControl, ValidationErrors, ValidatorFn} from '@angular/forms';
import moment from 'moment';

/**
 * Custom currency validator for angular forms.
 * Checks if the currency number is valid.
 *
 * @returns Null if the currency number is not valid or the value is an empty string, else return an object with isCurrencyValid property.
 */
export function currencyValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const locale = moment.locale(localStorage.getItem('langKey')) || 'en';
    const currencySymbol = locale === 'en' ? '$' : '€';
    const valueString = String(control.value);
    let formattedValue: string;
    let decimalValue: string;

    if (valueString.match(/^$/)) {
      return null;
    }

    if (locale === 'en') {
      formattedValue = valueString.replace(/[^0-9.]/g, '');
      if (!/^(\d{1,3}\,*)+(\.\d{1,2})?$/.test(formattedValue)) {
        return {invalidCurrency: true};
      }
    } else if (locale === 'nl' || locale === 'de') {
      formattedValue = valueString.replace(/[^0-9,]/g, '');
      if (!/^(\d{1,3}\.*)+(\,\d{1,2})?$/.test(formattedValue)) {
        return {invalidCurrency: true};
      }
      const splitValue = formattedValue.split(',');
      formattedValue = splitValue[0];
      decimalValue = splitValue[1];
    } else {
      return null;
    }

    control.setValue(
      `${currencySymbol}${(+formattedValue).toLocaleString(locale)}${decimalValue ? ',' + decimalValue : ''}`
    );

    return null;
  };
}
