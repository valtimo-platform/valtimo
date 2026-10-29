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

import {IncludeFunction, MenuItem, ROLE_USER} from '@valtimo/shared';
import {NGXLogger} from 'ngx-logger';
import {
  CatalogMenuConfigurationItem,
  MenuConfiguration,
  MenuConfigurationItem,
  parseIncludeFunction,
} from './menu-configuration.model';
import {
  getMenuCatalogEntry,
  menuLinkToString,
  normaliseMenuLink,
  SECTION_HEADER_TEXT_CLASS,
} from './menu-item-catalog';

/** Route prefix a `plugin-page` node resolves to (handled by the plugin-page route in @valtimo/plugin). */
const PLUGIN_PAGE_ROUTE = '/plugin-pages';

/** A resolved top-level item paired with the persisted node it came from, so required-item checks can match on stable ids. */
interface ResolvedMenuItemPair {
  source: MenuConfigurationItem;
  resolved: MenuItem;
}

/**
 * Resolves a persisted [MenuConfiguration] into the `MenuItem[]` the existing `MenuService`
 * consumes. Catalog nodes fill `link/roles/iconClass/includeFunction/title` from the registry
 * (overrides win); `section-header` → a non-link group label; `custom-link`/`plugin-page` → their
 * stored values. A preserved `roles` set always wins over the catalog default, so migrating a custom
 * item never broadens its access. Required items (Admin, Settings) are forced present so a saved
 * config can never lock an admin out of this page. Unknown catalog ids are skipped with a warning.
 *
 * The optional [logger] is threaded from the caller because this is a plain function (it runs in an
 * `APP_INITIALIZER` before a component tree exists); when absent, warnings fall back to the console.
 */
function resolveMenuConfiguration(
  configuration: MenuConfiguration,
  logger?: NGXLogger
): MenuItem[] {
  const pairs: ResolvedMenuItemPair[] = (configuration?.items ?? [])
    .map(source => ({source, resolved: resolveMenuConfigurationItem(source, logger)}))
    .filter((pair): pair is ResolvedMenuItemPair => pair.resolved !== null);
  return ensureRequiredItems(pairs);
}

function resolveMenuConfigurationItem(
  item: MenuConfigurationItem,
  logger?: NGXLogger
): MenuItem | null {
  switch (item.kind) {
    case 'catalog':
      return resolveCatalogItem(item, logger);
    case 'group': {
      const children = (item.children ?? [])
        .map(child => resolveMenuConfigurationItem(child, logger))
        .filter((child): child is MenuItem => child !== null);
      return buildMenuItem({
        title: item.title,
        iconClass: item.icon,
        roles: item.roles,
        children,
      });
    }
    case 'section-header': {
      const header: MenuItem = {title: item.title, textClass: SECTION_HEADER_TEXT_CLASS};
      if (item.roles) header.roles = item.roles;
      const includeFunction = parseIncludeFunction(item.includeFunction);
      if (includeFunction !== undefined) header.includeFunction = includeFunction;
      return header;
    }
    case 'custom-link':
      return buildMenuItem({
        title: item.title,
        link: stringToLink(item.link),
        iconClass: item.icon,
        roles: item.roles,
      });
    case 'plugin-page':
      // Without a configuration id the entry can never route anywhere — skip it instead of
      // producing a broken menu entry.
      if (!item.configurationId) {
        warn(logger, `Plugin-page menu item "${item.title}" has no configurationId — skipping`);
        return null;
      }
      // TODO: an entry whose external-plugin page target no longer exists (configuration deleted,
      // or the plugin no longer exports the page bundle) still resolves to a dead /plugin-pages
      // route. Detecting that requires the async external-plugin page catalog, which this
      // synchronous resolver cannot access; consider filtering such entries in the caller once the
      // page list is available.
      return buildMenuItem({
        title: item.title,
        link: item.bundleKey
          ? [PLUGIN_PAGE_ROUTE, item.configurationId, item.bundleKey]
          : [PLUGIN_PAGE_ROUTE, item.configurationId],
        iconClass: item.icon,
        roles: item.roles,
      });
    default:
      return null;
  }
}

