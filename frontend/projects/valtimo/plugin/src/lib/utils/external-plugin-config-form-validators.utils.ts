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

import {ValidationErrors, ValidatorFn} from '@angular/forms';
import {ExternalPluginConfigField} from '../models/external-plugin-config-form.model';
import {isExternalPluginValueExpression} from './external-plugin-config-form.utils';

const externalPluginRequiredTextValidator: ValidatorFn = control =>
  typeof control.value === 'string' && control.value.trim() !== '' ? null : {required: true};

/** Checks the value as it will be sent: trimmed, except for secrets. */
function externalPluginTextValidator(field: ExternalPluginConfigField, trim: boolean): ValidatorFn {
  const pattern = compilePattern(field.pattern);

  return control => {
    const raw = typeof control.value === 'string' ? control.value : '';
    const value = trim ? raw.trim() : raw;
    if (!value) return null;

    if (field.minLength !== null && value.length < field.minLength) {
      return {minlength: {requiredLength: field.minLength, actualLength: value.length}};
    }
    if (field.maxLength !== null && value.length > field.maxLength) {
      return {maxlength: {requiredLength: field.maxLength, actualLength: value.length}};
    }
    if (pattern && !pattern.test(value)) return {pattern: true};
    if (field.url && !isAbsoluteUrl(value)) return {url: true};
    return null;
  };
}

function externalPluginNumberValidator(field: ExternalPluginConfigField): ValidatorFn {
  return control => {
    const value = control.value;
    if (value === null || value === undefined || value === '') return null;
    if (typeof value !== 'number' || !Number.isFinite(value)) return {number: true};
    if (field.type === 'integer' && !Number.isInteger(value)) return {integer: true};
    return rangeErrors(field, value);
  };
}

/** Action properties: a literal number, or an expression resolved when the action runs. */
function externalPluginNumberTextValidator(field: ExternalPluginConfigField): ValidatorFn {
  const typeError =
    field.type === 'integer' ? {integerOrExpression: true} : {numberOrExpression: true};

  return control => {
    const value = typeof control.value === 'string' ? control.value.trim() : '';
    if (!value || isExternalPluginValueExpression(value)) return null;

    const number = Number(value);
    if (!Number.isFinite(number)) return typeError;
    if (field.type === 'integer' && !Number.isInteger(number)) return typeError;
    return rangeErrors(field, number);
  };
}

function rangeErrors(field: ExternalPluginConfigField, value: number): ValidationErrors | null {
  if (field.minimum !== null && value < field.minimum) {
    return {min: {min: field.minimum, actual: value}};
  }
  if (field.maximum !== null && value > field.maximum) {
    return {max: {max: field.maximum, actual: value}};
  }
  return null;
}

// JSON Schema patterns are unanchored ECMA-262 regular expressions; an invalid one is left to GZAC.
function compilePattern(pattern: string | null): RegExp | null {
  if (!pattern) return null;
  try {
    return new RegExp(pattern, 'u');
  } catch {
    return null;
  }
}

function isAbsoluteUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export {
  externalPluginRequiredTextValidator,
  externalPluginTextValidator,
  externalPluginNumberValidator,
  externalPluginNumberTextValidator,
};
