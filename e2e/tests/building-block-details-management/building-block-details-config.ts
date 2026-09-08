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

/**
 * The building block the tests operate on. It is created through the API in
 * `beforeAll` with a unique key, because the version lifecycle tests finalize a
 * version — an irreversible action that would leave a shared building block
 * unusable for the next run.
 */
export const TEST_BUILDING_BLOCK = {
  keyPrefix: 'e2e-bb-details',
  /** Suffixed with the same unique id as the key, so no two runs share a name. */
  namePrefix: 'E2E BB Details',
  description: 'Building block created by the e2e building block details test.',
  /** Version created together with the building block; starts out as a draft. */
  initialVersionTag: '1.0.0',
  /** Draft created from the finalized initial version. */
  draftVersionTag: '1.0.1',
} as const;

/** Values entered when saving the metadata form. */
export const UPDATED_METADATA = {
  namePrefix: 'E2E BB Details updated',
  description: 'Description updated by the e2e building block details test.',
} as const;

/**
 * Seeded building block that references plugins — used to assert the "Plugins
 * used" section actually renders the plugins of a building block.
 */
export const SEEDED_BUILDING_BLOCK_WITH_PLUGINS = {
  key: 'upload-and-link-document',
  versionTag: '1.0.0',
  pluginTitles: ['Documenten API', 'Zaken API'],
} as const;

export const ARTWORK_FILE_NAME = 'e2e-building-block-artwork.png';

export const BUILDING_BLOCK_DETAIL_TEXTS = {
  tabs: ['General', 'Document', 'Processes', 'Forms', 'Form flows', 'Decision tables'],
  metadataTitle: 'General information',
  artworkTitle: 'Artwork',
  noPluginsUsed: 'This building block does not use any plugins',
  processColumns: ['Name', 'Key', 'Status', ''],
  mainProcessTag: 'Main process',
  makeFinalAction: 'Make version final',
  createDraftAction: 'Create a new draft',
  finalizeSuccess: 'Draft version has been finalized',
  draftSuccess: 'Draft version created',
  exportStarted: 'Download will start shortly',
  deleteArtworkConfirmation:
    'Are you sure you want to delete this artwork? This action cannot be undone.',
} as const;
