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

import {ExternalPluginDefinition, ExternalPluginManifest} from '../models/external-plugin.model';
import {
  ExternalPluginConfigField,
  ExternalPluginConfigFieldTexts,
  ExternalPluginConfigFieldType,
  ExternalPluginConfigStructure,
  ExternalPluginFormMode,
  ExternalPluginFormTarget,
} from '../models/external-plugin-config-form.model';
import {
  EXTERNAL_PLUGIN_CONFIG_FIELD_TYPES,
  EXTERNAL_PLUGIN_CONFIG_SCHEMA_COMPOSITION_KEYWORDS,
  EXTERNAL_PLUGIN_CONFIG_SCHEMA_NESTING_KEYWORDS,
  EXTERNAL_PLUGIN_VALUE_EXPRESSION_PATTERN,
} from '../constants/external-plugin-config-form.constants';

/**
 * The plugin's own bundle when it ships one for the target, else the generated form when the
 * structure is flat and can hold `value`, else the JSON editor — so no stored value is lost.
 */
function resolveExternalPluginFormMode(
  definition: ExternalPluginDefinition,
  target: ExternalPluginFormTarget,
  value: unknown
): ExternalPluginFormMode {
  const bundle = definition.manifest?.frontendBundles?.find(
    ({type, key}) =>
      type === target.type && (target.type === 'config' || !key || key === target.actionKey)
  );
  if (bundle) {
    return {kind: 'bundle', url: `${definition.baseUrl}/${definition.version}${bundle.path}`};
  }

  const structure =
    target.type === 'config'
      ? getExternalPluginConfigurationStructure(definition.configurationSchema, definition.manifest)
      : getExternalPluginActionStructure(definition.manifest, target.actionKey);

  return structure && canRenderExternalPluginConfigValue(structure, value)
    ? {kind: 'form', structure}
    : {kind: 'json'};
}

/**
 * The configuration schema as a flat structure for the generated form, or null when the schema
 * has nested, composed or untyped properties — those keep the JSON editor.
 */
function getExternalPluginConfigurationStructure(
  schema: unknown,
  manifest: ExternalPluginManifest | null | undefined
): ExternalPluginConfigStructure | null {
  const fields = schemaFields(schema);
  if (!fields) return null;

  return {
    fields,
    translations: manifest?.translations ?? null,
    translationKeyPrefixes: ['config'],
    allowValueExpressions: false,
  };
}

/**
 * An action's declared properties as a flat structure, or null when the action declares none or
 * one the form cannot render. Labels resolve under `action.<actionKey>` first, then `action`.
 */
function getExternalPluginActionStructure(
  manifest: ExternalPluginManifest | null | undefined,
  actionKey: string | null | undefined
): ExternalPluginConfigStructure | null {
  const action = actionKey ? manifest?.actions?.find(({key}) => key === actionKey) : undefined;
  const fields = action ? actionFields(action.properties) : null;
  if (!action || !fields) return null;

  return {
    fields,
    translations: manifest?.translations ?? null,
    translationKeyPrefixes: [`action.${action.key}`, 'action'],
    allowValueExpressions: true,
  };
}

/** False for keys the structure does not declare or values its inputs cannot hold. */
function canRenderExternalPluginConfigValue(
  structure: ExternalPluginConfigStructure,
  value: unknown
): boolean {
  if (value === null || value === undefined) return true;
  if (!isPlainObject(value)) return false;

  return Object.entries(value).every(([key, entry]) => {
    const field = structure.fields.find(candidate => candidate.key === key);
    return !!field && fitsField(field, entry, structure.allowValueExpressions);
  });
}

/** Localised from the manifest: active language, then `en`, then the schema's own strings. */
function getExternalPluginConfigFieldTexts(
  structure: ExternalPluginConfigStructure,
  field: ExternalPluginConfigField,
  lang: string
): ExternalPluginConfigFieldTexts {
  const text = (suffix: string): string | null =>
    manifestText(structure, `${field.key}.${suffix}`, lang);

  return {
    label: text('label') ?? field.title ?? field.key,
    tooltip: text('tooltip') ?? field.description,
    placeholder: text('placeholder'),
    options: (field.options ?? []).map(value => ({
      value,
      label: text(`options.${value}`) ?? String(value),
    })),
  };
}

function isExternalPluginValueExpression(value: unknown): value is string {
  return typeof value === 'string' && EXTERNAL_PLUGIN_VALUE_EXPRESSION_PATTERN.test(value);
}

function schemaFields(schema: unknown): Array<ExternalPluginConfigField> | null {
  if (!isPlainObject(schema) || !isPlainObject(schema['properties'])) return null;
  if (schema['type'] !== undefined && schema['type'] !== 'object') return null;
  if (isPlainObject(schema['additionalProperties'])) return null;
  if (hasAnyKeyword(schema, EXTERNAL_PLUGIN_CONFIG_SCHEMA_COMPOSITION_KEYWORDS)) return null;

  const required = Array.isArray(schema['required']) ? schema['required'] : [];
  const fields: Array<ExternalPluginConfigField> = [];

  for (const [key, property] of Object.entries(schema['properties'])) {
    const field = schemaField(key, property, required.includes(key));
    if (!field) return null;
    fields.push(field);
  }

  return fields;
}

