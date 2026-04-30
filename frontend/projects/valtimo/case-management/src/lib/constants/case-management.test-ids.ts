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

export const CASE_MANAGEMENT_LIST_TEST_IDS = {
  uploadButton: 'caseManagementUploadButton',
  createButton: 'caseManagementCreateButton',
} as const;

export const CASE_MANAGEMENT_DETAIL_TEST_IDS = {
  tabs: 'caseManagementTabs',
} as const;

export const CASE_MANAGEMENT_UPLOAD_TEST_IDS = {
  fileUploader: 'caseFileUploader',
  cancelButton: 'uploadWizardCancelButton',
  nextButton: 'uploadWizardNextButton',
  finishButton: 'uploadWizardFinishButton',
  nameInput: 'importConfigureNameInput',
  versionTag: 'importConfigureVersionTag',
  overrideCheckbox: 'importConfigureOverrideCheckbox',
  pluginMappingRow: 'pluginMappingRow',
  pluginMappingDropdown: 'pluginMappingDropdown',
} as const;

export const CASE_MANAGEMENT_DETAIL_ACTIONS_TEST_IDS = {
  versionSelectDropdown: 'caseVersionSelectDropdown',
  globallyActiveCaseVersion: 'globally-active-case-version',
  versionManagementButton: 'caseVersionManagementButton',
  exportButton: 'caseExportButton',
  setActiveVersionButton: 'caseSetActiveVersionButton',
  moreButton: 'caseMoreButton',
} as const;

export const CASE_MANAGEMENT_CREATE_TEST_IDS = {
  nameInput: 'caseDefinitionNameInput',
  keyInput: 'caseDefinitionKeyInput',
  keyEditButton: 'caseDefinitionKeyEditButton',
  versionInput: 'caseDefinitionVersionInput',
  descriptionInput: 'caseDefinitionDescriptionInput',
  closeButton: 'caseCreateCloseButton',
  saveButton: 'caseCreateSaveButton',
} as const;

export const CASE_MANAGEMENT_STATUSES_TEST_IDS = {
  addButton: 'caseStatusAddButton',
} as const;

export const CASE_MANAGEMENT_EXTERNAL_START_FORM_TEST_IDS = {
  hasExternalForm: 'caseManagementHasExternalForm',
  externalFormUrl: 'caseManagementExternalFormUrl',
  externalFormDescription: 'caseManagementExternalFormDescription',
  externalFormSave: 'caseManagementExternalFormSave',
} as const;

export const CASE_MANAGEMENT_STATUS_MODAL_TEST_IDS = {
  titleInput: 'caseStatusTitleInput',
  keyInput: 'caseStatusKeyInput',
  editKeyButton: 'caseStatusEditKeyButton',
  colorDropdown: 'caseStatusColorDropdown',
  visibilityToggle: 'caseStatusVisibilityToggle',
  cancelButton: 'caseStatusCancelButton',
  addConfirmButton: 'caseStatusAddConfirmButton',
  saveButton: 'caseStatusSaveButton',
} as const;

export const CASE_MANAGEMENT_LIST_COLUMNS_TEST_IDS = {
  columnsList: 'caseListColumnsList',
  jsonEditor: 'listColumnJSONEditor',
  addListColumn: 'caseManagementAddListColumn',
  title: 'listColumnTitle',
  key: 'listColumnKey',
  valuePathSelector: 'listColumnValuePathSelector',
  displayType: 'listColumnDisplayType',
  tagAmount: 'listColumnTagAmount',
  dateFormat: 'listColumnDateFormat',
  multiInput: 'listColumnMultiInput',
  sortableCheckbox: 'listColumnSortableCheckbox',
  defaultSort: 'listColumnDefaultSort',
  exportable: 'listColumnExportable',
  cancelButton: 'listColumnCancelButton',
  saveButton: 'listColumnSaveButton',
  confirmationModal: 'listColumnConfirmationModal',
  switchView: 'listColumnSwitchView',
  downloadButton: 'listColumnDownloadButton',
} as const;

export const CASE_MANAGEMENT_CASE_HANDLER_TEST_IDS = {
  canHaveHandler: 'caseHandlerCanHaveHandler',
  automaticallyAssign: 'caseHandlerAutomaticallyAssign',
} as const;

export const CASE_MANAGEMENT_TAGS_MODAL_TEST_IDS = {
  titleInput: 'caseTagTitleInput',
  keyInput: 'caseTagKeyInput',
  editKeyButton: 'caseTagEditKeyButton',
  colorDropdown: 'caseTagColorDropdown',
  cancelButton: 'caseTagCancelButton',
  addConfirmButton: 'caseTagAddConfirmButton',
  saveButton: 'caseTagSaveButton',
} as const;

export const CASE_MANAGEMENT_TAGS_TEST_IDS = {
  addButton: 'caseTagAddButton',
} as const;

export const CASE_MANAGEMENT_DOCUMENT_TEST_IDS = {
  downloadButton: 'caseManagementDocumentDownloadButton',
} as const;
