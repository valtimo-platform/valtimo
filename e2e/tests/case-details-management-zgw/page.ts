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
import {ZGW_DOCUMENT_COLUMNS_TEST_IDS} from '../../constants';
import {apiDelete, apiGet} from '../../utils/api.utils';

export interface ConfiguredColumn {
  key: string;
  sortable: boolean;
  filterable: boolean;
  defaultSort?: 'ASC' | 'DESC' | null;
}

export class CaseDetailsManagementZgwPage {
  constructor(
    private readonly page: Page,
    private readonly request: APIRequestContext
  ) {}

  // ─── Locators ───────────────────────────────────────────────────

  get zgwTab(): Locator {
    return this.page.getByRole('tab', {name: 'ZGW', exact: true});
  }

  get documentColumnsTab(): Locator {
    return this.page.getByRole('tab', {name: 'Document columns'});
  }

  get addColumnButton(): Locator {
    return this.page.getByTestId(ZGW_DOCUMENT_COLUMNS_TEST_IDS.addButton);
  }

  get modalColumnDropdown(): Locator {
    return this.page.getByTestId(ZGW_DOCUMENT_COLUMNS_TEST_IDS.modalColumnDropdown);
  }

  get modalDropdownToggle(): Locator {
    return this.modalColumnDropdown.locator('button.cds--list-box__field').first();
  }

  get modalSubmitButton(): Locator {
    return this.page.getByTestId(ZGW_DOCUMENT_COLUMNS_TEST_IDS.modalSubmitButton);
  }

  get modalCancelButton(): Locator {
    return this.page.getByTestId(ZGW_DOCUMENT_COLUMNS_TEST_IDS.modalCancelButton);
  }

  get deleteConfirmButton(): Locator {
    return this.page.locator('cds-modal button.cds--btn--danger', {hasText: 'Delete'});
  }

  get columnsList(): CarbonList {
    return new CarbonList(this.page, this.page.locator('valtimo-documenten-api-columns'));
  }

  // ─── Navigation ──────────────────────────────────────────────────

  async goToCaseManagementForCase(caseIdentifier: string) {
    await this.page.getByRole('button', {name: 'Admin'}).click();
    await this.page.getByRole('link', {name: 'Cases'}).click();
    await this.page.waitForSelector('valtimo-carbon-list');
    await this.page.locator(`tr:has(td:has-text("${caseIdentifier}"))`).click();
  }

  async openDocumentColumnsTab() {
    await this.zgwTab.click();
    await this.documentColumnsTab.click();
    await this.columnsList.waitForLoaded();
  }

  // ─── UI Actions ──────────────────────────────────────────────────

  async selectColumnInModal(columnLabel: string) {
    await this.modalDropdownToggle.click();
    await this.page
      .locator('cds-dropdown-list')
      .getByText(columnLabel, {exact: true})
      .click();
  }

  async addColumn(columnLabel: string) {
    await this.addColumnButton.click();
    await expect(this.modalColumnDropdown).toBeVisible();
    await this.selectColumnInModal(columnLabel);
    await expect(this.modalSubmitButton).toBeEnabled();
    await this.modalSubmitButton.click();
    await expect(this.modalColumnDropdown).not.toBeVisible();
  }

  async openEditModalForRow(columnLabel: string) {
    await this.columnsList.row(columnLabel).click();
    await expect(this.modalColumnDropdown).toBeVisible();
  }

  async saveEditModal() {
    await expect(this.modalSubmitButton).toBeEnabled();
    await this.modalSubmitButton.click();
    await expect(this.modalColumnDropdown).not.toBeVisible();
  }

  async deleteColumnViaUi(columnLabel: string) {
    await this.columnsList.row(columnLabel).clickAction('Delete');
    await this.deleteConfirmButton.click();
    await expect(this.columnsList.row(columnLabel).cell(columnLabel)).not.toBeVisible();
  }

  async reorderColumns(sourceLabel: string, targetLabel: string) {
    const list = this.columnsList;
    await list.dragRow(list.row(sourceLabel), list.row(targetLabel));
  }

  // ─── Assertions ──────────────────────────────────────────────────

  async assertColumnVisible(columnLabel: string) {
    await expect(this.columnsList.row(columnLabel).cell(columnLabel)).toBeVisible();
  }

  async assertColumnNotVisible(columnLabel: string) {
    await expect(this.page.locator('td', {hasText: columnLabel})).toHaveCount(0);
  }

  async assertEditDropdownDisabled() {
    await expect(this.modalDropdownToggle).toBeDisabled();
  }

  // ─── Default sort (radio group) ─────────────────────────────────

  defaultSortRadio(label: string): Locator {
    return this.defaultSortRadioGroup
      .locator('cds-radio')
      .filter({hasText: label});
  }

  get defaultSortRadioGroup(): Locator {
    return this.page.locator('cds-radio-group');
  }

  async assertRowDefaultSort(columnLabel: string, expectedDefaultSortLabel: string) {
    // Columns: [drag handle, column name, default sort, overflow menu].
    const row = this.columnsList.row(columnLabel);
    await expect(row.cellByIndex(2)).toHaveText(expectedDefaultSortLabel);
  }

  async assertRowOrder(expectedLabels: string[]) {
    const list = this.columnsList;
    for (let i = 0; i < expectedLabels.length; i++) {
      await expect(list.rows.nth(i)).toContainText(expectedLabels[i]);
    }
  }

  async assertSubmitButtonDisabled() {
    await expect(this.modalSubmitButton).toBeDisabled();
  }

  // ─── API helpers (setup / cleanup) ───────────────────────────────

  async getConfiguredColumnKeys(caseDefinitionKey: string): Promise<string[]> {
    const columns = await apiGet<ConfiguredColumn[]>(
      `/api/management/v1/case-definition/${caseDefinitionKey}/zgw-document-column`
    );
    return columns.map(c => c.key);
  }

  async deleteColumnViaApi(caseDefinitionKey: string, columnKey: string) {
    try {
      await apiDelete(
        `/api/management/v1/case-definition/${caseDefinitionKey}/zgw-document-column/${columnKey}`
      );
    } catch {
      // Column may already be deleted or was never created — ignore.
    }
  }
}
