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

import {IncludeFunction, ROLE_ADMIN, ROLE_DEVELOPER, ROLE_USER} from '@valtimo/shared';

/**
 * Where an item is allowed to live in the tree, enforced by the builder's drag-drop validators (not
 * the resolver). `top` = top-level only — the sections/containers (Admin, Development) and the
 * runtime-submenu parents (Cases, Objects), so the menu never nests beyond the two levels it
 * renders. `admin` = only inside the Admin section; `development` = only inside the Development
 * section. `any` = freely placeable at the top level or inside any section (the generic items —
 * custom links, section headers — and plugin pages).
 */
type MenuItemPlacement = 'top' | 'admin' | 'development' | 'any';

/** The "Available items" palette grouping the builder renders. */
type MenuCatalogCategory = 'generic' | 'main' | 'admin' | 'development' | 'plugin-page';

/**
 * One curated, known menu entry. The metadata reuses what the static `environment.ts` menu already
 * encodes for that route (`defaultTitleKey`, `defaultIcon`, `link`, `roles`) and layers on the two
 * things `environment.ts` does not: a [category] and a [placement] constraint, keyed by a stable
 * [itemId]. `roles` is the **inherited access** reused by the existing `MenuService` role filter;
 * it is never edited in the builder.
 */
interface MenuItemCatalogEntry {
  itemId: string;
  defaultTitleKey: string;
  defaultIcon?: string;
  /** Route path (single segment string). Absent for runtime-submenu groups (Cases, Objects) and the Admin/Development containers. */
  link?: string;
  roles: string[];
  includeFunction?: IncludeFunction;
  placement: MenuItemPlacement;
  category: MenuCatalogCategory;
  /** Only `Admin` and `Settings` are required — removing either would lock an admin out of this very page. */
  required?: boolean;
}

/** The text class `environment.ts` uses for the non-link group labels inside Admin. */
const SECTION_HEADER_TEXT_CLASS = 'text-dark font-weight-bold c-default';

/**
 * The curated catalog, seeded from `environment.ts`'s menu. The single source of truth for both the
 * builder's "Available items" panel and the runtime resolver (config JSON + catalog → `MenuItem[]`).
 */
