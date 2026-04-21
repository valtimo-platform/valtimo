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

import {type APIRequestContext, type Locator, type Page, expect} from '@playwright/test';
import path from 'path';
import {
  DECISION_LIST_TEST_IDS,
  DECISION_MODELER_TEST_IDS,
  DECISION_UPLOAD_TEST_IDS,
} from '../../constants';
import {CarbonList} from '../../shared/carbon-list/carbon-list.utils';
import {apiDelete} from '../../utils/api.utils';
import {ensureDraftVersionSelected} from '../../utils/version.utils';

const DMN_ASSET_PATH = path.resolve(__dirname, '../../assets/decisionTables/e2e-test-decision.dmn');

export class CaseDetailsDecisionsPage {
  readonly carbonList: CarbonList;
  private readonly decisionListScope: Locator;

  constructor(
    private readonly page: Page,
    private readonly request: APIRequestContext
  ) {
    this.decisionListScope = page.locator('valtimo-decision-list');
    this.carbonList = new CarbonList(page, this.decisionListScope);
  }

  // ─── Navigation ────────────────────────────────────────────────────

  async goToCaseDecisions(caseIdentifier: string): Promise<string> {
    await this.page.getByRole('button', {name: 'Admin'}).click();
    await this.page.getByRole('link', {name: 'Cases'}).click();
    await this.page.waitForSelector('valtimo-carbon-list');
    await this.page.locator(`tr:has(td:has-text("${caseIdentifier}"))`).click();
    await this.page.waitForURL(/\/case-management\/case\//);

    // Decision tables can only be uploaded/edited on a draft version
    const draftVersion = await ensureDraftVersionSelected(this.page);

    await this.page.getByRole('tab', {name: 'Decision tables'}).click();
    await this.page.waitForURL(/\/decisions$/);
    await this.carbonList.waitForLoaded();

    return draftVersion;
  }

  // ─── List (6.39) ──────────────────────────────────────────────────

  async assertListLoaded() {
    await this.carbonList.waitForLoaded();
    await expect(this.carbonList.table).toBeVisible();
  }

  async assertDecisionVisible(decisionKey: string) {
    const row = this.carbonList.row(decisionKey);
    await row.assertVisible();
  }

  async assertDecisionNotVisible(decisionKey: string) {
    const row = this.carbonList.row(decisionKey);
    await row.assertNotVisible();
  }

  async clickDecisionRow(decisionKey: string) {
    const row = this.carbonList.row(decisionKey);
    await row.click();
  }

  // ─── Upload modal (6.40) ──────────────────────────────────────────

  get uploadButton() {
    return this.page.getByTestId(DECISION_LIST_TEST_IDS.uploadButton);
  }

  get uploadModal() {
    return this.page.locator('valtimo-decision-deploy cds-modal');
  }

  get uploadModalSubmitButton() {
    return this.page.getByTestId(DECISION_UPLOAD_TEST_IDS.submitButton);
  }

  get uploadModalFileInput() {
    return this.uploadModal.locator('input[type="file"]');
  }

  async openUploadModal() {
    await this.uploadButton.click();
    await expect(this.uploadModalSubmitButton).toBeVisible();
  }

  async uploadDmnFile(filePath: string = DMN_ASSET_PATH) {
    await this.openUploadModal();
    // Upload submit is disabled until a .dmn is selected
    await expect(this.uploadModalSubmitButton).toBeDisabled();
    await this.uploadModalFileInput.setInputFiles(filePath);
    await expect(this.uploadModalSubmitButton).toBeEnabled();
    await this.uploadModalSubmitButton.click();
    // Modal closes on successful upload
    await expect(this.uploadModalSubmitButton).not.toBeVisible();
    await this.carbonList.waitForLoaded();
  }

  // ─── Modeler / Save (6.45) ────────────────────────────────────────

  get modelerContainer() {
    return this.page.locator('.dmn-editor');
  }

  get deployButton() {
    return this.page.getByTestId(DECISION_MODELER_TEST_IDS.deployButton);
  }

  get backButton() {
    return this.page.getByTestId(DECISION_MODELER_TEST_IDS.backButton);
  }

  async saveDecision() {
    await expect(this.deployButton).toBeEnabled();
    await this.deployButton.click();
  }

  async navigateBackFromModeler() {
    await this.backButton.click();
    await this.page.waitForURL(/\/decisions$/);
    await this.carbonList.waitForLoaded();
  }

  get modelerTabs() {
    return this.page.locator('.editor-tabs');
  }

  get decisionTableTab() {
    return this.modelerTabs.locator('.tab:has(.dmn-icon-decision-table)');
  }

  async switchToDecisionTableView() {
    await this.decisionTableTab.click();
    await expect(this.decisionTable).toBeVisible();
  }

  get decisionTable() {
    return this.page.locator('.editor-container table.tjs-table').first();
  }

  get decisionTableContainer() {
    return this.decisionTable;
  }

  get inputColumnHeaders() {
    return this.decisionTable.locator('thead th.input-cell');
  }

  get outputColumnHeaders() {
    return this.decisionTable.locator('thead th.output-cell');
  }

  inputColumnHeader(label: string) {
    return this.inputColumnHeaders.filter({hasText: label});
  }

  outputColumnHeader(label: string) {
    return this.outputColumnHeaders.filter({hasText: label});
  }

  get ruleRows() {
    return this.decisionTable.locator('tbody tr');
  }

  /** Hit-policy cell wrapper in the modeler (editable variant). */
  get hitPolicyCell() {
    return this.page.locator('.editor-container .hit-policy').first();
  }

  get hitPolicyDisplay() {
    return this.hitPolicyCell.locator('.dms-input');
  }

  hitPolicyDropdownOption(label: string) {
    return this.page.locator('.dms-select-options .option').filter({hasText: label});
  }

  async openHitPolicyDropdown() {
    await this.hitPolicyDisplay.click();
    await expect(this.page.locator('.dms-select-options')).toBeVisible();
  }

  async selectHitPolicyOption(label: string) {
    await this.openHitPolicyDropdown();
    await this.hitPolicyDropdownOption(label).click();
    await expect(this.hitPolicyDisplay).toContainText(label);
  }

  get addInputButton() {
    return this.page.locator('.editor-container .add-input button').first();
  }

  get addRuleButton() {
    return this.page.locator('.editor-container tfoot.add-rule td.add-rule-add button').first();
  }

  async clickAddInputColumn() {
    await this.addInputButton.click();
  }

  async clickAddRule() {
    await this.addRuleButton.click();
  }

  // ─── API cleanup ──────────────────────────────────────────────────

  async deleteDecisionViaApi(caseKey: string, version: string, decisionKey: string) {
    try {
      await apiDelete(
        `/api/management/v1/case-definition/${caseKey}/version/${version}/decision-definition/${decisionKey}`
      );
    } catch {
      // Ignore — decision may not exist
    }
  }

  async reloadList() {
    await this.page.reload();
    await this.carbonList.waitForLoaded();
  }
}
