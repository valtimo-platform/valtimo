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

interface ExternalPluginSchemaField {
  key: string;
  title: string | null;
  description: string | null;
  type: string;
  required: boolean;
  secret: boolean;
  egressTarget: boolean;
}

type SchemaProperty = {
  type?: string | Array<string>;
  title?: string;
  description?: string;
  default?: unknown;
  enum?: Array<unknown>;
  'x-secret'?: boolean;
  'x-egress-target'?: boolean;
};

function schemaProperties(schema: unknown): Array<[string, SchemaProperty]> {
  const properties = (schema as {properties?: Record<string, SchemaProperty>} | null)?.properties;
  return properties && typeof properties === 'object' ? Object.entries(properties) : [];
}

function requiredKeys(schema: unknown): Set<string> {
  const required = (schema as {required?: unknown} | null)?.required;
  return new Set(Array.isArray(required) ? required.filter(k => typeof k === 'string') : []);
}

function typeOf(property: SchemaProperty): string {
  return (Array.isArray(property.type) ? property.type[0] : property.type) ?? 'string';
}

function externalPluginSchemaFields(schema: unknown): Array<ExternalPluginSchemaField> {
  const required = requiredKeys(schema);
  return schemaProperties(schema).map(([key, property]) => ({
    key,
    title: property.title ?? null,
    description: property.description ?? null,
    type: typeOf(property),
    required: required.has(key),
    secret: property['x-secret'] === true,
    egressTarget: property['x-egress-target'] === true,
  }));
}

const EMPTY_VALUE: Record<string, unknown> = {
  string: '',
  boolean: false,
  number: 0,
  integer: 0,
  array: [],
  object: {},
};

/**
 * Starting JSON for a new configuration: every declared property with its default, the first enum
 * value or an empty value of its type — so the admin fills in a form instead of recalling keys.
 */
function buildExternalPluginPropertiesSkeleton(schema: unknown): string {
  const skeleton: Record<string, unknown> = {};
  for (const [key, property] of schemaProperties(schema)) {
    if (property.default !== undefined) {
      skeleton[key] = property.default;
    } else if (Array.isArray(property.enum) && property.enum.length > 0) {
      skeleton[key] = property.enum[0];
    } else if (typeOf(property) in EMPTY_VALUE) {
      skeleton[key] = EMPTY_VALUE[typeOf(property)];
    }
  }
  return JSON.stringify(skeleton, null, 2);
}

export {
  ExternalPluginSchemaField,
  externalPluginSchemaFields,
  buildExternalPluginPropertiesSkeleton,
};
