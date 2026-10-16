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

/**
 * Starting properties for a new configuration: every non-secret property that declares a
 * `default`. Everything else stays absent, so the schema's `required` check keeps flagging it until
 * the admin fills it in.
 */
function buildExternalPluginPropertiesSkeleton(schema: unknown): Record<string, unknown> {
  return Object.fromEntries(
    schemaProperties(schema)
      .filter(([, property]) => property.default !== undefined && property['x-secret'] !== true)
      .map(([key, property]) => [key, property.default])
  );
}

export {
  ExternalPluginSchemaField,
  externalPluginSchemaFields,
  buildExternalPluginPropertiesSkeleton,
};
