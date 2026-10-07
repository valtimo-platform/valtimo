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
  tabs: 'caseManagementListTabs',
  casesTabPanel: 'caseManagementListCasesTabPanel',
  caseGroupsTabPanel: 'caseManagementListCaseGroupsTabPanel',
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
  labelInput: 'caseStatusLabelInput',
  editKeyButton: 'caseStatusEditKeyButton',
  colorDropdown: 'caseStatusColorDropdown',
  visibilityToggle: 'caseStatusVisibilityToggle',
  cancelButton: 'caseStatusCancelButton',
  addConfirmButton: 'caseStatusAddConfirmButton',
  saveButton: 'caseStatusSaveButton',
} as const;

export const CASE_MANAGEMENT_MIGRATION_TEST_IDS = {
  startButton: 'caseMigrationStartButton',
  dryRunButton: 'caseMigrationDryRunButton',
  dryRunResults: 'caseMigrationDryRunResults',
  warnings: 'caseMigrationWarnings',
  dryRunWarnings: 'caseMigrationDryRunWarnings',
  addButton: 'caseMigrationAddButton',
  saveButton: 'caseMigrationSaveButton',
  cancelButton: 'caseMigrationCancelButton',
  generalTab: 'caseMigrationGeneralTab',
  processMigrationTab: 'caseMigrationProcessMigrationTab',
  dataMigrationTab: 'caseMigrationDataMigrationTab',
  addBuildingBlockTab: 'caseMigrationAddBuildingBlockTab',
  removeBuildingBlockTab: 'caseMigrationRemoveBuildingBlockTab',
  jsonEditorTab: 'caseMigrationJsonEditorTab',
  addPatchButton: 'caseMigrationAddPatchButton',
  deletePatchButton: 'caseMigrationDeletePatchButton',
  addInstructionButton: 'caseMigrationAddInstructionButton',
  deleteInstructionButton: 'caseMigrationDeleteInstructionButton',
  toggleInstructionButton: 'caseMigrationToggleInstructionButton',
  addMappingButton: 'caseMigrationAddMappingButton',
  deleteMappingButton: 'caseMigrationDeleteMappingButton',
  addVariableButton: 'caseMigrationAddVariableButton',
  deleteVariableButton: 'caseMigrationDeleteVariableButton',
  sourceKeySelect: 'caseMigrationSourceKeySelect',
  sourceVersionSelect: 'caseMigrationSourceVersionSelect',
  targetReadout: 'caseMigrationTargetReadout',
  addConditionButton: 'caseMigrationAddConditionButton',
  addConditionGroupButton: 'caseMigrationAddConditionGroupButton',
  addBuildingBlockButton: 'caseMigrationAddBuildingBlockButton',
  removeBuildingBlockButton: 'caseMigrationRemoveBuildingBlockButton',
  deleteBuildingBlockEntryButton: 'caseMigrationDeleteBuildingBlockEntryButton',
  toggleBuildingBlockEntryButton: 'caseMigrationToggleBuildingBlockEntryButton',
  detailModalCloseButton: 'caseMigrationDetailModalCloseButton',
  toggleErrorButton: 'caseMigrationToggleErrorButton',
  copyErrorButton: 'caseMigrationCopyErrorButton',
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

export const CASE_MANAGEMENT_COLOR_TEST_IDS = {
  panel: 'caseColorPanel',
  previewCircle: 'caseColorPreview',
  previewHex: 'caseColorPreviewHex',
  swatch: 'caseColorSwatch',
  customPicker: 'caseColorCustomPicker',
} as const;

export const CASE_DEFINITION_GROUP_LIST_TEST_IDS = {
  createButton: 'caseDefinitionGroupListCreateButton',
} as const;

export const CASE_DEFINITION_GROUP_MODAL_TEST_IDS = {
  modal: 'caseDefinitionGroupModal',
  titleInput: 'caseDefinitionGroupModalTitleInput',
  descriptionInput: 'caseDefinitionGroupModalDescriptionInput',
  cancelButton: 'caseDefinitionGroupModalCancelButton',
  submitButton: 'caseDefinitionGroupModalSubmitButton',
} as const;

export const CASE_DEFINITION_GROUP_DETAIL_TEST_IDS = {
  editButton: 'caseDefinitionGroupEditButton',
  tabs: 'caseDefinitionGroupTabs',
} as const;

export const CASE_DEFINITION_GROUP_CONFIG_TEST_IDS = {
  memberSearch: 'caseDefinitionGroupMemberSearch',
  addCaseButton: 'caseDefinitionGroupAddCaseButton',
  addPanel: 'caseDefinitionGroupAddPanel',
  caseSelect: 'caseDefinitionGroupCaseSelect',
  addToGroupButton: 'caseDefinitionGroupAddToGroupButton',
  memberRow: 'caseDefinitionGroupMemberRow',
  memberOverflowMenu: 'caseDefinitionGroupMemberOverflowMenu',
  removeMemberOption: 'caseDefinitionGroupRemoveMemberOption',
  noMembers: 'caseDefinitionGroupNoMembers',
  noSearchResults: 'caseDefinitionGroupNoMemberSearchResults',
  memberCount: 'caseDefinitionGroupMemberCount',
} as const;

// Shared by the list columns and search fields tabs: one is rendered at a time.
export const CASE_DEFINITION_GROUP_ITEM_LIST_TEST_IDS = {
  list: 'caseDefinitionGroupItemList',
  search: 'caseDefinitionGroupItemSearch',
  addButton: 'caseDefinitionGroupItemAddButton',
  expandedRow: 'caseDefinitionGroupItemExpandedRow',
  emptyState: 'caseDefinitionGroupItemEmptyState',
} as const;

export const CASE_DEFINITION_GROUP_PATH_MAPPING_TEST_IDS = {
  mapping: 'caseDefinitionGroupPathMapping',
  noMembers: 'caseDefinitionGroupPathMappingNoMembers',
} as const;

// Shared by the column and search field modals: one is open at a time.
export const CASE_DEFINITION_GROUP_ITEM_MODAL_TEST_IDS = {
  modal: 'caseDefinitionGroupItemModal',
  titleInput: 'caseDefinitionGroupItemTitleInput',
  pathSearch: 'caseDefinitionGroupItemPathSearch',
  pathCounter: 'caseDefinitionGroupItemPathCounter',
  showOnlyEmptyCheckbox: 'caseDefinitionGroupItemShowOnlyEmptyCheckbox',
  pathRow: 'caseDefinitionGroupItemPathRow',
  noMatchingCaseTypes: 'caseDefinitionGroupItemNoMatchingCaseTypes',
  cancelButton: 'caseDefinitionGroupItemCancelButton',
  saveButton: 'caseDefinitionGroupItemSaveButton',
} as const;

export const CASE_DEFINITION_GROUP_COLUMN_MODAL_TEST_IDS = {
  displayTypeDropdown: 'caseDefinitionGroupColumnDisplayTypeDropdown',
  dateFormatInput: 'caseDefinitionGroupColumnDateFormatInput',
  tagAmountInput: 'caseDefinitionGroupColumnTagAmountInput',
  enumInput: 'caseDefinitionGroupColumnEnumInput',
  sortableCheckbox: 'group-column-sortable-checkbox',
  sortableHint: 'group-column-sortable-hint',
  defaultSortDropdown: 'group-column-default-sort-dropdown',
} as const;

export const CASE_DEFINITION_GROUP_SEARCH_FIELD_MODAL_TEST_IDS = {
  dataTypeDropdown: 'caseDefinitionGroupSearchFieldDataTypeDropdown',
  fieldTypeDropdown: 'caseDefinitionGroupSearchFieldFieldTypeDropdown',
  matchTypeDropdown: 'caseDefinitionGroupSearchFieldMatchTypeDropdown',
  dropdownDataProviderInput: 'caseDefinitionGroupSearchFieldDropdownDataProviderInput',
} as const;
