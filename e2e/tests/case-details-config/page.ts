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

import {APIRequestContext, expect, Page} from '@playwright/test';
import * as ApiUtils from '../../utils/api.utils';
import {endpoints} from '../../api/endpoints';
import {CarbonList} from '../../shared/carbon-list/carbon-list.utils';
import {ensureDraftVersionSelected} from '../../utils/version.utils';
import {
  CASE_MANAGEMENT_STATUSES_TEST_IDS,
  CASE_MANAGEMENT_STATUS_MODAL_TEST_IDS,
  CASE_MANAGEMENT_TAGS_TEST_IDS,
  CASE_MANAGEMENT_TAGS_MODAL_TEST_IDS,
} from '../../constants';

export class CaseDetailsConfigPage {
  constructor(
    private readonly page: Page,
    private readonly request: APIRequestContext
  ) {}

  // ─── Status UI Elements ────────────────────────────────────────────

  get statusAddButton() {
    return this.page.getByTestId(CASE_MANAGEMENT_STATUSES_TEST_IDS.addButton);
  }

  get statusTitleInput() {
    return this.page.getByTestId(CASE_MANAGEMENT_STATUS_MODAL_TEST_IDS.titleInput);
  }

  get statusKeyInput() {
    return this.page.getByTestId(CASE_MANAGEMENT_STATUS_MODAL_TEST_IDS.keyInput);
  }

  get statusEditKeyButton() {
    return this.page.getByTestId(CASE_MANAGEMENT_STATUS_MODAL_TEST_IDS.editKeyButton);
  }

  get statusColorDropdown() {
    return this.page.getByTestId(CASE_MANAGEMENT_STATUS_MODAL_TEST_IDS.colorDropdown);
  }

  get statusVisibilityToggle() {
    return this.page.getByTestId(CASE_MANAGEMENT_STATUS_MODAL_TEST_IDS.visibilityToggle).locator('.cds--toggle__switch');
  }

  get statusCancelButton() {
    return this.page.getByTestId(CASE_MANAGEMENT_STATUS_MODAL_TEST_IDS.cancelButton);
  }

  get statusAddConfirmButton() {
    return this.page.getByTestId(CASE_MANAGEMENT_STATUS_MODAL_TEST_IDS.addConfirmButton);
  }

  get statusSaveButton() {
    return this.page.getByTestId(CASE_MANAGEMENT_STATUS_MODAL_TEST_IDS.saveButton);
  }

  // ─── Tag UI Elements ──────────────────────────────────────────────

  get tagAddButton() {
    return this.page.getByTestId(CASE_MANAGEMENT_TAGS_TEST_IDS.addButton);
  }

  get tagTitleInput() {
    return this.page.getByTestId(CASE_MANAGEMENT_TAGS_MODAL_TEST_IDS.titleInput);
  }

  get tagKeyInput() {
    return this.page.getByTestId(CASE_MANAGEMENT_TAGS_MODAL_TEST_IDS.keyInput);
  }

  get tagEditKeyButton() {
    return this.page.getByTestId(CASE_MANAGEMENT_TAGS_MODAL_TEST_IDS.editKeyButton);
  }

  get tagColorDropdown() {
    return this.page.getByTestId(CASE_MANAGEMENT_TAGS_MODAL_TEST_IDS.colorDropdown);
  }

  get tagCancelButton() {
    return this.page.getByTestId(CASE_MANAGEMENT_TAGS_MODAL_TEST_IDS.cancelButton);
  }

  get tagAddConfirmButton() {
    return this.page.getByTestId(CASE_MANAGEMENT_TAGS_MODAL_TEST_IDS.addConfirmButton);
  }

  get tagSaveButton() {
    return this.page.getByTestId(CASE_MANAGEMENT_TAGS_MODAL_TEST_IDS.saveButton);
  }

  // ─── Version Selector ────────────────────────────────────────────

  async ensureDraftVersionSelected(): Promise<string> {
    return ensureDraftVersionSelected(this.page);
  }

  // ─── Navigation ───────────────────────────────────────────────────

  async goToCaseDetailsConfig(caseIdentifier: string) {
    console.log('Navigate to Case Details Config...');
    await this.page.getByRole('button', {name: 'Admin'}).click();
    await this.page.getByRole('link', {name: 'Cases'}).click();
    await this.page.waitForSelector('valtimo-carbon-list');
    await this.page.locator(`tr:has(td:has-text("${caseIdentifier}"))`).click();
    await this.page.getByRole('tab', {name: 'Case details'}).click();
  }

  async switchToStatusesTab() {
    await this.page.getByRole('tab', {name: 'Statuses'}).click();
  }

  async switchToTagsTab() {
    await this.page.getByRole('tab', {name: 'Tags'}).click();
  }

  // ─── Status CRUD ──────────────────────────────────────────────────

  async addStatus(title: string) {
    await this.statusAddButton.click();
    // Wait for the modal to be fully in 'add' mode. The Add button only renders when
    // Angular's isAdd$ emits true, which also enables auto-key generation.
    await expect(this.statusAddConfirmButton).toBeAttached({timeout: 10_000});
    await expect(this.statusTitleInput).toBeVisible();
    await this.statusTitleInput.pressSequentially(title, {delay: 30});
    await expect(this.statusKeyInput).not.toHaveValue('', {timeout: 10_000});
    await expect(this.statusAddConfirmButton).toBeEnabled();
    await this.statusAddConfirmButton.click();
  }

  async editStatus(currentTitle: string, newTitle: string) {
    await this.page.locator(`tr:has(td:has-text("${currentTitle}"))`).click();
    await this.statusTitleInput.clear();
    await this.statusTitleInput.fill(newTitle);
    await this.statusSaveButton.click();
  }

