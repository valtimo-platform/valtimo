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

export class CaseDetailsConfigPage {
  constructor(
    private readonly page: Page,
    private readonly request: APIRequestContext
  ) {}

  // ─── Status UI Elements ────────────────────────────────────────────

  get statusAddButton() {
    return this.page.getByTestId('caseStatusAddButton');
  }

  get statusTitleInput() {
    return this.page.getByTestId('caseStatusTitleInput');
  }

  get statusKeyInput() {
    return this.page.getByTestId('caseStatusKeyInput');
  }

  get statusEditKeyButton() {
    return this.page.getByTestId('caseStatusEditKeyButton');
  }

  get statusColorDropdown() {
    return this.page.getByTestId('caseStatusColorDropdown');
  }

  get statusVisibilityToggle() {
    return this.page.getByTestId('caseStatusVisibilityToggle').locator('.cds--toggle__switch');
  }

  get statusCancelButton() {
    return this.page.getByTestId('caseStatusCancelButton');
  }

  get statusAddConfirmButton() {
    return this.page.getByTestId('caseStatusAddConfirmButton');
  }

  get statusSaveButton() {
    return this.page.getByTestId('caseStatusSaveButton');
  }

  // ─── Tag UI Elements ──────────────────────────────────────────────

  get tagAddButton() {
    return this.page.getByTestId('caseTagAddButton');
  }

  get tagTitleInput() {
    return this.page.getByTestId('caseTagTitleInput');
  }

  get tagKeyInput() {
    return this.page.getByTestId('caseTagKeyInput');
  }

  get tagEditKeyButton() {
    return this.page.getByTestId('caseTagEditKeyButton');
  }

  get tagColorDropdown() {
    return this.page.getByTestId('caseTagColorDropdown');
  }

  get tagCancelButton() {
    return this.page.getByTestId('caseTagCancelButton');
  }

  get tagAddConfirmButton() {
    return this.page.getByTestId('caseTagAddConfirmButton');
  }

  get tagSaveButton() {
    return this.page.getByTestId('caseTagSaveButton');
  }

  // ─── Version Selector ────────────────────────────────────────────

  get versionSelectDropdown() {
    return this.page.getByTestId('caseVersionSelectDropdown');
  }

  async ensureDraftVersionSelected() {
    const dropdown = this.versionSelectDropdown;
    const selectedText = await dropdown.innerText();

    if (selectedText.includes('DRAFT')) {
      return;
    }

    await dropdown.click();
    const listbox = this.page.getByRole('listbox');
    const draftOption = listbox.locator('[data-test-id^="caseVersion"]:has-text("DRAFT")').first();
    await draftOption.click();
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
    await this.statusTitleInput.fill(title);
    await this.statusAddConfirmButton.click();
  }

  async editStatus(currentTitle: string, newTitle: string) {
    await this.page.locator(`tr:has(td:has-text("${currentTitle}"))`).click();
    await this.statusTitleInput.clear();
    await this.statusTitleInput.fill(newTitle);
    await this.statusSaveButton.click();
  }

  async deleteStatus(title: string) {
    // Carbon valtimo-carbon-list: use getByRole('menu') to find the overflow menu trigger
    const row = this.page.locator(`tr:has(td:has-text("${title}"))`);
    await row.getByRole('menu').locator('button').click();
    await this.page.getByRole('menuitem', {name: 'Delete'}).click();
    await this.page.getByRole('button', {name: 'Delete'}).click();
  }

  async assertStatusExists(title: string) {
    await expect(this.page.locator(`td:has-text("${title}")`).first()).toBeVisible();
  }

  async assertStatusNotExists(title: string) {
    await expect(this.page.locator(`td:has-text("${title}")`)).toHaveCount(0);
  }

  // ─── Tag CRUD ─────────────────────────────────────────────────────

  async addTag(title: string) {
    await this.tagAddButton.click();
    await this.tagTitleInput.fill(title);
    await this.tagAddConfirmButton.click();
  }

  async editTag(currentTitle: string, newTitle: string) {
    await this.page.locator(`tr:has(td:has-text("${currentTitle}"))`).click();
    await this.tagTitleInput.clear();
    await this.tagTitleInput.fill(newTitle);
    await this.tagSaveButton.click();
  }

  async deleteTag(title: string) {
    // Carbon valtimo-carbon-list: use getByRole('menu') to find the overflow menu trigger
    const row = this.page.locator(`tr:has(td:has-text("${title}"))`);
    await row.getByRole('menu').locator('button').click();
    await this.page.getByRole('menuitem', {name: 'Delete'}).click();
    await this.page.getByRole('button', {name: 'Delete'}).click();
  }

  async assertTagExists(title: string) {
    await expect(this.page.locator(`td:has-text("${title}")`).first()).toBeVisible();
  }

  async assertTagNotExists(title: string) {
    await expect(this.page.locator(`td:has-text("${title}")`)).toHaveCount(0);
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
