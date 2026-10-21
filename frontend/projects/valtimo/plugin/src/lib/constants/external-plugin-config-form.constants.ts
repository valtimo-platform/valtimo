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

/** Validation error key → translation key. */
export const EXTERNAL_PLUGIN_CONFIG_FORM_ERROR_TRANSLATION_KEYS: Record<string, string> = {
  required: 'externalPlugin.configForm.errors.required',
  number: 'externalPlugin.configForm.errors.number',
  integer: 'externalPlugin.configForm.errors.integer',
  numberOrExpression: 'externalPlugin.configForm.errors.numberOrExpression',
  integerOrExpression: 'externalPlugin.configForm.errors.integerOrExpression',
  url: 'externalPlugin.configForm.errors.url',
  minlength: 'externalPlugin.configForm.errors.minLength',
  maxlength: 'externalPlugin.configForm.errors.maxLength',
  min: 'externalPlugin.configForm.errors.minimum',
  max: 'externalPlugin.configForm.errors.maximum',
  pattern: 'externalPlugin.configForm.errors.pattern',
};

export const EXTERNAL_PLUGIN_CONFIG_FORM_UNKNOWN_ERROR_TRANSLATION_KEY =
  'externalPlugin.configForm.errors.invalid';

/** `v-input` caps input at 250 characters by default, too short for tokens and secrets. */
export const EXTERNAL_PLUGIN_CONFIG_FORM_MAX_LENGTH = 10_000;

export const EXTERNAL_PLUGIN_CONFIG_FIELD_TYPES: ReadonlyArray<string> = [
  'string',
  'number',
  'integer',
  'boolean',
];

/** Shape beyond flat, typed properties: such a schema keeps the JSON editor. */
export const EXTERNAL_PLUGIN_CONFIG_SCHEMA_COMPOSITION_KEYWORDS: ReadonlyArray<string> = [
  '$ref',
  '$dynamicRef',
  'allOf',
  'anyOf',
  'oneOf',
  'not',
  'if',
  'then',
  'else',
  'const',
  'items',
  'prefixItems',
  'contains',
  'dependentSchemas',
  'dependentRequired',
  'patternProperties',
  'propertyNames',
  'minProperties',
  'maxProperties',
  'unevaluatedItems',
  'unevaluatedProperties',
];

export const EXTERNAL_PLUGIN_CONFIG_SCHEMA_NESTING_KEYWORDS: ReadonlyArray<string> = [
  'properties',
  'additionalProperties',
];

/** A value-resolver expression such as `pv:amount` or `doc:/total`. */
export const EXTERNAL_PLUGIN_VALUE_EXPRESSION_PATTERN = /^[a-z][a-z0-9-]*:\S/i;
