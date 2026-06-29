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
import {CarbonList, CarbonListRow} from '../../shared/carbon-list/carbon-list.utils';
import {VALUE_PATH_SELECTOR_TEST_IDS} from '../../constants';
import * as ApiUtils from '../../utils/api.utils';
import {ensureDraftVersionSelected} from '../../utils/version.utils';

export class CaseDetailsManagementTasksPage {
  constructor(
    private readonly page: Page,
    private readonly request: APIRequestContext
  ) {}

  // ─── Navigation ───────────────────────────────────────────────────

  async goToCaseManagement(caseIdentifier: string) {
    await this.page.getByRole('button', {name: 'Admin'}).click();
    await this.page.getByRole('link', {name: 'Cases'}).click();
    await this.page.waitForSelector('valtimo-carbon-list');
    await this.page.locator(`tr:has(td:has-text("${caseIdentifier}"))`).click();
  }

  async switchToTasksTab() {
    await this.page.getByRole('tab', {name: 'Tasks'}).click();
  }

  async ensureDraftVersionSelected(): Promise<string> {
    return ensureDraftVersionSelected(this.page);
  }

  async switchToColumnsSubTab() {
    await this.page.getByRole('tab', {name: 'Columns'}).click();
  }

  async switchToSearchFieldsSubTab() {
    await this.page.getByRole('tab', {name: 'Search fields'}).click();
  }

  // ─── Panels ───────────────────────────────────────────────────────

  get columnsPanel() {
    return this.page.getByRole('tabpanel', {name: 'Columns'});
  }

  get searchFieldsPanel() {
    return this.page.getByRole('tabpanel', {name: 'Search fields'});
  }

  get columnsList() {
    return this.columnsPanel.locator('valtimo-carbon-list');
  }

  get searchFieldsList() {
    return this.searchFieldsPanel.locator('valtimo-carbon-list');
  }

  // ─── Column Modal Elements ─────────────────────────────────────────
  // No data-test-ids in column modal — use cds-label + hasText

  get addColumnButton() {
    // Two "Add column" buttons exist when list is empty: toolbar + no-results panel.
    // Scope to toolbar to avoid strict mode violation.
    return this.page.getByLabel('Table action bar').getByRole('button', {name: 'Add column'});
  }

  get columnTitleInput() {
    return this.page.locator('cds-modal').locator('cds-label').filter({hasText: 'Title'}).locator('input');
  }

  get columnKeyInput() {
    return this.page.locator('cds-modal').locator('cds-label').filter({hasText: 'Key'}).locator('input');
  }

  get columnPathInput() {
    return this.page.locator('cds-modal').locator('cds-label').filter({hasText: 'Path'}).locator('input');
  }

  get columnDisplayTypeDropdown() {
    return this.page
      .locator('cds-modal')
      .locator('cds-label')
      .filter({hasText: 'Display type'})
      .locator('cds-dropdown');
  }

  get columnSaveButton() {
    return this.page.locator('cds-modal-footer').getByRole('button', {name: 'Save column'});
  }

  // ─── Search Field Modal Elements ──────────────────────────────────
  // Search field modal uses data-testid attributes

  get addSearchFieldButton() {
    // Two "Add search field" buttons exist when list is empty: toolbar + no-results panel.
    // Scope to toolbar to avoid strict mode violation.
    return this.page.getByLabel('Table action bar').getByRole('button', {name: 'Add search field'});
  }

  get searchFieldKeyInput() {
    return this.page.locator('[data-testid="task-management-search-key"]');
  }

  get searchFieldDataTypeDropdown() {
    return this.page.locator('[data-testid="task-management-search-dataType"]');
  }

  get searchFieldMatchTypeDropdown() {
    return this.page.locator('[data-testid="task-management-search-matchType"]');
  }

  get searchFieldFieldTypeDropdown() {
    return this.page.locator('[data-testid="task-management-search-fieldType"]');
  }

