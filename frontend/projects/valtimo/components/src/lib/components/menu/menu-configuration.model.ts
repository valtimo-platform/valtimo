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
  includeFunction?: IncludeFunction;
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
