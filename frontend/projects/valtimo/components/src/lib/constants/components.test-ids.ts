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

export const CONFIRMATION_MODAL_TEST_IDS = {
  heading: 'confirmationModalHeading',
  content: 'confirmationModalContent',
  closeButton: 'confirmationModalClose',
  optionalButton: 'confirmationModalOptional',
  confirmButton: 'confirmationModalConfirm',
} as const;

export const SCHEMA_EDITOR_TEST_IDS = {
  editor: 'schemaEditor',
  saveButton: 'schemaEditorSaveButton',
  manageRequiredFieldsButton: 'schemaEditorManageRequiredFieldsButton',
  requiredFieldsPanel: 'schemaEditorRequiredFieldsPanel',
  requiredFieldsPanelCloseButton: 'schemaEditorRequiredFieldsPanelCloseButton',
} as const;

/**
 * Prefix for the required-field checkboxes of the schema editor. The full test id
 * is `schemaEditorRequiredProperty-<dot separated path>`, e.g.
 * `schemaEditorRequiredProperty-applicantName` for a root property and
 * `schemaEditorRequiredProperty-address.street` for a nested one.
 */
export const SCHEMA_EDITOR_REQUIRED_PROPERTY_TEST_ID_PREFIX = 'schemaEditorRequiredProperty-';

export const VALUE_PATH_SELECTOR_TEST_IDS = {
  toggle: 'valuePathSelectorToggle',
  path: 'valueValuePathSelectorPath',
  input: 'valuePathSelectorInput',
} as const;

export const VALUE_CONDITION_TREE_TEST_IDS = {
  addConditionButton: 'valueConditionTreeAddCondition',
  addGroupButton: 'valueConditionTreeAddGroup',
  groupModeSelect: 'valueConditionTreeGroupMode',
  operatorSelect: 'valueConditionTreeOperator',
  removeButton: 'valueConditionTreeRemove',
  valueInput: 'valueConditionTreeValue',
} as const;

export const STEPPER_FOOTER_STEP_TEST_IDS = {
  cancelButton: 'stepperFooterCancelButton',
} as const;

export const JSON_EDITOR_TEST_IDS = {
  cancelButton: 'jsonEditorCancelButton',
  saveButton: 'jsonEditorSaveButton',
  editButton: 'jsonEditorEditButton',
  saveConfirmationModal: 'jsonEditorSaveConfirmationModal',
  cancelConfirmationModal: 'jsonEditorCancelConfirmationModal',
} as const;

export const MULTI_INPUT_TEST_IDS = {
  /** The add button is suffixed with the multi-input's `name`, when one is set. */
  addButton: 'multiInputAddButton',
  addButtonNamed: (name: string) => `multiInputAddButton-${name}`,
  deleteButtonAt: (row: number) => `multiInputDeleteButton-${row}`,
} as const;

export const ARBITRARY_AMOUNT_VALUE_TEST_IDS = {
  input: 'arbitraryAmountInput',
  /**
   * Every cell of an `arbitraryAmount` multi-input renders the same kind of text input, so the
   * bare `input` id matches every cell of every row. Scope it by row and column to address a
   * single cell — `row` is the multi-input row index, `column` the arbitrary value index.
   */
  inputAt: (row: number, column: number) => `arbitraryAmountInput-${row}-${column}`,
} as const;

export const VALUE_PATH_SELECTOR_DROPDOWN_VALUE_TEST_IDS = {
  dropdown: 'valuePathSelectorDropdownValueDropDown',
  valueInput: 'valuePathSelectorDropdownValueValueInput',
} as const;

export const KEY_VALUE_TEST_IDS = {
  keyInput: 'keyValueKeyInput',
  valueInput: 'keyValueValueInput',
} as const;

export const KEY_VALUE_PATH_SELECTOR_TEST_IDS = {
  keyInput: 'keyValuePathSelectorKeyInput',
} as const;

export const VALUE_PATH_SELECTOR_VALUE_TEST_IDS = {
  valueInput: 'valuePathSelectorValueValueInput',
} as const;

export const KEY_DROPDOWN_VALUE_TEST_IDS = {
  keyInput: 'keyDropdownKeyInput',
  dropdown: 'keyDropdownDropdown',
  valueInput: 'keyDropdownValueInput',
} as const;

export const SINGLE_VALUE_TEST_IDS = {
  input: 'singleValueInput',
} as const;

export const AUTO_KEY_INPUT_TEST_IDS = {
  input: 'autoKeyInput',
  editButton: 'autoKeyEditButton',
} as const;

export const RIGHT_SIDEBAR_TEST_IDS = {
  settingsTab: 'rightSidebarSettingsTab',
  languageDropdown: 'rightSidebarLanguageDropdown',
  themeDropdown: 'rightSidebarThemeDropdown',
} as const;

export const COLOR_PICKER_TEST_IDS = {
  label: 'colorPickerLabel',
  container: 'colorPickerContainer',
  trigger: 'colorPickerTrigger',
} as const;

/**
 * The shared `valtimo-search-fields` panel, used by the case list, the object
 * list and the IKO views.
 *
 * The component already carries a few `data-testid` attributes (no dash), which
 * do not match the `data-test-id` attribute Playwright is configured with, so
 * these are bound alongside them rather than replacing them.
 */
export const SEARCH_FIELDS_TEST_IDS = {
  accordionItem: 'searchFieldsAccordionItem',
  clearButton: 'searchFieldsClearButton',
  saveButton: 'searchFieldsSaveButton',
  searchButton: 'searchFieldsSearchButton',
  noFieldsMessage: 'searchFieldsNoFieldsMessage',
} as const;

/**
 * Prefix for one search field of the panel. The full test id is
 * `searchField-<searchFieldKey>`, and it sits on the field *wrapper* — the input
 * itself is one level down.
 */
export const SEARCH_FIELD_TEST_ID_PREFIX = 'searchField-';