const MENU_ITEM_CATALOG: MenuItemCatalogEntry[] = [
  // Main menu items (top level)
  {
    itemId: 'dashboard',
    defaultTitleKey: 'Dashboard',
    defaultIcon: 'icon mdi mdi-view-dashboard',
    link: '/',
    roles: [ROLE_USER],
    placement: 'top',
    category: 'main',
  },
  {
    itemId: 'cases',
    defaultTitleKey: 'Cases',
    defaultIcon: 'icon mdi mdi-layers',
    roles: [ROLE_USER],
    placement: 'top',
    category: 'main',
  },
  {
    itemId: 'objects',
    defaultTitleKey: 'Objects',
    defaultIcon: 'icon mdi mdi-archive',
    roles: [ROLE_ADMIN],
    includeFunction: IncludeFunction.ObjectManagementEnabled,
    placement: 'top',
    category: 'main',
  },
  {
    itemId: 'tasks',
    defaultTitleKey: 'Tasks',
    defaultIcon: 'icon mdi mdi-check-all',
    link: '/tasks',
    roles: [ROLE_USER],
    placement: 'top',
    category: 'main',
  },
  {
    itemId: 'analysis',
    defaultTitleKey: 'Analysis',
    defaultIcon: 'icon mdi mdi-chart-bar',
    link: '/analysis',
    roles: [ROLE_USER],
    placement: 'top',
    category: 'main',
  },
  {
    itemId: 'teams',
    defaultTitleKey: 'teams.title',
    defaultIcon: 'icon mdi mdi-account-group',
    link: '/teams',
    roles: [ROLE_USER],
    placement: 'top',
    category: 'main',
  },
  {
    itemId: 'admin',
    defaultTitleKey: 'Admin',
    defaultIcon: 'icon mdi mdi-tune',
    roles: [ROLE_ADMIN],
    placement: 'top',
    category: 'main',
    required: true,
  },
  {
    itemId: 'development',
    defaultTitleKey: 'Development',
    defaultIcon: 'icon mdi mdi-xml',
    roles: [ROLE_DEVELOPER, ROLE_ADMIN],
    placement: 'top',
    category: 'main',
  },

  // Admin pages (inside the Admin group)
  {
    itemId: 'adminSettings',
    defaultTitleKey: 'adminSettings.title',
    link: '/admin-settings',
    roles: [ROLE_ADMIN],
    placement: 'admin',
    category: 'admin',
    required: true,
  },
  {
    itemId: 'buildingBlockManagement',
    defaultTitleKey: 'buildingBlockManagement.title',
    link: '/building-block-management',
    roles: [ROLE_ADMIN],
    placement: 'admin',
    category: 'admin',
  },
  {
    itemId: 'caseManagement',
    defaultTitleKey: 'Cases',
    link: '/case-management',
    roles: [ROLE_ADMIN],
    placement: 'admin',
    category: 'admin',
  },
  {
    itemId: 'plugins',
    defaultTitleKey: 'Plugins',
    link: '/plugins',
    roles: [ROLE_ADMIN],
    placement: 'admin',
    category: 'admin',
  },
  {
    itemId: 'dashboardManagement',
    defaultTitleKey: 'Dashboard',
    link: '/dashboard-management',
    roles: [ROLE_ADMIN],
    placement: 'admin',
    category: 'admin',
  },
  {
    itemId: 'accessControl',
    defaultTitleKey: 'Access Control',
    link: '/access-control',
    roles: [ROLE_ADMIN],
    placement: 'admin',
    category: 'admin',
  },
  {
    itemId: 'translationManagement',
    defaultTitleKey: 'Translations',
    link: '/translation-management',
    roles: [ROLE_ADMIN],
    placement: 'admin',
    category: 'admin',
  },
  {
    itemId: 'choiceFields',
    defaultTitleKey: 'Choice fields',
    link: '/choice-fields',
    roles: [ROLE_ADMIN],
    placement: 'admin',
    category: 'admin',
  },
  {
    itemId: 'objectManagement',
    defaultTitleKey: 'Objects',
    link: '/object-management',
    roles: [ROLE_ADMIN],
    placement: 'admin',
    category: 'admin',
  },
  {
    itemId: 'formManagement',
    defaultTitleKey: 'Forms',
    link: '/form-management',
    roles: [ROLE_ADMIN],
    placement: 'admin',
    category: 'admin',
  },
  {
    itemId: 'notifications',
    defaultTitleKey: 'Notifications',
    link: '/notifications-api/notifications/failed',
    roles: [ROLE_ADMIN],
    placement: 'admin',
    category: 'admin',
  },
  {
    itemId: 'processes',
    defaultTitleKey: 'Processes',
    link: '/processes',
    roles: [ROLE_ADMIN],
    placement: 'admin',
    category: 'admin',
  },
  {
    itemId: 'decisionTables',
    defaultTitleKey: 'Decision tables',
    link: '/decision-tables',
    roles: [ROLE_ADMIN],
    placement: 'admin',
    category: 'admin',
  },
  {
    itemId: 'logging',
    defaultTitleKey: 'Logs',
    link: '/logging',
    roles: [ROLE_ADMIN],
    placement: 'admin',
    category: 'admin',
  },
  {
    itemId: 'caseMigration',
    defaultTitleKey: 'Case migration (beta)',
    link: '/case-migration',
    roles: [ROLE_ADMIN],
    placement: 'admin',
    category: 'admin',
  },
  {
    itemId: 'processMigration',
    defaultTitleKey: 'Process migration',
    link: '/process-migration',
    roles: [ROLE_ADMIN],
    placement: 'admin',
    category: 'admin',
  },
  {
    itemId: 'taskManagement',
    defaultTitleKey: 'Tasks (legacy)',
    link: '/task-management',
    roles: [ROLE_ADMIN],
    placement: 'admin',
    category: 'admin',
  },
  {
    itemId: 'notificationTest',
    defaultTitleKey: 'Send notification',
    link: '/notification-test',
    roles: [ROLE_ADMIN],
    placement: 'admin',
    category: 'admin',
  },

  // Development pages (inside the Development group)
  {
    itemId: 'swagger',
    defaultTitleKey: 'Swagger',
    defaultIcon: 'icon mdi mdi-dot-circle',
    link: '/swagger',
    roles: [ROLE_DEVELOPER, ROLE_ADMIN],
    placement: 'development',
    category: 'development',
  },
];

/** Normalises a route for comparison: lower-cased, single leading slash, no trailing slash. */
function normaliseMenuLink(link: string | null | undefined): string {
  if (!link) return '';
  const normalised = ('/' + link.toLowerCase().replace(/^\/+/, '')).replace(/\/+$/, '');
  return normalised === '' ? '/' : normalised;
}

/** Joins a `MenuItem.link` array into the single route string the config stores. */
function menuLinkToString(link: string[] | null | undefined): string {
  return Array.isArray(link) ? link.join('') : '';
}

const _catalogById = new Map(MENU_ITEM_CATALOG.map(entry => [entry.itemId, entry]));

function getMenuCatalogEntry(itemId: string): MenuItemCatalogEntry | undefined {
  return _catalogById.get(itemId);
}

/** Finds the catalog entry whose route matches the given link (linked entries only). */
function findMenuCatalogEntryByLink(
  link: string[] | null | undefined
): MenuItemCatalogEntry | undefined {
  const normalised = normaliseMenuLink(menuLinkToString(link));
  if (!normalised) return undefined;
  return MENU_ITEM_CATALOG.find(
    entry => entry.link && normaliseMenuLink(entry.link) === normalised
  );
}

/**
 * Finds the catalog **group** entry (a top-level item with no link: Cases, Objects, Admin,
 * Development) that matches a runtime menu item's title. Used to seed no-link group items without
 * colliding with same-titled linked Admin pages.
 */
function findMenuCatalogGroupEntryByTitle(title: string): MenuItemCatalogEntry | undefined {
  return MENU_ITEM_CATALOG.find(
    entry => !entry.link && entry.placement === 'top' && entry.defaultTitleKey === title
  );
}

export {
  MenuItemPlacement,
  MenuCatalogCategory,
  MenuItemCatalogEntry,
  MENU_ITEM_CATALOG,
  SECTION_HEADER_TEXT_CLASS,
  normaliseMenuLink,
  menuLinkToString,
  getMenuCatalogEntry,
  findMenuCatalogEntryByLink,
  findMenuCatalogGroupEntryByTitle,
};
