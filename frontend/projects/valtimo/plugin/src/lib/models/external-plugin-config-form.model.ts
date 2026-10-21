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

import {SelectItem} from '@valtimo/components';

type ExternalPluginConfigFieldType = 'string' | 'number' | 'integer' | 'boolean';

/** The `v-input` type rendering a field, or `select` for a `v-select`. */
type ExternalPluginConfigFieldWidget = 'text' | 'password' | 'number' | 'checkbox' | 'select';

/** One input of a flat configuration structure, as the manifest declares it. */
interface ExternalPluginConfigField {
  key: string;
  type: ExternalPluginConfigFieldType;
  required: boolean;
  /** Label and tooltip when the manifest's translations have none. */
  title: string | null;
  description: string | null;
  /** `enum`: rendered as a dropdown of these values. */
  options: Array<string | number> | null;
  secret: boolean;
  /** Must hold an absolute URL: `format: "uri"` or `x-egress-target`. */
  url: boolean;
  minLength: number | null;
  maxLength: number | null;
  minimum: number | null;
  maximum: number | null;
  pattern: string | null;
}

/**
 * A flat configuration structure the generated form renders, with the manifest translations that
 * label it. Labels live under `<prefix>.<key>.label`, `.tooltip` and `.placeholder`; prefixes are
 * tried most specific first.
 */
interface ExternalPluginConfigStructure {
  fields: Array<ExternalPluginConfigField>;
  translations: Record<string, Record<string, string>> | null;
  translationKeyPrefixes: Array<string>;
  /** Action properties: numeric fields also take a value-resolver expression such as `pv:amount`. */
  allowValueExpressions: boolean;
}

interface ExternalPluginConfigFieldOption {
  value: string | number;
  label: string;
}

interface ExternalPluginConfigFieldTexts {
  label: string;
  tooltip: string | null;
  placeholder: string | null;
  options: Array<ExternalPluginConfigFieldOption>;
}

/** A field as the generated form renders it: localised, with the value its input starts from. */
interface ExternalPluginConfigFieldView {
  key: string;
  widget: ExternalPluginConfigFieldWidget;
  required: boolean;
  /** Edit mode: an empty secret keeps the stored one. */
  secretKept: boolean;
  label: string;
  tooltip: string;
  placeholder: string;
  options: Array<SelectItem>;
  inputValue: unknown;
  maxLength: number;
  minimum: number | null;
}

export {
  ExternalPluginConfigFieldType,
  ExternalPluginConfigFieldWidget,
  ExternalPluginConfigField,
  ExternalPluginConfigStructure,
  ExternalPluginConfigFieldOption,
  ExternalPluginConfigFieldTexts,
  ExternalPluginConfigFieldView,
};
