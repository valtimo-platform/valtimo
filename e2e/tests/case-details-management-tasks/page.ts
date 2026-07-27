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
    await this.page.goto('/case-management');
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
    // Label comes from listColumn.addButtonText ("Create column").
    // Two of these exist when the list is empty: toolbar + no-results panel.
    // Scope to toolbar to avoid strict mode violation.
    return this.page
      .getByLabel('Table action bar')
      .getByRole('button', {name: 'Create column', exact: true});
  }

  get columnTitleInput() {
    return this.page.locator('cds-modal').locator('cds-label').filter({hasText: 'Title'}).locator('input');
  }

  get columnKeyInput() {
    return this.page.locator('cds-modal').locator('cds-label').filter({hasText: 'Key'}).locator('input');
  }

  // Path uses valtimo-value-path-selector, which defaults to dropdown mode.
  // The manual text input (where an arbitrary path can be typed) only renders
  // after toggling to manual mode.
  get columnPathToggle() {
    return this.page
      .locator('cds-modal')
      .locator('valtimo-value-path-selector')
      .getByTestId(VALUE_PATH_SELECTOR_TEST_IDS.toggle)
      .locator('.cds--toggle__switch');
  }

  get columnPathInput() {
    return this.page
      .locator('cds-modal')
      .locator('valtimo-value-path-selector')
      .getByTestId(VALUE_PATH_SELECTOR_TEST_IDS.input);
  }

  get columnDisplayTypeDropdown() {
    return this.page
      .locator('cds-modal')
      .locator('cds-label')
      .filter({hasText: 'Display type'})
      .locator('cds-dropdown');
  }

  // The column modal's primary button is label-switched on mode:
  // add -> interface.create ("Create"), edit -> listColumn.save ("Save column").
  // Only the add flow is exercised here.
  get columnSaveButton() {
    return this.page
      .locator('cds-modal-footer')
      .getByRole('button', {name: 'Create', exact: true});
  }

  // ─── Search Field Modal Elements ──────────────────────────────────
  // Search field modal uses data-testid attributes

  get addSearchFieldButton() {
    // Label comes from searchFieldsOverview.add ("Create search field").
    // Two of these exist when the list is empty: toolbar + no-results panel.
    // Scope to toolbar to avoid strict mode violation.
    return this.page
      .getByLabel('Table action bar')
      .getByRole('button', {name: 'Create search field', exact: true});
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

  // The value-path-selector toggles to manual mode and runs a setTimeout(detectChanges, 1)
  // before the manual <input> is wired to the parent form. Filling immediately can land the
  // value before the CVA subscription is active, so the required `path` control never commits
  // and the Save button stays disabled. Re-fill until the input actually holds the value.
  private async fillValuePathManually(toggle: Locator, input: Locator, path: string) {
    await toggle.click();
    await expect(input).toBeVisible();
    await expect(async () => {
      await input.fill(path);
      await input.blur();
      await expect(input).toHaveValue(path);
    }).toPass({timeout: 10_000});
  }

  // Both task-management modals schedule a deferred wipe of their reactive form:
  //   task-management-column-modal:        set show(false) -> setTimeout(resetForm, 240ms)
  //   task-management-search-fields-modal: resetForm()     -> setTimeout(form.reset(), 240ms)
  // (240ms = CARBON_CONSTANTS.modalAnimationMs). When the modal is reopened before
  // that timer fires, the pending reset lands mid-fill and nulls whatever has already
  // been typed — leaving the required control empty and the submit button disabled.
  // Re-fill only what does not already hold the expected value, until everything sticks.
  private async fillTextFields(fields: Array<{input: Locator; value: string}>) {
    await expect(async () => {
      for (const {input, value} of fields) {
        if ((await input.inputValue()) !== value) {
          await input.fill(value);
        }
      }
      for (const {input, value} of fields) {
        await expect(input).toHaveValue(value);
      }
    }).toPass({timeout: 10_000});
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

    const textFields = [
      ...(column.title ? [{input: this.columnTitleInput, value: column.title}] : []),
      {input: this.columnKeyInput, value: column.key},
    ];

    await this.fillTextFields(textFields);
    await this.fillValuePathManually(this.columnPathToggle, this.columnPathInput, column.path);
    await this.selectDropdownItem(this.columnDisplayTypeDropdown, column.displayType);
    // A reset that lands after the first fill would have cleared these again, so
    // re-verify (and re-fill) right before relying on the form being valid.
    await this.fillTextFields(textFields);
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

    const textFields = [
      {
        input: this.page.locator('[data-testid="task-management-search-title"]'),
        value: field.title,
      },
      {input: this.searchFieldKeyInput, value: field.key},
    ];

    await this.fillTextFields(textFields);
    await this.fillValuePathManually(this.searchFieldPathToggle, this.searchFieldPathInput, field.path);
    await this.selectDropdownItem(this.searchFieldDataTypeDropdown, field.dataType);
    if (field.matchType) {
      const matchTypeVisible = await this.searchFieldMatchTypeDropdown.isVisible();
      if (matchTypeVisible) {
        await this.selectDropdownItem(this.searchFieldMatchTypeDropdown, field.matchType);
      }
    }
    await this.selectDropdownItem(this.searchFieldFieldTypeDropdown, field.fieldType);
    await this.fillTextFields(textFields);
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
