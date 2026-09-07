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

export const USER_OBJECTS_API = {
  /** The slim, PBAC-gated configuration list the user pages read. */
  configurations: '/api/v1/object-management/configuration',
  objects: (objectManagementId: string) =>
    `/api/v1/object-management/configuration/${objectManagementId}/object`,
} as const;

/**
 * The object type these tests read.
 *
 * Resolved by title through the user-facing configuration endpoint rather than
 * by a hardcoded id: only configurations with `showInDataMenu` are returned
 * there, and the seeded ids differ per environment.
 */
export const USER_OBJECT_TYPE = {
  title: 'Bomen',
} as const;

export const USER_OBJECTS_TEXTS = {
  /**
   * Columns of the object list while the type has **no** list columns
   * configured. `ObjectListComponent.setDefaultFields()` falls back to these
   * two; a type with list columns configured renders those instead.
   */
  defaultColumns: ['Record index', 'Object URL'],
  detailTab: 'General',
} as const;
