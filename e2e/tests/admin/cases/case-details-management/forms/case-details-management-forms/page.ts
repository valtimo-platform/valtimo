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
import {
  FORM_MANAGEMENT_CREATE_TEST_IDS,
  FORM_MANAGEMENT_EDIT_TEST_IDS,
  FORM_MANAGEMENT_LIST_TEST_IDS,
} from '../../../../../../constants';
import {CarbonList} from '../../../../../../shared/carbon-list/carbon-list.utils';
import {apiDelete, apiGet, apiPost} from '../../../../../../utils/api.utils';
import {ensureDraftVersionSelected} from '../../../../../../utils/version.utils';

export class CaseDetailsFormsPage {
  readonly carbonList: CarbonList;
  private readonly formListScope: Locator;

  constructor(
    private readonly page: Page,
    private readonly request: APIRequestContext
  ) {
    this.formListScope = page.locator('valtimo-form-management-list');
    this.carbonList = new CarbonList(page, this.formListScope);
  }

  // ─── Navigation ────────────────────────────────────────────────────

  async goToCaseForms(caseIdentifier: string): Promise<string> {
    await this.page.getByRole('button', {name: 'Admin'}).click();
    await this.page.getByRole('link', {name: 'Cases'}).click();
    await this.page.waitForSelector('valtimo-carbon-list');
    await this.page.locator(`tr:has(td:has-text("${caseIdentifier}"))`).click();
    await this.page.waitForURL(/\/case-management\/case\//);

    // Forms can only be created/edited on a draft version
    const draftVersion = await ensureDraftVersionSelected(this.page);

    await this.page.getByRole('tab', {name: 'Forms'}).click();
    await this.page.waitForURL(/\/forms$/);
    await this.carbonList.waitForLoaded();

    return draftVersion;
  }

  // ─── List (6.50-ish assertions; kept minimal) ─────────────────────

  async assertFormVisible(formName: string) {
    const row = this.carbonList.row(formName);
    await row.assertVisible();
  }

  // ─── Create form (6.52) ───────────────────────────────────────────

  get createFormButton() {
    return this.carbonList.toolbar.getByTestId(FORM_MANAGEMENT_LIST_TEST_IDS.createFormButton);
  }

  get createModalNameInput() {
    return this.page.getByTestId(FORM_MANAGEMENT_CREATE_TEST_IDS.nameInput);
  }

  get createModalSubmitButton() {
    return this.page.getByTestId(FORM_MANAGEMENT_CREATE_TEST_IDS.submitButton);
  }

  async openCreateModal() {
    await this.createFormButton.click();
    await expect(this.createModalNameInput).toBeVisible();
  }

  async submitCreateModalWithName(formName: string) {
    await this.createModalNameInput.fill(formName);
    await expect(this.createModalSubmitButton).toBeEnabled();
    await this.createModalSubmitButton.click();

    // After creation, the case-context URL ends with /forms/<formDefinitionId>
    await this.page.waitForURL(/\/forms\/[^/]+$/);
  }

  // ─── Form.io builder (6.53 / 6.54) ────────────────────────────────

  sidebarComponent(type: string) {
    return this.page.locator(`[ref="sidebar-component"][data-type="${type}"]`).first();
  }

  get formArea() {
    return this.page.locator('[ref="form"]').first();
  }

  placedComponents(type: string) {
    return this.formArea.locator(`.formio-component-${type}`);
  }

  componentLabel(label: string) {
    return this.formArea.locator(`label:has-text("${label}")`);
  }

  // ─── Form.io edit-component modal ─────────────────────────────────

  get editComponentModal() {
    return this.page.locator('.formio-dialog.component-settings');
  }

  get editComponentLabelInput() {
    return this.editComponentModal.locator('input[name="data[label]"]');
  }

  get editComponentSaveButton() {
    return this.editComponentModal.locator('button[ref="saveButton"]');
  }

  async dragComponentIntoForm(type: string, maxAttempts = 3) {
    const source = this.sidebarComponent(type);
    const target = this.formArea;

    await expect(source).toBeVisible();
    await expect(target).toBeVisible();

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Use Playwright's built-in dragTo which dispatches proper HTML drag events
      await source.dragTo(target, {
        sourcePosition: {x: 5, y: 5},
        targetPosition: {x: 50, y: 50},
      });

      try {
        await expect(this.editComponentModal).toBeVisible({timeout: 5_000});
        return; // Success
      } catch {
        if (attempt === maxAttempts) {
          // Last resort: try manual mouse-based drag
          const sourceBB = await source.boundingBox();
          const targetBB = await target.boundingBox();
          if (!sourceBB || !targetBB) throw new Error('Could not get bounding boxes for drag');

          const sx = sourceBB.x + sourceBB.width / 2;
          const sy = sourceBB.y + sourceBB.height / 2;
          const tx = targetBB.x + targetBB.width / 2;
          const ty = targetBB.y + targetBB.height / 2;

          await this.page.mouse.move(sx, sy);
          await this.page.mouse.down();
          await this.page.waitForTimeout(500);
          await this.page.mouse.move(sx + 10, sy + 10, {steps: 5});
          await this.page.waitForTimeout(500);
          await this.page.mouse.move(tx, ty, {steps: 50});
          await this.page.waitForTimeout(500);
          await this.page.mouse.up();

          await expect(this.editComponentModal).toBeVisible({timeout: 10_000});
        }
      }
    }
  }

