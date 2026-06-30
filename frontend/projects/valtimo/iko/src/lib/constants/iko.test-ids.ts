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

export const IKO_MANAGEMENT_TEST_IDS = {
  configureServerButton: 'ikoConfigureServerButton',
  uploadButton: 'ikoUploadButton',
} as const;

export const IKO_REPOSITORY_MODAL_TEST_IDS = {
  titleInput: 'ikoRepositoryModalTitleInput',
  saveButton: 'ikoRepositoryModalSaveButton',
  cancelButton: 'ikoRepositoryModalCancelButton',
} as const;

/**
 * Test-id prefixes for the dynamic property form. Each rendered property
 * field appends its `key` to the prefix, so e.g. the URL input on the IKO
 * server modal resolves to `ikoPropertyInput-ikoServerUrl` and the tooltip
 * trigger for the "Connector Reference" view field resolves to
 * `ikoPropertyTooltip-connectorTag`.
 */
export const IKO_PROPERTIES_TEST_IDS = {
  inputPrefix: 'ikoPropertyInput-',
  tooltipPrefix: 'ikoPropertyTooltip-',
  kvKeyPrefix: 'ikoPropertyKvKey-',
  kvValuePrefix: 'ikoPropertyKvValue-',
  kvAddRowPrefix: 'ikoPropertyKvAddRow-',
  kvRemoveRowPrefix: 'ikoPropertyKvRemoveRow-',
} as const;

export const IKO_UPLOAD_MODAL_TEST_IDS = {
  fileUploader: 'ikoUploadFileUploader',
  overwriteCheckbox: 'ikoUploadOverwriteCheckbox',
  startUploadButton: 'ikoUploadStartButton',
  cancelButton: 'ikoUploadCancelButton',
} as const;

export const IKO_VIEW_MANAGEMENT_TEST_IDS = {
  addViewButton: 'ikoAddViewButton',
} as const;

export const IKO_VIEW_MODAL_TEST_IDS = {
  titleInput: 'ikoViewModalTitleInput',
  saveButton: 'ikoViewModalSaveButton',
  cancelButton: 'ikoViewModalCancelButton',
} as const;

export const IKO_LIST_MANAGEMENT_TEST_IDS = {
  addColumnButton: 'ikoAddColumnButton',
} as const;

export const IKO_COLUMN_MODAL_TEST_IDS = {
  titleInput: 'ikoColumnModalTitleInput',
  pathInput: 'ikoColumnModalPathInput',
  sortableToggle: 'ikoColumnModalSortableToggle',
  defaultSortSelect: 'ikoColumnModalDefaultSortSelect',
  displayTypeSelect: 'ikoColumnModalDisplayTypeSelect',
  saveButton: 'ikoColumnModalSaveButton',
  cancelButton: 'ikoColumnModalCancelButton',
} as const;

export const IKO_SEARCH_ACTIONS_TEST_IDS = {
  addActionButton: 'ikoSearchActionAddButton',
} as const;

export const IKO_SEARCH_ACTION_MODAL_TEST_IDS = {
  titleInput: 'ikoSearchActionModalTitleInput',
  saveButton: 'ikoSearchActionModalSaveButton',
  cancelButton: 'ikoSearchActionModalCancelButton',
} as const;

export const IKO_TABS_TEST_IDS = {
  addTabButton: 'ikoTabAddButton',
} as const;

export const IKO_TAB_DETAILS_MODAL_TEST_IDS = {
  titleInput: 'ikoTabModalTitleInput',
  typeSelect: 'ikoTabModalTypeSelect',
  saveButton: 'ikoTabModalSaveButton',
  cancelButton: 'ikoTabModalCancelButton',
} as const;

export const IKO_SEARCH_FIELDS_TEST_IDS = {
  addFieldButton: 'ikoSearchFieldAddButton',
} as const;

export const IKO_SEARCH_FIELD_MODAL_TEST_IDS = {
  titleInput: 'ikoSearchFieldModalTitleInput',
  pathInput: 'ikoSearchFieldModalPathInput',
  dataTypeDropdown: 'ikoSearchFieldModalDataTypeDropdown',
  matchTypeDropdown: 'ikoSearchFieldModalMatchTypeDropdown',
  fieldTypeDropdown: 'ikoSearchFieldModalFieldTypeDropdown',
  requiredToggle: 'ikoSearchFieldModalRequiredToggle',
  saveButton: 'ikoSearchFieldModalSaveButton',
  cancelButton: 'ikoSearchFieldModalCancelButton',
} as const;