  get searchFieldSaveButton() {
    return this.page.locator('[data-testid="task-management-search-save"]');
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  async selectDropdownItem(dropdownLocator: Locator, itemText: string) {
    await dropdownLocator.click();
    await this.page.getByRole('listbox').getByText(itemText, {exact: true}).click();
    // Verify the dropdown reflects the selection (ensures Angular form control is updated)
    await expect(dropdownLocator).toContainText(itemText);
  }

  // ─── Cleanup ───────────────────────────────────────────────────────

  async cleanupStaleColumns() {
    const staleRowLocator = this.columnsPanel.locator('tbody tr').filter({
      has: this.page.locator('td', {hasText: 'E2e Task Col'}),
    });

    let count = await staleRowLocator.count();
    while (count > 0) {
      const row = new CarbonListRow(this.page, staleRowLocator.first());
      await row.clickAction('Delete');
      await this.page.getByRole('button', {name: 'Delete column'}).click();
      await this.page.waitForTimeout(500);
      count = await staleRowLocator.count();
    }
  }

  // ─── Actions ──────────────────────────────────────────────────────

  async addColumn(column: {title?: string; key: string; path: string; displayType: string}) {
    await this.addColumnButton.click();
    await expect(this.columnKeyInput).toBeVisible();

    if (column.title) {
      await this.columnTitleInput.fill(column.title);
    }
    await this.columnKeyInput.fill(column.key);
    await this.columnPathInput.fill(column.path);
    await this.selectDropdownItem(this.columnDisplayTypeDropdown, column.displayType);
    await expect(this.columnSaveButton).toBeEnabled();
    await this.columnSaveButton.click();
  }

  get searchFieldPathToggle() {
    return this.page
      .locator('valtimo-value-path-selector')
      .getByTestId(VALUE_PATH_SELECTOR_TEST_IDS.toggle)
      .locator('.cds--toggle__switch');
  }

  get searchFieldPathInput() {
    return this.page
      .locator('valtimo-value-path-selector')
      .getByTestId(VALUE_PATH_SELECTOR_TEST_IDS.input);
  }

  async addSearchField(field: {title: string; key: string; path: string; dataType: string; matchType?: string; fieldType: string}) {
    await this.addSearchFieldButton.click();
    await expect(this.searchFieldKeyInput).toBeVisible();
    await this.page.locator('[data-testid="task-management-search-title"]').fill(field.title);
    await this.searchFieldKeyInput.fill(field.key);
    await this.searchFieldPathToggle.click();
    await this.searchFieldPathInput.fill(field.path);
    await this.selectDropdownItem(this.searchFieldDataTypeDropdown, field.dataType);
    if (field.matchType) {
      const matchTypeVisible = await this.searchFieldMatchTypeDropdown.isVisible();
      if (matchTypeVisible) {
        await this.selectDropdownItem(this.searchFieldMatchTypeDropdown, field.matchType);
      }
    }
    await this.selectDropdownItem(this.searchFieldFieldTypeDropdown, field.fieldType);
    await expect(this.searchFieldSaveButton).toBeEnabled();
    await this.searchFieldSaveButton.click();
  }

  async deleteColumn(columnKey: string) {
    const list = new CarbonList(this.page, this.columnsPanel);
    const row = list.row(columnKey);
    await row.clickAction('Delete');
    await this.page.getByRole('button', {name: 'Delete column'}).click();
  }

  async deleteSearchField(fieldKey: string) {
    const list = new CarbonList(this.page, this.searchFieldsPanel);
    const row = list.row(fieldKey);
    await row.clickAction('Delete');
    await this.page.getByRole('button', {name: 'Delete'}).click();
  }

  async getColumnIndexInList(key: string): Promise<number> {
    const list = new CarbonList(this.page, this.columnsPanel);
    const rows = list.rows;
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      const cellCount = await rows.nth(i).locator(`td:has-text("${key}")`).count();
      if (cellCount > 0) return i;
    }
    return -1;
  }

  async dragColumnToPosition(sourceKey: string, targetKey: string) {
    const list = new CarbonList(this.page, this.columnsPanel);
    const sourceRow = list.row(sourceKey);
    const targetRow = list.row(targetKey);
    await list.dragRow(sourceRow, targetRow);
  }

  // ─── Assertions ───────────────────────────────────────────────────

  async assertColumnExists(key: string) {
    await expect(this.columnsPanel.locator(`td:has-text("${key}")`).first()).toBeVisible();
  }

  async assertColumnNotExists(key: string) {
    await expect(this.columnsPanel.locator(`td:has-text("${key}")`)).toHaveCount(0);
  }

  async assertSearchFieldExists(key: string) {
    await expect(this.searchFieldsPanel.locator(`td:has-text("${key}")`).first()).toBeVisible();
  }

  async assertSearchFieldNotExists(key: string) {
    await expect(this.searchFieldsPanel.locator(`td:has-text("${key}")`)).toHaveCount(0);
  }

  // ─── API Cleanup ──────────────────────────────────────────────────

  async deleteColumnViaApi(caseDefinitionKey: string, columnKey: string) {
    try {
      await ApiUtils.apiDelete(
        `/api/management/v1/case/${caseDefinitionKey}/task-list-column/${columnKey}`
      );
    } catch {
      // may already be deleted
    }
  }

  async deleteSearchFieldViaApi(caseDefinitionKey: string, fieldKey: string) {
    try {
      await ApiUtils.apiDelete(
        `/api/v1/search/field/TaskListSearchColumns/${caseDefinitionKey}/${fieldKey}`
      );
    } catch {
      // may already be deleted
    }
  }
}