  async configureAndSaveComponent(label: string) {
    await expect(this.editComponentLabelInput).toBeVisible();
    await this.editComponentLabelInput.fill(label);
    await this.editComponentSaveButton.click();
    await expect(this.editComponentModal).not.toBeVisible();
  }

  // ─── Tabs (Form builder / JSON editor / Output) ──────────────────

  get builderTab() {
    return this.page.getByRole('tab', {name: 'Form builder'});
  }

  get jsonEditorTab() {
    return this.page.getByRole('tab', {name: 'JSON editor'});
  }

  get outputTab() {
    return this.page.getByRole('tab', {name: 'Output'});
  }

  async switchToJsonEditorTab() {
    await this.jsonEditorTab.click();
    await expect(this.monacoEditor).toBeVisible({timeout: 15_000});
  }

  async switchToOutputTab() {
    await this.outputTab.click();
    await expect(this.outputPreview).toBeVisible({timeout: 10_000});
  }

  // ─── JSON editor (6.55) ───────────────────────────────────────────

  get monacoEditor() {
    return this.page.locator('.monaco-editor').first();
  }

  get monacoViewLines() {
    return this.monacoEditor.locator('.view-lines');
  }

  // ─── Output preview (6.56) ────────────────────────────────────────

  /** The rendered Form.io form (live preview) under the Output tab. */
  get outputPreview() {
    return this.page.locator('valtimo-form-io').first();
  }

  /** Input inside the Output-tab preview, located by its visible label. */
  previewInputByLabel(label: string) {
    return this.outputPreview
      .locator('.formio-component-textfield')
      .filter({hasText: label})
      .locator('input');
  }

  get outputJsonView() {
    return this.page.locator('.monaco-editor').first();
  }

  // ─── Save form (6.57) ─────────────────────────────────────────────

  get saveFormButton() {
    return this.page.getByTestId(FORM_MANAGEMENT_EDIT_TEST_IDS.saveButton);
  }

  async saveForm() {
    await expect(this.saveFormButton).toBeEnabled();
    await this.saveFormButton.click();
  }

  // ─── API cleanup ──────────────────────────────────────────────────

  async deleteFormByNameViaApi(caseKey: string, version: string, formName: string) {
    try {
      const form = await this.findFormByNameViaApi(caseKey, version, formName);
      if (form) {
        await apiDelete(
          `/api/management/v1/case-definition/${caseKey}/version/${version}/form/${form.id}`
        );
      }
    } catch {
      // ignore cleanup errors
    }
  }

  async findFormByNameViaApi(caseKey: string, version: string, formName: string) {
    const body = await apiGet<{content?: Array<{id: string; name: string}>}>(
      `/api/management/v1/case-definition/${caseKey}/version/${version}/form?size=500`
    );
    return body.content?.find(form => form.name === formName);
  }

  async fetchFormDefinitionViaApi(caseKey: string, version: string, formId: string) {
    return apiGet<{id: string; name: string; formDefinition: {components?: Array<{label?: string}>}}>(
      `/api/management/v1/case-definition/${caseKey}/version/${version}/form/${formId}`
    );
  }

  async createFormWithTextFieldViaApi(
    caseKey: string,
    version: string,
    formName: string,
    textFieldLabel: string
  ): Promise<string> {
    const formDefinition = {
      display: 'form',
      components: [
        {
          type: 'textfield',
          input: true,
          label: textFieldLabel,
          key: textFieldLabel.toLowerCase().replace(/[^a-z0-9]+/g, ''),
        },
      ],
    };

    const response = await apiPost<{id: string}>(
      `/api/management/v1/case-definition/${caseKey}/version/${version}/form`,
      {
        name: formName,
        formDefinition: JSON.stringify(formDefinition),
      }
    );
    return response.id;
  }

  async goToFormEditPage(caseKey: string, version: string, formId: string) {
    await this.page.goto(`/case-management/case/${caseKey}/version/${version}/forms/${formId}`);
    await expect(this.saveFormButton).toBeVisible();
  }
}
