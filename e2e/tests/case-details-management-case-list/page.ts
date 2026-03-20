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

import {APIRequestContext, expect, Locator, Page} from '@playwright/test';
import {CarbonList} from '../../shared/carbon-list/carbon-list.utils';
import {
  CASE_MANAGEMENT_LIST_COLUMNS_TEST_IDS,
  CONFIRMATION_MODAL_TEST_IDS,
  KEY_VALUE_TEST_IDS,
  VALUE_PATH_SELECTOR_TEST_IDS,
} from '../../constants';

export interface UploadCaseOptions {
  archiveName?: string;
}

export class CaseDetailsManagementCaseListPage {
  constructor(
    private readonly page: Page,
    private readonly request: APIRequestContext
  ) {}

  // UI Elements
  get listColumnsTab() {
    return this.page.locator('#caseManagementListColumns-header');
  }

  get searchFieldsTab() {
    return this.page.getByTestId('caseManagementListSearchFields');
  }

  get listTab() {
    return this.page.locator('#case-list-header');
  }

  get caseListColumnsList() {
    return this.page.getByTestId(CASE_MANAGEMENT_LIST_COLUMNS_TEST_IDS.columnsList);
  }

  get addListColumnButton() {
    return this.page.getByTestId(CASE_MANAGEMENT_LIST_COLUMNS_TEST_IDS.addListColumn);
  }

  get titleInput() {
    return this.page.getByTestId(CASE_MANAGEMENT_LIST_COLUMNS_TEST_IDS.title);
  }

  get keyInput() {
    return this.page.getByTestId(CASE_MANAGEMENT_LIST_COLUMNS_TEST_IDS.key);
  }

  get valuePathSelectorToggle() {
    return this.page
      .getByTestId(CASE_MANAGEMENT_LIST_COLUMNS_TEST_IDS.valuePathSelector)
      .getByTestId(VALUE_PATH_SELECTOR_TEST_IDS.toggle)
      .locator('.cds--toggle__switch');
  }

  get valuePathSelectorInput() {
    return this.page
      .getByTestId(CASE_MANAGEMENT_LIST_COLUMNS_TEST_IDS.valuePathSelector)
      .getByTestId(VALUE_PATH_SELECTOR_TEST_IDS.input);
  }

  get valuePathSelectorPath() {
    return this.page
      .getByTestId(CASE_MANAGEMENT_LIST_COLUMNS_TEST_IDS.valuePathSelector)
      .getByTestId(VALUE_PATH_SELECTOR_TEST_IDS.path);
  }

  get displayTypeDropdown() {
    return this.page.getByTestId(CASE_MANAGEMENT_LIST_COLUMNS_TEST_IDS.displayType);
  }

  get tagAmount() {
    return this.page.getByTestId(CASE_MANAGEMENT_LIST_COLUMNS_TEST_IDS.tagAmount);
  }

  get dateFormat() {
    return this.page.getByTestId(CASE_MANAGEMENT_LIST_COLUMNS_TEST_IDS.dateFormat);
  }

  get sortableCheckbox() {
    return this.page.getByTestId(CASE_MANAGEMENT_LIST_COLUMNS_TEST_IDS.sortableCheckbox);
  }

  get defaultSortDropdown() {
    return this.page.getByTestId(CASE_MANAGEMENT_LIST_COLUMNS_TEST_IDS.defaultSort);
  }

  get exportableToggle() {
    return this.page.getByTestId(CASE_MANAGEMENT_LIST_COLUMNS_TEST_IDS.exportable).locator('.cds--toggle__switch');
  }

  get listColumnCancelButton() {
    return this.page.getByTestId(CASE_MANAGEMENT_LIST_COLUMNS_TEST_IDS.cancelButton);
  }

  get listColumnSaveButton() {
    return this.page.getByTestId(CASE_MANAGEMENT_LIST_COLUMNS_TEST_IDS.saveButton);
  }

  get confirmationModalCloseButton() {
    return this.page
      .getByTestId(CASE_MANAGEMENT_LIST_COLUMNS_TEST_IDS.confirmationModal)
      .getByTestId(CONFIRMATION_MODAL_TEST_IDS.closeButton);
  }

  get confirmationModalConfirmButton() {
    return this.page
      .getByTestId(CASE_MANAGEMENT_LIST_COLUMNS_TEST_IDS.confirmationModal)
      .getByTestId(CONFIRMATION_MODAL_TEST_IDS.confirmButton);
  }

  get switchViewButton() {
    return this.page.getByTestId(CASE_MANAGEMENT_LIST_COLUMNS_TEST_IDS.switchView);
  }

  get listColumnJSONEditor() {
    return this.page.getByTestId(CASE_MANAGEMENT_LIST_COLUMNS_TEST_IDS.jsonEditor);
  }

  get downloadButton() {
    return this.page.getByTestId(CASE_MANAGEMENT_LIST_COLUMNS_TEST_IDS.downloadButton);
  }

  private getMultiInputRow(index: number) {
    return this.page.getByTestId(CASE_MANAGEMENT_LIST_COLUMNS_TEST_IDS.multiInput).locator('.v-multi-input__row').nth(index);
  }

  getMultiInputKeyInput(index: number) {
    return this.getMultiInputRow(index).getByTestId(KEY_VALUE_TEST_IDS.keyInput);
  }

  getMultiInputValueInput(index: number) {
    return this.getMultiInputRow(index).getByTestId(KEY_VALUE_TEST_IDS.valueInput);
  }

