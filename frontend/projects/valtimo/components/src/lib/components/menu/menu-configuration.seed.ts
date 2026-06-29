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

import {MenuItem} from '@valtimo/shared';
import {
  CatalogMenuConfigurationItem,
  GroupMenuConfigurationItem,
  MENU_CONFIGURATION_VERSION,
  MenuConfiguration,
  MenuConfigurationItem,
} from './menu-configuration.model';
import {
  findMenuCatalogEntryByLink,
  findMenuCatalogGroupEntryByTitle,
  MenuItemCatalogEntry,
  menuLinkToString,
} from './menu-item-catalog';

/**
 * Maps the **live** runtime menu (`config.menu.menuItems` — whatever an installation actually has,
 * downstream custom links included) into the editable persisted structure. Used both at runtime and
 * in the builder when the DB has no saved config, guaranteeing nothing in the current menu is lost
 * on first open. Round-trip safe with the resolver: `resolve(buildConfigFromRuntimeMenu(menu)) ≈ menu`.
 *
 * - A known route or group → a `catalog` node (title/icon recorded only when they differ from the
 *   catalog default; `roles`/`includeFunction` preserved).
 * - A no-link, non-group label → a `section-header`.
 * - An unmatched link → a `custom-link` (title/link/icon/roles preserved).
 */
function buildMenuConfigurationFromRuntimeMenu(menuItems: MenuItem[]): MenuConfiguration {
  return {
    version: MENU_CONFIGURATION_VERSION,
    items: (menuItems ?? []).map(item => seedMenuItem(item)),
  };
}

function seedMenuItem(item: MenuItem): MenuConfigurationItem {
  const hasLink = Array.isArray(item.link) && item.link.length > 0;

  if (!hasLink) {
    const groupEntry = findMenuCatalogGroupEntryByTitle(item.title);
    if (groupEntry) return seedCatalogNode(item, groupEntry);

    // A no-link item that carries its own children is a custom section (group); one without
    // children is a plain section-header label.
    if (Array.isArray(item.children)) return seedGroupNode(item);

    return {kind: 'section-header', title: item.title};
  }

  const linkEntry = findMenuCatalogEntryByLink(item.link);
  if (linkEntry) return seedCatalogNode(item, linkEntry);

  const customLink: MenuConfigurationItem = {
    kind: 'custom-link',
    title: item.title,
    link: menuLinkToString(item.link),
  };
  if (item.iconClass) customLink.icon = item.iconClass;
  if (item.roles) customLink.roles = item.roles;
  return customLink;
}

function seedGroupNode(item: MenuItem): GroupMenuConfigurationItem {
  const node: GroupMenuConfigurationItem = {kind: 'group', title: item.title};
  if (item.iconClass) node.icon = item.iconClass;
  if (item.roles) node.roles = item.roles;
  node.children = (item.children ?? []).map(child => seedMenuItem(child));
  return node;
}

function seedCatalogNode(item: MenuItem, entry: MenuItemCatalogEntry): CatalogMenuConfigurationItem {
  const node: CatalogMenuConfigurationItem = {kind: 'catalog', itemId: entry.itemId};

  // Record title/icon only when they deviate from the catalog default, keeping the stored tree lean.
  if (item.title && item.title !== entry.defaultTitleKey) node.title = item.title;
  if (item.iconClass && item.iconClass !== entry.defaultIcon) node.icon = item.iconClass;
  if (item.includeFunction !== undefined) node.includeFunction = item.includeFunction;
  if (item.roles) node.roles = item.roles;
  if (Array.isArray(item.children)) node.children = item.children.map(child => seedMenuItem(child));

  return node;
}

export {buildMenuConfigurationFromRuntimeMenu};
