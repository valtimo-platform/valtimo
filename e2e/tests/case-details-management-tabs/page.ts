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
import {CarbonList} from '../../shared/carbon-list/carbon-list.utils';
import {ensureDraftVersionSelected} from '../../utils/version.utils';

export class CaseDetailsManagementTabsPage {
  constructor(
    private readonly page: Page,
    private readonly request: APIRequestContext
  ) {}

  // ─── UI Elements ──────────────────────────────────────────────────

  get tabsPanel() {
    return this.page.getByRole('tabpanel', {name: 'Tabs'});
  }

  get tabsList() {
    return this.tabsPanel.locator('valtimo-carbon-list');
  }

  get addTabButton() {
    // Toolbar button inside the tabs panel
    return this.tabsPanel.getByRole('button', {name: /Add tab/i});
  }

  get tabNameInput() {
    // cds-label wraps the input — filter by label text, then grab the child input
    return this.page.locator('cds-modal').locator('cds-label').filter({hasText: 'Tab name'}).locator('input');
  }

  get tabKeyInput() {
    // The key input is the only one with a pattern attribute in the modal form
    return this.page.locator('cds-modal').locator('input[pattern]');
  }

  get addTabConfirmButton() {
    // Primary "Add tab" button in the modal footer (only visible after a type is selected)
    return this.page.locator('cds-modal-footer .valtimo-add-tab-modal__actions').getByRole('button', {name: /Add tab/i});
  }

  get modalCancelButton() {
    return this.page.locator('cds-modal-footer').getByRole('button', {name: 'Cancel'});
  }

  // ─── Navigation ───────────────────────────────────────────────────

  async goToCaseManagement(caseIdentifier: string) {
    console.log('Navigate to Case Management...');
    await this.page.getByRole('button', {name: 'Admin'}).click();
    await this.page.getByRole('link', {name: 'Cases'}).click();
    await this.page.waitForSelector('valtimo-carbon-list');
    await this.page.locator(`tr:has(td:has-text("${caseIdentifier}"))`).click();
  }

  async switchToCaseDetailsTabs() {
    await this.page.getByRole('tab', {name: 'Case details'}).click();
    await this.page.getByRole('tab', {name: 'Tabs'}).click();
  }

  async ensureDraftVersionSelected(): Promise<string> {
    return ensureDraftVersionSelected(this.page);
  }

  // ─── Tab CRUD ─────────────────────────────────────────────────────

  /**
   * Adds a "widgets" type tab — simplest type, requires no contentKey.
   * Button label is "Widgets component" per translation key
   * caseManagement.tabManagement.addModal.widgetsComponent.
   */
  async addWidgetsTab(title: string) {
    const key = title.toLowerCase().replace(/\s+/g, '-');
    await this.addTabButton.click();
    await this.page.getByRole('button', {name: 'Widgets component'}).click();
    await this.tabNameInput.fill(title);
    await this.tabKeyInput.fill(key);
    await this.addTabConfirmButton.click();
  }

  async deleteTab(title: string) {
    const row = this.page.locator(`tr:has(td:has-text("${title}"))`);
    await row.locator('.v-overflow-menu__trigger').click();
    await this.page.getByRole('menu').getByRole('menuitem', {name: 'Delete'}).click();
    await this.page.getByRole('button', {name: 'Delete'}).click();
  }

  // ─── Assertions ───────────────────────────────────────────────────

  async assertTabExists(title: string) {
    await expect(this.tabsPanel.locator(`td:has-text("${title}")`).first()).toBeVisible();
  }

  async assertTabNotExists(title: string) {
    await expect(this.tabsPanel.locator(`td:has-text("${title}")`)).toHaveCount(0);
  }

  async getTabTitlesInOrder(): Promise<string[]> {
    const list = new CarbonList(this.page);
    const rows = list.rows;
    const count = await rows.count();
    const titles: string[] = [];
    for (let i = 0; i < count; i++) {
      // Column 0: drag handle, Column 1: name/title
      const text = await rows.nth(i).locator('td').nth(1).innerText();
      titles.push(text.trim());
    }
    return titles;
  }

  async dragTabToPosition(sourceTitle: string, targetTitle: string) {
    const list = new CarbonList(this.page);
    const sourceRow = list.row(sourceTitle);
    const targetRow = list.row(targetTitle);
    await list.dragRow(sourceRow, targetRow);
  }

  // ─── API Cleanup ──────────────────────────────────────────────────

  async deleteTabViaApi(caseDefinitionKey: string, versionTag: string, tabKey: string) {
    try {
      await ApiUtils.apiDelete(
        `/api/management/v1/case-definition/${caseDefinitionKey}/version/${versionTag}/tab/${tabKey}`
      );
    } catch {
      // Tab may already have been deleted by the test
    }
  }

  /**
   * Delete a tab across ALL versions of a case definition.
   * Needed because leftover tabs from a previous run may exist under a different version tag.
   */
  async deleteTabFromAllVersions(caseDefinitionKey: string, tabKey: string) {
    try {
      const versions = await ApiUtils.apiGet<Array<{versionTag: string}>>(
        `/api/management/v1/case-definition/${caseDefinitionKey}/version`
      );
      for (const v of versions) {
        await this.deleteTabViaApi(caseDefinitionKey, v.versionTag, tabKey);
      }
    } catch {
      // Ignore errors
    }
  }
}
