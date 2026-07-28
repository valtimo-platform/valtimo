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

export const BUILDING_BLOCK_MANAGEMENT_LIST_TEST_IDS = {
  uploadButton: 'buildingBlockUploadButton',
  createButton: 'buildingBlockCreateButton',
} as const;

export const BUILDING_BLOCK_MANAGEMENT_CREATE_TEST_IDS = {
  nameInput: 'buildingBlockNameInput',
  versionInput: 'buildingBlockVersionInput',
  descriptionInput: 'buildingBlockDescriptionInput',
  cancelButton: 'buildingBlockCreateCancelButton',
  saveButton: 'buildingBlockCreateSaveButton',
} as const;

export const BUILDING_BLOCK_MANAGEMENT_UPLOAD_TEST_IDS = {
  fileUploader: 'buildingBlockFileUploader',
  overwriteWarning: 'buildingBlockOverwriteWarning',
  overwriteCheckbox: 'buildingBlockOverwriteCheckbox',
  progressBar: 'buildingBlockUploadProgressBar',
  cancelButton: 'buildingBlockUploadCancelButton',
  backButton: 'buildingBlockUploadBackButton',
  nextButton: 'buildingBlockUploadNextButton',
  finishButton: 'buildingBlockUploadFinishButton',
} as const;

export const BUILDING_BLOCK_MANAGEMENT_DETAIL_TEST_IDS = {
  tabs: 'buildingBlockTabs',
} as const;

export const BUILDING_BLOCK_MANAGEMENT_METADATA_TEST_IDS = {
  nameInput: 'buildingBlockMetadataNameInput',
  keyInput: 'buildingBlockMetadataKeyInput',
  descriptionInput: 'buildingBlockMetadataDescriptionInput',
  saveButton: 'buildingBlockMetadataSaveButton',
} as const;

export const BUILDING_BLOCK_MANAGEMENT_ARTWORK_TEST_IDS = {
  fileUploader: 'buildingBlockArtworkFileUploader',
  image: 'buildingBlockArtworkImage',
  uploadButton: 'buildingBlockArtworkUploadButton',
  deleteButton: 'buildingBlockArtworkDeleteButton',
} as const;

export const BUILDING_BLOCK_MANAGEMENT_PLUGINS_TEST_IDS = {
  usedPlugins: 'buildingBlockUsedPlugins',
  noPluginsUsed: 'buildingBlockNoPluginsUsed',
} as const;

export const BUILDING_BLOCK_MANAGEMENT_DETAIL_ACTIONS_TEST_IDS = {
  versionSelectDropdown: 'buildingBlockVersionSelectDropdown',
  moreButton: 'buildingBlockMoreButton',
  exportButton: 'buildingBlockExportButton',
  makeFinalButton: 'buildingBlockMakeFinalButton',
  createDraftButton: 'buildingBlockCreateDraftButton',
  draftVersionInput: 'buildingBlockDraftVersionInput',
  draftCancelButton: 'buildingBlockDraftCancelButton',
  draftConfirmButton: 'buildingBlockDraftConfirmButton',
} as const;

/**
 * Prefix for the per-version options of the version dropdown. The full test id is
 * `buildingBlockVersion-<versionTag>`, built in the version selector component.
 */
export const BUILDING_BLOCK_VERSION_OPTION_TEST_ID_PREFIX = 'buildingBlockVersion-';
