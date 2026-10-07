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
  updateUsagesButton: 'buildingBlockUpdateUsagesButton',
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

export const BUILDING_BLOCK_MANAGEMENT_USAGE_UPDATE_TEST_IDS = {
  modal: 'buildingBlockUsageUpdateModal',
  progressIndicator: 'buildingBlockUsageUpdateProgressIndicator',
  sourceKeyComboBox: 'buildingBlockUsageUpdateSourceKeyComboBox',
  sourceVersionComboBox: 'buildingBlockUsageUpdateSourceVersionComboBox',
  targetKeyComboBox: 'buildingBlockUsageUpdateTargetKeyComboBox',
  targetComboBox: 'buildingBlockUsageUpdateTargetComboBox',
  noSourceVersions: 'buildingBlockUsageUpdateNoSourceVersions',
  draftsNotAllowed: 'buildingBlockUsageUpdateDraftsNotAllowed',
  previewFailed: 'buildingBlockUsageUpdatePreviewFailed',
  retryPreviewButton: 'buildingBlockUsageUpdateRetryPreviewButton',
  chain: 'buildingBlockUsageUpdateChain',
  chainCheckbox: 'buildingBlockUsageUpdateChainCheckbox',
  chainModifiesExistingDraft: 'buildingBlockUsageUpdateChainModifiesExistingDraft',
  chainNotUpdatable: 'buildingBlockUsageUpdateChainNotUpdatable',
  differences: 'buildingBlockUsageUpdateDifferences',
  inputMapping: 'buildingBlockUsageUpdateInputMapping',
  inputValueInput: 'buildingBlockUsageUpdateInputValueInput',
  pluginConfigurationDropdown: 'buildingBlockUsageUpdatePluginConfigurationDropdown',
  droppedMappings: 'buildingBlockUsageUpdateDroppedMappings',
  review: 'buildingBlockUsageUpdateReview',
  confirmCheckbox: 'buildingBlockUsageUpdateConfirmCheckbox',
  result: 'buildingBlockUsageUpdateResult',
  draftLink: 'buildingBlockUsageUpdateDraftLink',
  remainingReferences: 'buildingBlockUsageUpdateRemainingReferences',
  cancelButton: 'buildingBlockUsageUpdateCancelButton',
  backButton: 'buildingBlockUsageUpdateBackButton',
  nextButton: 'buildingBlockUsageUpdateNextButton',
  executeButton: 'buildingBlockUsageUpdateExecuteButton',
  closeButton: 'buildingBlockUsageUpdateCloseButton',
} as const;

export const BUILDING_BLOCK_MANAGEMENT_DETAIL_TEST_IDS = {
  tabs: 'buildingBlockTabs',
} as const;

export const BUILDING_BLOCK_MANAGEMENT_PROCESSES_TEST_IDS = {
  uploadButton: 'buildingBlockProcessesUploadButton',
  createButton: 'buildingBlockProcessesCreateButton',
} as const;

export const BUILDING_BLOCK_MANAGEMENT_PROCESS_UPLOAD_TEST_IDS = {
  fileUploader: 'buildingBlockProcessUploadFileUploader',
  cancelButton: 'buildingBlockProcessUploadCancelButton',
  submitButton: 'buildingBlockProcessUploadSubmitButton',
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

/** Prefix for the options of the usage update wizard's source key combo box: `<prefix><key>`. */
export const BUILDING_BLOCK_USAGE_UPDATE_SOURCE_KEY_OPTION_TEST_ID_PREFIX =
  'buildingBlockUsageUpdateSourceKey-';

/** Prefix for the options of the usage update wizard's source version combo box: `<prefix><key>-<versionTag>`. */
export const BUILDING_BLOCK_USAGE_UPDATE_SOURCE_OPTION_TEST_ID_PREFIX =
  'buildingBlockUsageUpdateSource-';

/** Prefix for the options of the usage update wizard's target key combo box: `<prefix><key>`. */
export const BUILDING_BLOCK_USAGE_UPDATE_TARGET_KEY_OPTION_TEST_ID_PREFIX =
  'buildingBlockUsageUpdateTargetKey-';

/** Prefix for the options of the usage update wizard's target combo box: `<prefix><versionTag>`. */
export const BUILDING_BLOCK_USAGE_UPDATE_TARGET_OPTION_TEST_ID_PREFIX =
  'buildingBlockUsageUpdateTarget-';
