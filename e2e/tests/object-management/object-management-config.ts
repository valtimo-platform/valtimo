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

export const OBJECT_MANAGEMENT_API = {
  /** Admin CRUD. The management resource only serves GET; this one is the full set. */
  configurations: '/api/v1/object/management/configuration',
  configuration: (id: string) => `/api/v1/object/management/configuration/${id}`,
  /** The slim, PBAC-gated list the user-facing pages read. */
  userConfigurations: '/api/v1/object-management/configuration',
} as const;

/**
 * The object type the tests create.
 *
 * `objecttypeId` is generated per run rather than pointing at a real objecttype:
 * `object_management_configuration` has a unique constraint on the column, so
 * reusing a seeded id makes the insert fail. The tests never read objects
 * through this configuration, so an id that resolves to nothing is fine.
 */
export const TEST_OBJECT_TYPE = {
  titlePrefix: 'E2E Object type',
  /**
   * The title an edit renames to. Deliberately *not* the original title plus a
   * suffix: carbon list rows are matched on substring, so a superstring title
   * would keep matching the original row as well.
   */
  editedTitlePrefix: 'E2E Edited object type',
  objecttypeVersion: '2',
} as const;

/** An objecttype id that is already taken, used by the duplicate failure test. */
export const SEEDED_OBJECT_TYPE = {
  title: 'Bomen',
  objecttypeId: 'feeaa795-d212-4fa2-bb38-2c34996e5702',
} as const;

/**
 * Objecttype ids are UUIDs and must be unique across configurations, so each run
 * makes its own.
 */
export function generateObjecttypeId(seed: string): string {
  const hex = seed.replace(/[^0-9a-f]/gi, '').padEnd(12, '0');
  return `e2e00000-0000-4000-8000-${hex.slice(0, 12)}`;
}

export const OBJECT_MANAGEMENT_TEXTS = {
  /** The overview lists one column only. */
  columns: ['Title'],
  createModalHeading: 'Create objecttype',
  editModalHeading: 'Edit objecttype',
  detailTabs: ['General', 'Search Fields', 'List'],
  visibleInMenuTag: 'Visible in menu',
  /** Required fields of the add/edit modal, in render order. */
  requiredFieldLabels: [
    'Title (required)',
    'Objects API plugin configuration (required)',
    'Objecttypen API plugin configuration (required)',
    'Objecttype ID (required)',
    'Objecttype version (required)',
  ],
} as const;
