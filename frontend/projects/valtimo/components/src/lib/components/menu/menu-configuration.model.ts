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

import {IncludeFunction} from '@valtimo/shared';

/** The persisted (string) form of an `IncludeFunction`: the enum member's name. */
type IncludeFunctionName = keyof typeof IncludeFunction;

/**
 * The persisted `includeFunction` value: written as the enum member **name** (stable across enum
 * reorders); legacy configs stored the numeric ordinal, which is still accepted on read via
 * [parseIncludeFunction].
 */
type PersistedIncludeFunction = IncludeFunctionName | IncludeFunction;

/**
 * Maps a **legacy** numeric `includeFunction` ordinal (configs saved before the switch to string
 * names) to the current enum member. The mapping follows the order the members held their ordinals
 * while configs were still persisted numerically: `OpenSearchEnabled` was only inserted (at
 * ordinal 1, shifting `ZgwFeaturesEnabled` from 1 to 2) just before the switch to names, so a
 * persisted `1` almost always predates that insertion and means `ZgwFeaturesEnabled`; a persisted
 * `2` can only come from a post-insertion save and also means `ZgwFeaturesEnabled`.
 */
const LEGACY_INCLUDE_FUNCTION_BY_ORDINAL: Readonly<Record<number, IncludeFunction>> = {
  0: IncludeFunction.ObjectManagementEnabled,
  1: IncludeFunction.ZgwFeaturesEnabled,
  2: IncludeFunction.ZgwFeaturesEnabled,
};

/**
 * Parses a persisted `includeFunction` value — the enum member name (current format) or a legacy
 * numeric ordinal — into the runtime `IncludeFunction`. Unknown values yield `undefined`.
 */
function parseIncludeFunction(
  value: PersistedIncludeFunction | string | number | null | undefined
): IncludeFunction | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'number') return LEGACY_INCLUDE_FUNCTION_BY_ORDINAL[value];
  const parsed = IncludeFunction[value as IncludeFunctionName];
  return typeof parsed === 'number' ? parsed : undefined;
}

/**
 * Serialises a **persisted** include function value (enum name or legacy numeric ordinal) into the
 * enum-name form. Numbers are interpreted as legacy ordinals (see
 * [LEGACY_INCLUDE_FUNCTION_BY_ORDINAL]) — for a *runtime* enum value use [includeFunctionToName].
 */
function serializeIncludeFunction(
  value: PersistedIncludeFunction | string | number | null | undefined
): IncludeFunctionName | undefined {
  const parsed = parseIncludeFunction(value);
  return parsed === undefined ? undefined : includeFunctionToName(parsed);
}

/** The persisted (name) form of a **runtime** `IncludeFunction` value (current enum ordinals, no legacy mapping). */
function includeFunctionToName(value: IncludeFunction): IncludeFunctionName | undefined {
  const name = IncludeFunction[value] as IncludeFunctionName | undefined;
  return typeof name === 'string' ? name : undefined;
}

/** The kinds of node the persisted menu tree can hold. */
type MenuConfigurationItemKind =
  | 'catalog'
  | 'group'
  | 'section-header'
  | 'custom-link'
  | 'plugin-page';

/**
 * Fields every persisted node may carry. `roles` is **preserved, not editable** — captured when the
 * tree is seeded from an existing runtime menu so migrating a custom item never broadens its access
 * (the resolver lets a preserved role set win over the catalog default).
 */
interface MenuConfigurationItemBase {
  roles?: string[];
}

/** A built-in menu entry, identified by a stable catalog `itemId`. */
interface CatalogMenuConfigurationItem extends MenuConfigurationItemBase {
  kind: 'catalog';
  itemId: string;
  title?: string;
  icon?: string;
  includeFunction?: PersistedIncludeFunction;
  children?: MenuConfigurationItem[];
}

/** A custom, admin-created top-level section: a non-link parent that renders as an expandable submenu. */
interface GroupMenuConfigurationItem extends MenuConfigurationItemBase {
  kind: 'group';
  title: string;
  icon?: string;
  children?: MenuConfigurationItem[];
}

/** A non-link group label (rendered with the section-header text class). */
interface SectionHeaderMenuConfigurationItem extends MenuConfigurationItemBase {
  kind: 'section-header';
  title: string;
  includeFunction?: PersistedIncludeFunction;
}

/** A free-form link an admin added (or an unmatched downstream link captured on seed). */
interface CustomLinkMenuConfigurationItem extends MenuConfigurationItemBase {
  kind: 'custom-link';
  title: string;
  link: string;
  icon?: string;
}

/** An external-plugin `page` bundle placed in the menu; opens a routed iframe page. */
interface PluginPageMenuConfigurationItem extends MenuConfigurationItemBase {
  kind: 'plugin-page';
  configurationId: string;
  bundleKey?: string;
  title: string;
  icon?: string;
}

type MenuConfigurationItem =
  | CatalogMenuConfigurationItem
  | GroupMenuConfigurationItem
  | SectionHeaderMenuConfigurationItem
  | CustomLinkMenuConfigurationItem
  | PluginPageMenuConfigurationItem;

/** The persisted, frontend-owned menu structure. */
interface MenuConfiguration {
  version: number;
  items: MenuConfigurationItem[];
}

/** Opaque wrapper as stored/served by the `admin-settings` backend (`{}` when unset). */
interface MenuConfigurationDto {
  configuration: MenuConfiguration | Record<string, never>;
}

/** Current schema version written by this client. */
const MENU_CONFIGURATION_VERSION = 1;

/** Whether a fetched DTO actually holds a usable saved structure (non-empty `items`). */
function hasSavedMenuConfiguration(
  dto: MenuConfigurationDto | null | undefined
): dto is {configuration: MenuConfiguration} {
  const configuration = dto?.configuration as MenuConfiguration | undefined;
  return Array.isArray(configuration?.items) && configuration.items.length > 0;
}

export {
  IncludeFunctionName,
  PersistedIncludeFunction,
  includeFunctionToName,
  parseIncludeFunction,
  serializeIncludeFunction,
  MenuConfigurationItemKind,
  CatalogMenuConfigurationItem,
  GroupMenuConfigurationItem,
  SectionHeaderMenuConfigurationItem,
  CustomLinkMenuConfigurationItem,
  PluginPageMenuConfigurationItem,
  MenuConfigurationItem,
  MenuConfiguration,
  MenuConfigurationDto,
  MENU_CONFIGURATION_VERSION,
  hasSavedMenuConfiguration,
};
