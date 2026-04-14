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
import {ensureDraftVersionSelected} from '../../utils/version.utils';

export class CaseDetailsManagementHeaderPage {
  constructor(
    private readonly page: Page,
    private readonly request: APIRequestContext
  ) {}

  // ─── UI Elements — Header tab ────────────────────────────────────

  get headerTabPanel() {
    return this.page.getByRole('tabpanel', {name: 'Header'});
  }

  get widgetManagement() {
    return this.headerTabPanel.locator('valtimo-widget-management');
  }

  get widgetList() {
    return this.headerTabPanel.locator('valtimo-carbon-list');
  }

  get toolbarAddWidgetButton() {
    return this.headerTabPanel
      .getByLabel('Table action bar')
      .getByRole('button', {name: 'Add widget'});
  }

  get emptyStateAddWidgetButton() {
    return this.headerTabPanel
      .locator('valtimo-no-results')
      .getByRole('button', {name: 'Add widget'});
  }

  get emptyState() {
    return this.headerTabPanel.locator('valtimo-no-results');
  }

  get widgetRows() {
    return this.widgetList.locator('tbody tr');
  }

  // ─── UI Elements — Wizard ────────────────────────────────────────

  get wizardModal() {
    return this.page.locator('valtimo-widget-management-wizard cds-modal');
  }

  get wizardHeading() {
    return this.wizardModal.locator('cds-modal-header h3');
  }

  get wizardNextButton() {
    return this.wizardModal.locator('.valtimo-widget-management-wizard__next');
  }

  get wizardCancelButton() {
    return this.wizardModal.locator('.valtimo-widget-management-wizard__cancel');
  }

  get wizardBackButton() {
    return this.wizardModal.locator('.valtimo-widget-management-wizard__back');
  }

  get fieldsTypeTile() {
    return this.wizardModal.locator('cds-selection-tile').filter({hasText: 'Fields'});
  }

  // ─── Navigation ───────────────────────────────────────────────────

  async goToCaseManagement(caseIdentifier: string) {
    await this.page.getByRole('button', {name: 'Admin'}).click();
    await this.page.getByRole('link', {name: 'Cases'}).click();
    await this.page.waitForSelector('valtimo-carbon-list');
    await this.page.locator(`tr:has(td:has-text("${caseIdentifier}"))`).click();
  }

  async switchToCaseDetailsHeader() {
    await this.page.getByRole('tab', {name: 'Case details'}).click();
    await this.page.getByRole('tab', {name: 'Header'}).click();
  }

  async ensureDraftVersionSelected(): Promise<string> {
    return ensureDraftVersionSelected(this.page);
  }

  // ─── Wizard interactions ──────────────────────────────────────────

  async openAddWidgetWizard() {
    await this.emptyStateAddWidgetButton.click();
    await expect(this.wizardHeading).toBeVisible({timeout: 10_000});
  }

  async selectFieldsWidgetType() {
    await this.fieldsTypeTile.click();
  }

  async clickNext() {
    await expect(this.wizardNextButton).toBeEnabled();
    await this.wizardNextButton.click();
  }

  async clickSave() {
    await expect(this.wizardNextButton).toBeEnabled();
    await this.wizardNextButton.click();
  }

  async cancelWizard() {
    await this.wizardCancelButton.click();
  }

  async fillFieldContent(title: string, valuePath: string, displayType = 'Text') {
    // Expand the first accordion item if collapsed
    const accordionItem = this.wizardModal.locator('cds-accordion-item').first();
    const isExpanded = await accordionItem.getAttribute('expanded');
    if (isExpanded === null || isExpanded === 'false') {
      await accordionItem.click();
    }

    // Fill the field title
    await this.page.getByRole('textbox', {name: 'Title'}).fill(title);

    // Select the display type from the dropdown
    await this.page.getByRole('button', {name: 'Display type'}).click();
    await this.page.getByText(displayType, {exact: true}).click();

    // Select the value path from the combobox
    await this.page.getByRole('combobox', {name: 'Select a path'}).click();
    await this.page.getByText(valuePath).click();
  }

  async addHeaderWidget(fieldTitle: string, valuePath: string) {
    await this.openAddWidgetWizard();
    await this.selectFieldsWidgetType();
    await this.clickNext();
    await this.fillFieldContent(fieldTitle, valuePath);
    await this.clickSave();
  }

  // ─── Assertions ───────────────────────────────────────────────────

  async assertWidgetManagementVisible() {
    await expect(this.widgetManagement).toBeVisible();
  }

  async assertWidgetListVisible() {
    await expect(this.widgetList).toBeVisible();
  }

  async assertEmptyStateVisible() {
    await expect(this.emptyState).toBeVisible();
    await expect(this.emptyState).toContainText('No widget has been configured');
  }

  async assertEmptyStateNotVisible() {
    await expect(this.emptyState).not.toBeVisible();
  }

  async assertWidgetRowCount(expectedCount: number) {
    await expect(this.widgetRows).toHaveCount(expectedCount);
  }

  async assertWidgetTypeTag(expectedType: string) {
    const typeTag = this.widgetList.locator('cds-tag').first();
    await expect(typeTag).toContainText(expectedType);
  }

  async assertToolbarAddWidgetButtonDisabled() {
    await expect(this.toolbarAddWidgetButton).toBeDisabled();
  }

  async assertEmptyStateAddWidgetButtonEnabled() {
    await expect(this.emptyStateAddWidgetButton).toBeEnabled();
  }

  async assertWizardOpen() {
    await expect(this.wizardHeading).toBeVisible({timeout: 10_000});
  }

  async assertWizardClosed() {
    await expect(this.wizardHeading).not.toBeVisible({timeout: 10_000});
  }

  async assertWizardNextDisabled() {
    await expect(this.wizardNextButton).toBeDisabled();
  }

  async assertWizardNextEnabled() {
    await expect(this.wizardNextButton).toBeEnabled();
  }

  // ─── API Helpers ──────────────────────────────────────────────────

  async getHeaderWidgetViaApi(caseDefinitionKey: string, versionTag: string) {
    try {
      return await ApiUtils.apiGet(
        endpoints.caseDefinition.headerWidget(caseDefinitionKey, versionTag)
      );
    } catch {
      return null;
    }
  }

  async createHeaderWidgetViaApi(
    caseDefinitionKey: string,
    versionTag: string,
    widget: object
  ) {
    try {
      return await ApiUtils.apiPost(
        endpoints.caseDefinition.headerWidget(caseDefinitionKey, versionTag),
        widget
      );
    } catch {
      // POST fails if the widget was previously deleted (row still exists) — fall back to PUT
      return ApiUtils.apiPut(
        endpoints.caseDefinition.headerWidget(caseDefinitionKey, versionTag),
        widget
      );
    }
  }

  async deleteHeaderWidgetViaApi(caseDefinitionKey: string, versionTag: string) {
    try {
      await ApiUtils.apiDelete(
        endpoints.caseDefinition.headerWidget(caseDefinitionKey, versionTag)
      );
    } catch {
      // Widget may not exist
    }
  }
}