function schemaField(
  key: string,
  property: unknown,
  required: boolean
): ExternalPluginConfigField | null {
  if (!isPlainObject(property)) return null;
  if (
    hasAnyKeyword(property, EXTERNAL_PLUGIN_CONFIG_SCHEMA_NESTING_KEYWORDS) ||
    hasAnyKeyword(property, EXTERNAL_PLUGIN_CONFIG_SCHEMA_COMPOSITION_KEYWORDS)
  ) {
    return null;
  }

  const type = fieldType(property['type']);
  if (!type) return null;

  let options: Array<string | number> | null = null;
  if (property['enum'] !== undefined) {
    options = enumOptions(property['enum'], type);
    if (!options) return null;
  }

  return {
    ...plainField(key, type, required),
    title: stringOrNull(property['title']),
    description: stringOrNull(property['description']),
    options,
    secret: property['x-secret'] === true,
    url: property['format'] === 'uri' || property['x-egress-target'] === true,
    minLength: numberOrNull(property['minLength']),
    maxLength: numberOrNull(property['maxLength']),
    minimum: numberOrNull(property['minimum']),
    maximum: numberOrNull(property['maximum']),
    pattern: stringOrNull(property['pattern']),
  };
}

function actionFields(properties: unknown): Array<ExternalPluginConfigField> | null {
  if (!Array.isArray(properties)) return null;

  const fields: Array<ExternalPluginConfigField> = [];

  for (const property of properties) {
    if (!isPlainObject(property)) return null;

    const key = property['key'];
    const type = fieldType(property['type']);
    if (typeof key !== 'string' || !key || !type) return null;
    if (fields.some(field => field.key === key)) return null;

    fields.push(plainField(key, type, property['required'] === true));
  }

  return fields;
}

function plainField(
  key: string,
  type: ExternalPluginConfigFieldType,
  required: boolean
): ExternalPluginConfigField {
  return {
    key,
    type,
    required,
    title: null,
    description: null,
    options: null,
    secret: false,
    url: false,
    minLength: null,
    maxLength: null,
    minimum: null,
    maximum: null,
    pattern: null,
  };
}

// `["string", "null"]` is a nullable string; any other union keeps the JSON editor.
function fieldType(type: unknown): ExternalPluginConfigFieldType | null {
  const types = (Array.isArray(type) ? type : [type]).filter(candidate => candidate !== 'null');
  const [single] = types;
  const supported =
    types.length === 1 &&
    typeof single === 'string' &&
    EXTERNAL_PLUGIN_CONFIG_FIELD_TYPES.includes(single);

  return supported ? (single as ExternalPluginConfigFieldType) : null;
}

function enumOptions(
  values: unknown,
  type: ExternalPluginConfigFieldType
): Array<string | number> | null {
  if (!Array.isArray(values) || type === 'boolean') return null;

  const options = [...new Set(values.filter(value => value !== null))];
  const fit = options.every(value => {
    if (type === 'string') return typeof value === 'string';
    if (type === 'integer') return Number.isInteger(value);
    return typeof value === 'number' && Number.isFinite(value);
  });

  return options.length > 0 && fit ? (options as Array<string | number>) : null;
}

function fitsField(
  field: ExternalPluginConfigField,
  value: unknown,
  allowValueExpressions: boolean
): boolean {
  if (value === null || value === undefined) return true;
  if (field.options) return field.options.includes(value as string | number);

  switch (field.type) {
    case 'string':
      return typeof value === 'string';
    case 'boolean':
      return typeof value === 'boolean';
    case 'integer':
      return (
        Number.isInteger(value) || (allowValueExpressions && isExternalPluginValueExpression(value))
      );
    default:
      return (
        (typeof value === 'number' && Number.isFinite(value)) ||
        (allowValueExpressions && isExternalPluginValueExpression(value))
      );
  }
}

function manifestText(
  structure: ExternalPluginConfigStructure,
  keySuffix: string,
  lang: string
): string | null {
  const locales = !lang || lang === 'en' ? ['en'] : [lang, 'en'];

  for (const locale of locales) {
    for (const prefix of structure.translationKeyPrefixes) {
      const text = structure.translations?.[locale]?.[`${prefix}.${keySuffix}`];
      if (typeof text === 'string' && text.length > 0) return text;
    }
  }

  return null;
}

function hasAnyKeyword(schema: Record<string, unknown>, keywords: ReadonlyArray<string>): boolean {
  return keywords.some(keyword => keyword in schema);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export {
  resolveExternalPluginFormMode,
  getExternalPluginConfigurationStructure,
  getExternalPluginActionStructure,
  canRenderExternalPluginConfigValue,
  getExternalPluginConfigFieldTexts,
  isExternalPluginValueExpression,
};