  getMultiInputDeleteButton(index: number) {
    return this.page
      .getByTestId(CASE_MANAGEMENT_LIST_COLUMNS_TEST_IDS.multiInput)
      .getByTestId(`multiInputDeleteButton-${index}`);
  }

  getMultiInputAddButton() {
    return this.page
      .getByTestId(CASE_MANAGEMENT_LIST_COLUMNS_TEST_IDS.multiInput)
      .locator('.v-multi-input__add-button button');
  }

  // Navigation
  async goToCaseDetailsManagementCaseList(caseIdentifier: string) {
    console.log('Navigate to Case Details Management...');
    await this.page.getByRole('button', {name: 'Admin'}).click();
    await this.page.getByRole('link', {name: 'Cases'}).click();
    await this.page.waitForSelector('valtimo-carbon-list');
    await this.page.locator(`tr:has(td:has-text("${caseIdentifier}"))`).click();
    await this.listTab.click();
  }

  async checkColumnsExisting(columnKeys: string[]) {
    for (let key of columnKeys) {
      await expect(this.page.locator(`td[title="${key}"]`).first()).toBeVisible();
    }
  }

  // UI Column Management helpers

  async selectDropdownItem(dropdownLocator: Locator, itemText: string) {
    await dropdownLocator.click();
    await this.page.getByRole('listbox').getByText(itemText, {exact: true}).click();
  }

  async createColumn(column: {
    title?: string;
    key: string;
    path: string;
    displayType: string;
    sortable?: boolean;
    defaultSort?: string;
    dateFormat?: string;
    enumValues?: Array<{key: string; value: string}>;
    tagAmount?: number;
    exportable?: boolean;
  }) {
    await this.addListColumnButton.click();

    if (column.title) {
      await this.titleInput.fill(column.title);
    }
    await this.keyInput.fill(column.key);

    await this.valuePathSelectorToggle.click();

    await this.valuePathSelectorInput.fill(column.path);

    await this.selectDropdownItem(this.displayTypeDropdown, column.displayType);

    if (column.dateFormat) {
      await this.dateFormat.fill(column.dateFormat);
    }

    if (column.enumValues) {
      for (let i = 0; i < column.enumValues.length; i++) {
        await this.getMultiInputKeyInput(i).fill(column.enumValues[i].key);
        await this.getMultiInputValueInput(i).fill(column.enumValues[i].value);
        if (i < column.enumValues.length - 1) {
          await this.getMultiInputAddButton().click();
        }
      }
    }

    if (column.tagAmount) {
      const incrementButton = this.tagAmount.locator('button').last();
      for (let i = 0; i < column.tagAmount; i++) {
        await incrementButton.click();
      }
    }

    if (column.sortable) {
      await this.sortableCheckbox.locator('label').click();
    }

    if (column.defaultSort) {
      await this.selectDropdownItem(this.defaultSortDropdown, column.defaultSort);
    }

    if (column.exportable) {
      await this.exportableToggle.click();
    }

    await this.listColumnSaveButton.click();
  }

  async editColumnTitle(columnKey: string, newTitle: string) {
    await this.page.locator(`tr:has(td[title="${columnKey}"])`).click();
    await this.titleInput.clear();
    await this.titleInput.fill(newTitle);
    await this.listColumnSaveButton.click();
  }

  async editColumnDefaultSort(columnKey: string, defaultSort: string) {
    await this.page.locator(`tr:has(td[title="${columnKey}"])`).click();
    await this.selectDropdownItem(this.defaultSortDropdown, defaultSort);
    await this.listColumnSaveButton.click();
  }

  async assertDefaultSortDropdownDisabled() {
    await expect(this.defaultSortDropdown.locator('button')).toBeDisabled();
  }

  async deleteColumn(columnKey: string) {
    const list = new CarbonList(this.page);
    const row = list.row(columnKey);
    await row.clickAction('Delete');
    await this.confirmationModalConfirmButton.click();
  }

  async assertColumnExists(columnKey: string) {
    await expect(this.page.locator(`td[title="${columnKey}"]`).first()).toBeVisible();
  }

  async assertColumnNotExists(columnKey: string) {
    await expect(this.page.locator(`td[title="${columnKey}"]`)).toHaveCount(0);
  }

  async assertSaveButtonDisabled() {
    await expect(this.listColumnSaveButton).toBeDisabled();
  }

  async assertSaveButtonEnabled() {
    await expect(this.listColumnSaveButton).toBeEnabled();
  }

  async cancelDelete(columnKey: string) {
    const list = new CarbonList(this.page);
    const row = list.row(columnKey);
    await row.clickAction('Delete');
    await this.confirmationModalCloseButton.click();
  }

  async assertDownloadButtonEnabled() {
    await expect(this.downloadButton).toBeEnabled();
  }

  async assertDownloadButtonDisabled() {
    await expect(this.downloadButton).toBeDisabled();
  }

  private get columnsList() {
    return new CarbonList(this.page, this.caseListColumnsList.locator('..'));
  }

  async dragColumnToPosition(sourceKey: string, targetKey: string) {
    const list = this.columnsList;
    const sourceRow = list.row(sourceKey);
    const targetRow = list.row(targetKey);
    await list.dragRow(sourceRow, targetRow);
  }

  async assertRowOrder(expectedKeys: string[]) {
    const list = this.columnsList;
    for (let i = 0; i < expectedKeys.length; i++) {
      const row = list.rows.nth(i);
      await expect(row).toContainText(expectedKeys[i]);
    }
  }
}
