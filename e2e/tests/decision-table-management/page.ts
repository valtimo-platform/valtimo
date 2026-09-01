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
import {
  DECISION_FORM_TEST_IDS,
  DECISION_LIST_TEST_IDS,
  DECISION_MODELER_TEST_IDS,
  DECISION_UPLOAD_TEST_IDS,
} from '../../constants';
import * as ApiUtils from '../../utils/api.utils';

/** A decision definition as returned by `GET /api/management/v1/decision-definition`. */
export interface DecisionDefinition {
  id: string;
  key: string;
  name: string;
  version: number;
}

export class DecisionTableManagementPage {
  constructor(
    private readonly page: Page,
    private readonly request: APIRequestContext
  ) {}

  // ─── Navigation ───────────────────────────────────────────────────

  async goToDecisionTables() {
    await this.page.goto('/decision-tables');
    await this.page.waitForSelector('valtimo-carbon-list');
  }

  // ─── List ─────────────────────────────────────────────────────────

  get list() {
    return new CarbonList(this.page);
  }

  get decisionList() {
    return this.page.locator('valtimo-carbon-list');
  }

  get createButton() {
    return this.page.getByTestId(DECISION_LIST_TEST_IDS.createButton);
  }

  get uploadButton() {
    return this.page.getByTestId(DECISION_LIST_TEST_IDS.uploadButton);
  }

  get uploadSubmitButton() {
    return this.visibleModal.getByTestId(DECISION_UPLOAD_TEST_IDS.submitButton);
  }

  row(key: string): CarbonListRow {
    return this.list.row(key);
  }

  // ─── Create modal ─────────────────────────────────────────────────
  //
  // The create and edit variants of the form modal are both in the DOM, so they share the same
  // test ids. Every locator is scoped to the modal that is actually visible.

  get visibleModal(): Locator {
    return this.page.locator('.cds--modal.is-visible');
  }

  get nameInput() {
    return this.visibleModal.getByTestId(DECISION_FORM_TEST_IDS.nameInput);
  }

  get inputVariables() {
    return this.visibleModal.getByTestId(DECISION_FORM_TEST_IDS.inputVariables);
  }

  get createSubmitButton() {
    return this.visibleModal.getByTestId(DECISION_FORM_TEST_IDS.submitButton);
  }

  async openCreateModal() {
    await this.createButton.click();
    await expect(this.nameInput).toBeVisible();
  }

  /** Adds an input variable row to the create modal's multi-input. */
  async addInputVariable(processVariable: string, label: string) {
    await this.inputVariables.getByTestId('multiInputAddButton').click();
    const keyInput = this.inputVariables.getByTestId('keyValueKeyInput').first();
    const valueInput = this.inputVariables.getByTestId('keyValueValueInput').first();
    await keyInput.fill(processVariable);
    await valueInput.fill(label);
    await expect(keyInput).toHaveValue(processVariable);
  }

  /** Submits the create modal; this opens the DMN modeler but does not deploy anything yet. */
  async submitCreateModal() {
    await expect(this.createSubmitButton).toBeEnabled();
    await this.createSubmitButton.click();
    await this.page.waitForURL('**/decision-tables/edit/create');
  }

  // ─── DMN modeler ──────────────────────────────────────────────────

  get modeler() {
    return this.page.locator('valtimo-decision-modeler');
  }

  /** The dmn-js canvas — proof the modeler actually mounted rather than just the page shell. */
  get modelerCanvas() {
    return this.page.locator('.dmn-js-parent');
  }

  get deployButton() {
    return this.page.getByTestId(DECISION_MODELER_TEST_IDS.deployButton);
  }

  get readOnlyTag() {
    return this.page.getByTestId(DECISION_MODELER_TEST_IDS.readOnlyTag);
  }

  async openDecisionInModeler(key: string) {
    await this.row(key).click();
    await this.page.waitForURL('**/decision-tables/edit/**');
    await expect(this.modelerCanvas).toBeVisible();
  }

  // ─── Row actions ──────────────────────────────────────────────────

  async openRowMenu(key: string) {
    await this.row(key).openActionMenu();
  }

  menuItem(key: string, name: string) {
    return this.row(key).actionMenuItem(name);
  }

  // ─── Assertions ───────────────────────────────────────────────────

  async assertColumnHeaders(expected: string[]) {
    const headers = (await this.page.locator('valtimo-carbon-list thead th').allInnerTexts()).map(h =>
      h.trim()
    );
    for (const header of expected) expect(headers).toContain(header);
  }

  async assertDecisionVisible(key: string) {
    await expect(this.page.locator(`td:has-text("${key}")`).first()).toBeVisible();
  }

  /** The list shows the latest version per key, so compare against the highest version per key. */
  async assertListMatchesApi() {
    const definitions = await this.getDecisionDefinitionsViaApi();
    const latestByKey = new Map<string, number>();
    for (const definition of definitions) {
      latestByKey.set(definition.key, Math.max(latestByKey.get(definition.key) ?? 0, definition.version));
    }

    expect(latestByKey.size).toBeGreaterThan(0);
    for (const [key, version] of latestByKey) {
      const row = this.row(key);
      await row.assertVisible();
      await expect(row.cell(String(version))).toBeVisible();
    }
  }

  // ─── API ──────────────────────────────────────────────────────────

  /** Only the "global" decision tables: those not linked to a case or building block. */
  async getDecisionDefinitionsViaApi(): Promise<DecisionDefinition[]> {
    return ApiUtils.apiGet<DecisionDefinition[]>('/api/management/v1/decision-definition');
  }

  async getDecisionKeysViaApi(): Promise<string[]> {
    const definitions = await this.getDecisionDefinitionsViaApi();
    return [...new Set(definitions.map(d => d.key))];
  }
}
