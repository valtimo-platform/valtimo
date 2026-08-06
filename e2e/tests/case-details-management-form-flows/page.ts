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
    await this.page.goto('/case-management');
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
    // Two "Create new form flow" buttons exist when list is empty: toolbar + no-results panel.
    // Scope to toolbar to avoid strict mode violation.
    // Label was renamed "Add new form flow" → "Create new form flow"; accept both.
    return this.page
      .getByLabel('Table action bar')
      .getByRole('button', {name: /^(Create|Add) new form flow$/i});
  }

  // Create modal: only a key field, no data-test-ids
  get formFlowKeyInput() {
    return this.page
      .locator('cds-modal')
      .locator('cds-label')
      .filter({hasText: 'Key'})
      .locator('input');
  }

  get createFormFlowButton() {
    return this.page.locator('cds-modal-footer').getByRole('button', {name: 'Create'});
  }

  get cancelFormFlowButton() {
    return this.page.locator('cds-modal-footer').getByRole('button', {name: 'Cancel'});
  }

  // ─── Cleanup ───────────────────────────────────────────────────────

  async cleanupStaleFormFlows() {
    const staleRowLocator = this.formFlowsList.locator('tbody tr').filter({
      has: this.page.locator('td', {hasText: 'e2e-'}),
    });

    let count = await staleRowLocator.count();
    while (count > 0) {
      const row = new CarbonListRow(this.page, staleRowLocator.first());
      await row.clickAction('Delete');
      await this.page.getByRole('button', {name: 'Delete'}).click();
      await this.page.waitForTimeout(500);
      count = await staleRowLocator.count();
    }
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

  // The editor page opens on the visual editor tab; the JSON (Monaco) editor lives in its own tab.
  async openJsonEditorTab() {
    await this.page.getByRole('tab', {name: 'JSON editor'}).click();
    await expect(this.monacoEditor).toBeVisible();
  }

  // ─── Visual Editor Elements ────────────────────────────────────────

  get visualStepList() {
    return this.page.locator('[data-test-id="formFlowEditorStepList"]');
  }

  get visualStepListItems() {
    return this.page.locator('[data-test-id="formFlowEditorStepListItem"]');
  }

  get visualAddStepButton() {
    return this.page.locator('[data-test-id="formFlowEditorAddStepButton"]');
  }

  get visualStepKeyInput() {
    return this.page.locator('[data-test-id="formFlowEditorStepKeyInput"]');
  }

  get visualStepTitleInput() {
    return this.page.locator('[data-test-id="formFlowEditorStepTitleInput"]');
  }

  get visualStepPropertyInput() {
    return this.page.locator('[data-test-id="formFlowEditorStepPropertyInput"]');
  }

  get visualFormDefinitionDropdown() {
    return this.page.locator('[data-test-id="formFlowEditorStepPropertyDropdown"]');
  }

  get visualMakeStartStepButton() {
    return this.page.locator('[data-test-id="formFlowEditorMakeStartStepButton"]');
  }

  get visualAddTransitionButton() {
    return this.page.locator('[data-test-id="formFlowEditorAddTransitionButton"]');
  }

  get visualTransitionRow() {
    return this.page.locator('[data-test-id="formFlowEditorTransitionRow"]');
  }

  // ─── Visual Editor Actions ─────────────────────────────────────────

  async openVisualEditorTab() {
    await this.page.getByRole('tab', {name: 'Editor', exact: true}).click();
    await expect(this.visualStepList).toBeVisible();
  }

  async selectVisualStep(index: number) {
    await this.visualStepListItems.nth(index).click();
  }

  async addVisualStep() {
    await this.visualAddStepButton.click();
    await expect(this.visualStepKeyInput).toBeVisible();
  }

  async selectVisualTransitionTarget(rowIndex: number, targetStepKey: string) {
    await this.selectCarbonDropdownOption(this.visualTransitionRow.nth(rowIndex), targetStepKey);
  }

  // Picks the first available form of the case definition and returns its name.
  async selectFirstVisualFormDefinition(): Promise<string> {
    return this.selectCarbonDropdownOption(this.visualFormDefinitionDropdown);
  }

  // Opens the Carbon dropdown inside `root` and picks the named option, or the first option when
  // no name is given. Returns the picked option's text.
  private async selectCarbonDropdownOption(root: Locator, optionName?: string): Promise<string> {
    await root.locator('cds-dropdown button').first().click();
    const option = optionName
      ? this.page.getByRole('option', {name: optionName})
      : this.page.getByRole('option').first();
    const name = (await option.textContent())?.trim() ?? '';
    await option.click();
    return name;
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
    await expect(this.page.getByText(`${key} was saved successfully`).first()).toBeVisible({
      timeout: 15_000,
    });
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

  async assertEditorPageVisible() {
    await expect(this.page.getByRole('tab', {name: 'JSON editor'})).toBeVisible();
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