  async deleteStatus(title: string) {
    const row = this.page.locator(`tr:has(td:has-text("${title}"))`);
    await row.locator('.v-overflow-menu__trigger').click();
    await this.page.getByRole('menu').getByRole('menuitem', {name: 'Delete'}).click();
    await this.page.getByRole('button', {name: 'Delete'}).click();
  }

  async openStatusEditModal(title: string) {
    await this.page.locator(`tr:has(td:has-text("${title}"))`).click();
  }

  async selectStatusColor(colorName: string) {
    await this.statusColorDropdown.click();
    await this.page.getByRole('listbox').getByText(colorName, {exact: true}).click();
  }

  async toggleStatusVisibility() {
    await this.statusVisibilityToggle.click();
  }

  async saveStatus() {
    await expect(this.statusSaveButton).toBeEnabled();
    await this.statusSaveButton.click();
  }

  async assertStatusExists(title: string) {
    await expect(this.page.locator(`td:has-text("${title}")`).first()).toBeVisible();
  }

  async assertStatusNotExists(title: string) {
    await expect(this.page.locator(`td:has-text("${title}")`)).toHaveCount(0);
  }

  async assertStatusColorInList(title: string, expectedColorLabel: string) {
    const row = this.page.locator(`tr:has(td:has-text("${title}"))`);
    const colorTag = row.locator('cds-tag');
    await expect(colorTag).toContainText(expectedColorLabel);
  }

  async assertStatusVisibilityInList(title: string, expectedVisible: boolean) {
    const row = this.page.locator(`tr:has(td:has-text("${title}"))`);
    // nth(3) = visible column (0: drag handle, 1: title, 2: key, 3: visible)
    const visibleCell = row.locator('td').nth(3);
    await expect(visibleCell).toContainText(expectedVisible ? 'Yes' : 'No');
  }

  async getStatusTitlesInOrder(): Promise<string[]> {
    const list = new CarbonList(this.page);
    const rows = list.rows;
    const count = await rows.count();
    const titles: string[] = [];
    for (let i = 0; i < count; i++) {
      // nth(1) skips the drag handle column (index 0)
      const text = await rows.nth(i).locator('td').nth(1).innerText();
      titles.push(text.trim());
    }
    return titles;
  }

  async dragStatusToPosition(sourceTitle: string, targetTitle: string) {
    const list = new CarbonList(this.page);
    const sourceRow = list.row(sourceTitle);
    const targetRow = list.row(targetTitle);
    await list.dragRow(sourceRow, targetRow);
  }

  // ─── Tag CRUD ─────────────────────────────────────────────────────

  async addTag(title: string) {
    await this.tagAddButton.click();
    // Wait for the modal to be fully in 'add' mode. The Add button only renders when
    // Angular's isAdd$ emits true, which also enables auto-key generation.
    await expect(this.tagAddConfirmButton).toBeAttached({timeout: 10_000});
    await expect(this.tagTitleInput).toBeVisible();
    await this.tagTitleInput.pressSequentially(title, {delay: 30});
    await expect(this.tagKeyInput).not.toHaveValue('', {timeout: 10_000});
    await expect(this.tagAddConfirmButton).toBeEnabled();
    await this.tagAddConfirmButton.click();
  }

  async editTag(currentTitle: string, newTitle: string) {
    await this.page.locator(`tr:has(td:has-text("${currentTitle}"))`).click();
    await this.tagTitleInput.clear();
    await this.tagTitleInput.fill(newTitle);
    await this.tagSaveButton.click();
  }

  async deleteTag(title: string) {
    const row = this.page.locator(`tr:has(td:has-text("${title}"))`);
    await row.locator('.v-overflow-menu__trigger').click();
    await this.page.getByRole('menu').getByRole('menuitem', {name: 'Delete'}).click();
    await this.page.getByRole('button', {name: 'Delete'}).click();
  }

  async assertTagExists(title: string) {
    await expect(this.page.locator(`td:has-text("${title}")`).first()).toBeVisible();
  }

  async assertTagNotExists(title: string) {
    await expect(this.page.locator(`td:has-text("${title}")`)).toHaveCount(0);
  }

  async openTagEditModal(title: string) {
    await this.page.locator(`tr:has(td:has-text("${title}"))`).click();
  }

  async selectTagColor(colorName: string) {
    await this.tagColorDropdown.click();
    await this.page.getByRole('listbox').getByText(colorName, {exact: true}).click();
  }

  async saveTag() {
    await expect(this.tagSaveButton).toBeEnabled();
    await this.tagSaveButton.click();
  }

  async assertTagColorInList(title: string, expectedColorLabel: string) {
    const row = this.page.locator(`tr:has(td:has-text("${title}"))`);
    const colorTag = row.locator('cds-tag');
    await expect(colorTag).toContainText(expectedColorLabel);
  }

  // ─── API Cleanup ──────────────────────────────────────────────────

  async deleteStatusViaApi(caseDefinitionKey: string, statusKey: string) {
    try {
      await ApiUtils.apiDelete(
        `${endpoints.caseDefinition.internalStatus(caseDefinitionKey)}/${statusKey}`
      );
    } catch {
      // Status may already have been deleted by the test
    }
  }

  async deleteTagViaApi(
    caseDefinitionKey: string,
    versionTag: string,
    tagKey: string
  ) {
    try {
      await ApiUtils.apiDelete(
        `${endpoints.caseDefinition.caseTag(caseDefinitionKey)}/${tagKey}`
      );
    } catch {
      // Tag may already have been deleted by the test
    }
  }
}
