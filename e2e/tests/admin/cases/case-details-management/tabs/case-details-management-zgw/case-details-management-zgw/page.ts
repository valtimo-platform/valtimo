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
import {CarbonList} from '../../../../../../../shared/carbon-list/carbon-list.utils';
import {ZGW_DOCUMENT_COLUMNS_TEST_IDS, ZGW_UPLOAD_FIELDS_TEST_IDS} from '../../../../../../../constants';
import {apiDelete, apiGet, apiPut} from '../../../../../../../utils/api.utils';

export interface ConfiguredColumn {
  key: string;
  sortable: boolean;
  filterable: boolean;
  defaultSort?: 'ASC' | 'DESC' | null;
}

export interface UploadField {
  key: string;
  defaultValue: string;
  visible: boolean;
  readonly: boolean;
}

export const UPLOAD_FIELD_KEY_LABELS: Record<string, string> = {
  bestandsnaam: 'File Name',
  titel: 'Title',
  auteur: 'Author',
  beschrijving: 'Description',
  taal: 'Language',
  vertrouwelijkheidaanduiding: 'Confidentiality Indication',
  creatiedatum: 'Creation Date',
  informatieobjecttype: 'Information Object Type',
  status: 'Status',
  verzenddatum: 'Send Date',
  ontvangstdatum: 'Receive Date',
  aanvullendeDatum: 'Additional Date',
  trefwoorden: 'Tags',
};

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

  get documentUploadFieldsTab(): Locator {
    return this.page.getByRole('tab', {name: 'Document upload fields'});
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

  // ─── Upload fields locators ──────────────────────────────────────

  get uploadFieldsList(): CarbonList {
    return new CarbonList(
      this.page,
      this.page.locator('valtimo-documenten-api-upload-fields')
    );
  }

  get uploadFieldsModal(): Locator {
    return this.page.locator('valtimo-documenten-api-upload-field-modal cds-modal');
  }

  get uploadFieldVisibleToggleWrapper(): Locator {
    return this.page.getByTestId(ZGW_UPLOAD_FIELDS_TEST_IDS.modalVisibleToggle);
  }

  get uploadFieldVisibleToggleSwitch(): Locator {
    return this.uploadFieldVisibleToggleWrapper.locator('.cds--toggle__switch');
  }

  get uploadFieldVisibleSwitch(): Locator {
    return this.uploadFieldVisibleToggleWrapper.getByRole('switch');
  }

  get uploadFieldReadonlyToggleWrapper(): Locator {
    return this.page.getByTestId(ZGW_UPLOAD_FIELDS_TEST_IDS.modalReadonlyToggle);
  }

  get uploadFieldReadonlyToggleSwitch(): Locator {
    return this.uploadFieldReadonlyToggleWrapper.locator('.cds--toggle__switch');
  }

  get uploadFieldReadonlySwitch(): Locator {
    return this.uploadFieldReadonlyToggleWrapper.getByRole('switch');
  }

  get uploadFieldModalSubmitButton(): Locator {
    return this.page.getByTestId(ZGW_UPLOAD_FIELDS_TEST_IDS.modalSubmitButton);
  }

  get uploadFieldModalCancelButton(): Locator {
    return this.page.getByTestId(ZGW_UPLOAD_FIELDS_TEST_IDS.modalCancelButton);
  }

  get uploadFieldDefaultValueComboBox(): Locator {
    return this.page.locator(
      'valtimo-documenten-api-upload-field-modal .uploadField-form cds-combo-box'
    );
  }

  get uploadFieldDefaultValueInput(): Locator {
    return this.page.locator(
      'valtimo-documenten-api-upload-field-modal .uploadField-form input[cdstext]'
    );
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

  async openDocumentUploadFieldsTab() {
    await this.zgwTab.click();
    await this.documentUploadFieldsTab.click();
    await this.uploadFieldsList.waitForLoaded();
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

  // ─── Upload fields: UI actions ───────────────────────────────────

  uploadFieldRowByLabel(fieldLabel: string) {
    return this.uploadFieldsList.row(fieldLabel);
  }

  async openUploadFieldEditModal(fieldLabel: string) {
    await this.uploadFieldRowByLabel(fieldLabel).click();
    await expect(this.uploadFieldVisibleToggleWrapper).toBeVisible();
    await expect(this.uploadFieldReadonlyToggleWrapper).toBeVisible();
  }

  async toggleUploadFieldVisible() {
    await this.uploadFieldVisibleToggleSwitch.click();
  }

  async toggleUploadFieldReadonly() {
    await this.uploadFieldReadonlyToggleSwitch.click();
  }

  async saveUploadFieldModal() {
    await expect(this.uploadFieldModalSubmitButton).toBeEnabled();
    await this.uploadFieldModalSubmitButton.click();
    await expect(this.uploadFieldVisibleToggleWrapper).not.toBeVisible();
  }

  async selectFirstDefaultValueOption(): Promise<string> {
    await expect(this.uploadFieldDefaultValueComboBox).toBeVisible();
    await this.uploadFieldDefaultValueComboBox.locator('.cds--list-box__field').first().click();
    const firstOption = this.page.getByRole('listbox').getByRole('option').first();
    await expect(firstOption).toBeVisible();
    const label = ((await firstOption.textContent()) ?? '').trim();
    await firstOption.click();
    return label;
  }

  // ─── Upload fields: assertions ───────────────────────────────────

  async assertUploadFieldRowBooleans(
    fieldLabel: string,
    expected: {visible: boolean; readonly: boolean}
  ) {
    // Columns: [field, defaultValue, visible, readonly, action overflow].
    const row = this.uploadFieldRowByLabel(fieldLabel);
    await expect(row.cellByIndex(2)).toHaveText(expected.visible ? 'Yes' : 'No');
    await expect(row.cellByIndex(3)).toHaveText(expected.readonly ? 'Yes' : 'No');
  }

  // ─── Upload fields: API helpers ──────────────────────────────────

  async getUploadFields(caseDefinitionKey: string): Promise<UploadField[]> {
    return apiGet<UploadField[]>(
      `/api/management/v1/case-definition/${caseDefinitionKey}/zgw-document/upload-field`
    );
  }

  async putUploadField(caseDefinitionKey: string, field: UploadField) {
    await apiPut(
      `/api/management/v1/case-definition/${caseDefinitionKey}/zgw-document/upload-field`,
      field
    );
  }
}
