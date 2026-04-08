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
import {CarbonList} from '../../shared/carbon-list/carbon-list.utils';
import * as ApiUtils from '../../utils/api.utils';
import {ensureDraftVersionSelected, getVersionFromUrl} from '../../utils/version.utils';
import {clearMonacoEditor, pasteToMonacoEditor} from '../../utils/monaco.utils';
import {waitForResponse} from '../../components/request';

export class CaseDetailsManagementFormFlowsPage {
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

  async switchToFormFlowsTab() {
    await this.page.getByRole('tab', {name: 'Form Flows'}).click();
    await expect(this.formFlowsList).toBeVisible();
  }

  async ensureDraftVersionSelected(): Promise<string> {
    return ensureDraftVersionSelected(this.page);
  }

  // ─── UI Elements ──────────────────────────────────────────────────

  get formFlowsList() {
    // Scope to content area to exclude the version-select modal's valtimo-carbon-list
    // rendered in the page header by CaseManagementDetailActionsComponent.
    return this.page.locator('.case-management-detail-container__content valtimo-carbon-list');
  }

  get addFormFlowButton() {
    // Two "Add new form flow" buttons exist when list is empty: toolbar + no-results panel.
    // Scope to toolbar to avoid strict mode violation.
    return this.page.getByLabel('Table action bar').getByRole('button', {name: 'Add new form flow'});
  }

  // Create modal: only a key field, no data-test-ids
  get formFlowKeyInput() {
    return this.page.locator('cds-modal').locator('cds-label').filter({hasText: 'Key'}).locator('input');
  }

  get createFormFlowButton() {
    return this.page.locator('cds-modal-footer').getByRole('button', {name: 'Create'});
  }

  get cancelFormFlowButton() {
    return this.page.locator('cds-modal-footer').getByRole('button', {name: 'Cancel'});
  }

  // ─── Actions ──────────────────────────────────────────────────────

  async createFormFlow(key: string) {
    await this.addFormFlowButton.click();
    await expect(this.formFlowKeyInput).toBeVisible();
    await this.formFlowKeyInput.fill(key);
    await expect(this.createFormFlowButton).toBeEnabled();
    await Promise.all([
      this.page.waitForURL(new RegExp(`form-flows/${key}$`)),
      this.createFormFlowButton.click(),
    ]);
  }

  async deleteFormFlow(key: string) {
    const list = new CarbonList(this.page);
    const row = list.row(key);
    await row.clickAction('Delete');
    await this.page.getByRole('button', {name: 'Delete'}).click();
  }

  async navigateBackToFormFlowsList() {
    await this.page.getByRole('button', {name: 'Back'}).click();
    await expect(this.formFlowsList).toBeVisible();
  }

  async openFormFlow(key: string) {
    const list = new CarbonList(this.page);
    await list.row(key).click();
  }

  // ─── Editor Elements ───────────────────────────────────────────────

  get saveButton() {
    return this.page.getByRole('button', {name: 'Save'});
  }

  get monacoEditor() {
    return this.page.locator('.monaco-editor').first();
  }

  // ─── Save Actions ─────────────────────────────────────────────────

  async editFormFlowJson(json: object) {
    await clearMonacoEditor(this.page);
    await pasteToMonacoEditor(this.page, JSON.stringify(json, null, 2));
  }

  async pasteRawTextInEditor(text: string) {
    await clearMonacoEditor(this.page);
    await pasteToMonacoEditor(this.page, text);
  }

  async saveFormFlow(formFlowKey: string, caseKey: string) {
    const versionTag = await getVersionFromUrl(this.page);
    const [response] = await Promise.all([
      waitForResponse(
        this.page,
        'PUT',
        `/api/management/v1/case-definition/${caseKey}/version/${versionTag}/form-flow-definition/${formFlowKey}`
      ),
      this.saveButton.click(),
    ]);
    return response;
  }

  async assertSaveSuccessNotification(key: string) {
    await expect(
      this.page.getByText(`${key} was saved successfully`).first()
    ).toBeVisible({timeout: 15_000});
  }

  // ─── Assertions ───────────────────────────────────────────────────

  async assertFormFlowExists(key: string) {
    await expect(this.page.locator(`td:has-text("${key}")`).first()).toBeVisible();
  }

  async assertFormFlowNotExists(key: string) {
    await expect(this.page.locator(`td:has-text("${key}")`)).toHaveCount(0);
  }

  async assertEditorVisible() {
    await expect(this.page.locator('valtimo-editor')).toBeVisible();
  }

  // ─── API Cleanup ──────────────────────────────────────────────────

  async deleteFormFlowViaApi(key: string) {
    try {
      await ApiUtils.apiDelete(`/api/management/v1/form-flow/definition/${key}`);
    } catch {
      // may already be deleted
    }
  }
}