function resolveCatalogItem(
  item: CatalogMenuConfigurationItem,
  logger?: NGXLogger
): MenuItem | null {
  const entry = getMenuCatalogEntry(item.itemId);
  if (!entry) {
    warn(logger, `Unknown menu catalog itemId "${item.itemId}" — skipping`);
    return null;
  }

  const children = item.children
    ?.map(child => resolveMenuConfigurationItem(child, logger))
    .filter((child): child is MenuItem => child !== null);

  return buildMenuItem({
    title: item.title ?? entry.defaultTitleKey,
    link: stringToLink(entry.link),
    iconClass: item.icon ?? entry.defaultIcon,
    roles: item.roles ?? entry.roles,
    // A required item must never carry an include function — it could hide the item at runtime and
    // lock the admin out of this page, defeating the whole point of marking it required.
    includeFunction: entry.required
      ? undefined
      : (parseIncludeFunction(item.includeFunction) ?? entry.includeFunction),
    children,
  });
}

function resolveCatalogItemById(itemId: string, logger?: NGXLogger): MenuItem | null {
  return resolveCatalogItem({kind: 'catalog', itemId}, logger);
}

/**
 * Forces the required items present so a saved config can never lock an admin out of this page:
 * the Admin section must exist, and the Settings link must be reachable **somewhere** in the menu.
 * Because Settings is now freely placeable (top level or any section), its presence is checked
 * across the whole tree — so moving it out of Admin never causes a duplicate to be injected. A
 * no-op when the saved config already holds both, so a round-tripped current menu is unchanged.
 *
 * The Admin group is matched by its stable catalog `itemId` (via the source config node), never by
 * title — the editor allows renaming, so a renamed Admin group must not trigger a duplicate. The
 * title match only remains as a fallback for the (title-keyed) seed path.
 */
function ensureRequiredItems(pairs: ResolvedMenuItemPair[]): MenuItem[] {
  const result = pairs.map(pair => pair.resolved);

  const adminEntry = getMenuCatalogEntry('admin');
  const settingsEntry = getMenuCatalogEntry('adminSettings');
  if (!adminEntry || !settingsEntry) return result;

  let adminItem =
    // Primary: the persisted node's stable id — robust against title renames.
    pairs.find(pair => pair.source.kind === 'catalog' && pair.source.itemId === 'admin')
      ?.resolved ??
    // Fallback for configs whose Admin section was captured without the catalog id (e.g. seeded as
    // a plain group): recognise it by the catalog's default title on a link-less group.
    result.find(item => item.title === adminEntry.defaultTitleKey && !item.link);

  if (!adminItem) {
    adminItem = buildMenuItem({
      title: adminEntry.defaultTitleKey,
      iconClass: adminEntry.defaultIcon,
      roles: adminEntry.roles,
      children: [],
    });
    result.push(adminItem);
  }

  const settingsLink = normaliseMenuLink(settingsEntry.link);
  if (!menuContainsLink(result, settingsLink)) {
    const settingsItem = resolveCatalogItemById('adminSettings');
    if (settingsItem) adminItem.children = [settingsItem, ...(adminItem.children ?? [])];
  }

  return result;
}

/** Whether the resolved menu contains the given (normalised) link at any depth. */
function menuContainsLink(items: MenuItem[], normalisedLink: string): boolean {
  return items.some(item => {
    if (normaliseMenuLink(menuLinkToString(item.link)) === normalisedLink) return true;
    return Array.isArray(item.children) && menuContainsLink(item.children, normalisedLink);
  });
}

interface MenuItemParts {
  title: string;
  link?: string[];
  iconClass?: string;
  roles?: string[];
  includeFunction?: IncludeFunction;
  children?: MenuItem[];
}

/** Builds a `MenuItem` with only the keys that are actually set, so resolved items match the static menu shape. */
function buildMenuItem(parts: MenuItemParts): MenuItem {
  const item: MenuItem = {title: parts.title};
  const roles = parts.roles ?? [ROLE_USER];
  item.roles = roles;
  if (parts.link) item.link = parts.link;
  if (parts.iconClass) item.iconClass = parts.iconClass;
  if (parts.includeFunction !== undefined) item.includeFunction = parts.includeFunction;
  if (parts.children !== undefined) item.children = parts.children;
  return item;
}

function stringToLink(link: string | null | undefined): string[] | undefined {
  return link ? [link] : undefined;
}

/** Warns via the injected NGXLogger when the caller supplied one, falling back to the console otherwise. */
function warn(logger: NGXLogger | undefined, message: string): void {
  if (logger) {
    logger.warn(message);
  } else {
    console.warn(message);
  }
}

export {resolveMenuConfiguration, PLUGIN_PAGE_ROUTE};
