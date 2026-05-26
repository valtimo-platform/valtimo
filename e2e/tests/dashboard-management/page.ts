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

import {expect, type Page} from '@playwright/test';
import {
  DASHBOARD_MANAGEMENT_TEST_IDS,
  VALUE_PATH_SELECTOR_TEST_IDS,
  VALUE_PATH_SELECTOR_DROPDOWN_VALUE_TEST_IDS,
  KEY_DROPDOWN_VALUE_TEST_IDS,
} from '../../constants';
import {CarbonList} from '../../shared/carbon-list/carbon-list.utils';
import * as ApiUtils from '../../utils/api.utils';
import {endpoints} from '../../api/endpoints';

interface DashboardListItem {
  key: string;
  title: string;
  description: string;
}

export class DashboardManagementPage {
  readonly carbonList: CarbonList;

  constructor(private readonly page: Page) {
    this.carbonList = new CarbonList(this.page);
  }

  // ─── Locators ─────────────────────────────────────────────────────

  get addDashboardButton() {
    return this.page.getByTestId(DASHBOARD_MANAGEMENT_TEST_IDS.addButton);
  }

  get createTitleInput() {
    return this.page.getByTestId(DASHBOARD_MANAGEMENT_TEST_IDS.createTitleInput);
  }

  get createDescriptionInput() {
    return this.page.getByTestId(DASHBOARD_MANAGEMENT_TEST_IDS.createDescriptionInput);
  }

  get createButton() {
    return this.page.getByTestId(DASHBOARD_MANAGEMENT_TEST_IDS.createButton);
  }

  get editButton() {
    return this.page.getByTestId(DASHBOARD_MANAGEMENT_TEST_IDS.editButton);
  }

  get editTitleInput() {
    return this.page.getByTestId(DASHBOARD_MANAGEMENT_TEST_IDS.editTitleInput);
  }

  get editDescriptionInput() {
    return this.page.getByTestId(DASHBOARD_MANAGEMENT_TEST_IDS.editDescriptionInput);
  }

  get completeButton() {
    return this.page.getByTestId(DASHBOARD_MANAGEMENT_TEST_IDS.completeButton);
  }

  get switchViewButton() {
    return this.page.getByTestId(DASHBOARD_MANAGEMENT_TEST_IDS.switchViewButton);
  }

  get pageSubtitle() {
    return this.page.locator('span.page-subtitle');
  }

  get monacoEditor() {
    return this.page.locator('.monaco-editor');
  }

  get widgetList() {
    return this.page.locator('valtimo-carbon-list');
  }

  // ─── Widget Locators ──────────────────────────────────────────────

  get addWidgetButton() {
    // Scope to toolbar to avoid matching the duplicate button in the no-results panel
    return this.page.getByLabel('Table action bar').getByTestId(DASHBOARD_MANAGEMENT_TEST_IDS.addWidgetButton);
  }

  get widgetTitleInput() {
    return this.page.getByTestId(DASHBOARD_MANAGEMENT_TEST_IDS.widgetTitleInput);
  }

  get widgetDataSourceDropdown() {
    return this.page.getByTestId(DASHBOARD_MANAGEMENT_TEST_IDS.widgetDataSourceDropdown);
  }

  get widgetDisplayTypeDropdown() {
    return this.page.getByTestId(DASHBOARD_MANAGEMENT_TEST_IDS.widgetDisplayTypeDropdown);
  }

  get widgetUrlInput() {
    return this.page.getByTestId(DASHBOARD_MANAGEMENT_TEST_IDS.widgetUrlInput);
  }

  get widgetSaveButton() {
    return this.page.getByTestId(DASHBOARD_MANAGEMENT_TEST_IDS.widgetSaveButton);
  }

  get widgetCancelButton() {
    return this.page.getByTestId(DASHBOARD_MANAGEMENT_TEST_IDS.widgetCancelButton);
  }

  get widgetDeleteButton() {
    return this.page.getByTestId(DASHBOARD_MANAGEMENT_TEST_IDS.widgetDeleteButton);
  }

  // ─── Navigation ───────────────────────────────────────────────────

  async goToDashboardManagement() {
    const adminButton = this.page.getByRole('button', {name: 'Admin'});
    if ((await adminButton.getAttribute('aria-expanded')) !== 'true') {
      await adminButton.click();
    }
    await this.page
      .locator('[data-testid="sidenav-item-Admin"]')
      .getByRole('link', {name: 'Dashboard'})
      .click();
    await this.carbonList.waitForLoaded();
  }

  async goToDashboardDetails(dashboardTitle: string) {
    await this.carbonList.waitForLoaded();
    const row = this.carbonList.row(dashboardTitle);
    await row.click();
    // Wait for the widget list to load on the details page
    await this.page.waitForSelector('valtimo-carbon-list');
    const detailList = new CarbonList(this.page);
    await detailList.waitForLoaded();
  }

  // ─── Dashboard Actions ────────────────────────────────────────────

  async createDashboard(title: string, description: string) {
    await this.addDashboardButton.click();
    await expect(this.createTitleInput).toBeVisible();

    await this.createTitleInput.fill(title);
    await this.createDescriptionInput.fill(description);

    const [response] = await Promise.all([
      this.page.waitForResponse(
        res =>
          res.url().includes('/api/management/v1/dashboard') &&
          res.request().method() === 'POST' &&
          res.ok()
      ),
      this.createButton.click(),
    ]);

    return response;
  }

  async editDashboard(title: string, description: string) {
    await this.editButton.click();
    await expect(this.editTitleInput).toBeVisible();

    await this.editTitleInput.clear();
    await this.editTitleInput.fill(title);
    await this.editDescriptionInput.clear();
    await this.editDescriptionInput.fill(description);

    const [response] = await Promise.all([
      this.page.waitForResponse(
        res =>
          res.url().includes('/api/management/v1/dashboard') &&
          res.request().method() === 'PUT' &&
          res.ok()
      ),
      this.completeButton.click(),
    ]);

    return response;
  }

  async switchToJsonEditor() {
    await this.switchViewButton.click();
    await expect(this.monacoEditor).toBeVisible();
  }

  async switchToVisualEditor() {
    await this.switchViewButton.click();
    await this.page.waitForSelector('valtimo-carbon-list');
  }

  // ─── Widget Modal Actions ─────────────────────────────────────────

  async openAddWidgetModal() {
    await this.addWidgetButton.click();
    await expect(this.widgetTitleInput).toBeVisible();
  }

  /**
   * Fill the widget form in the add/edit modal.
   * Selects data source and display type from their dropdowns.
   */
  async fillWidgetForm(opts: {
    title: string;
    dataSourceLabel?: string;
    displayTypeLabel?: string;
    displayTypeTitle?: string;
    caseType?: string;
  }) {
    await this.widgetTitleInput.fill(opts.title);

    if (opts.dataSourceLabel) {
      await this.widgetDataSourceDropdown.click();
      await this.page.getByText(opts.dataSourceLabel, {exact: true}).click();
    }

    // If a case type needs to be selected (for case-count data source)
    if (opts.caseType) {
      // Wait for the data source configuration component to load
      await this.page.waitForTimeout(500);
      // The case type dropdown is inside the widget-configuration-container
      const caseTypeDropdown = this.page.locator('valtimo-widget-configuration-container cds-dropdown').first();
      await caseTypeDropdown.click();
      await this.page.getByText(opts.caseType, {exact: true}).click();
    }

    if (opts.displayTypeLabel) {
      // Wait for display types to become available after selecting data source
      await expect(this.widgetDisplayTypeDropdown).toBeEnabled({timeout: 5_000});
      await this.widgetDisplayTypeDropdown.click();
      await this.page.getByText(opts.displayTypeLabel, {exact: true}).click();
    }

    // Fill required display type configuration fields (e.g. Big Number requires a "Title")
    if (opts.displayTypeTitle) {
      await this.page.waitForTimeout(500);
      const displayTypeTitleInput = this.page.locator('valtimo-widget-configuration-container').last()
        .getByRole('textbox', {name: /Title/});
      await displayTypeTitleInput.fill(opts.displayTypeTitle);
    }
  }

  async saveWidget() {
    await expect(this.widgetSaveButton).toBeEnabled();
    await this.widgetSaveButton.click();
    // Wait for the modal to close
    await expect(this.page.locator('cds-modal[open]')).toHaveCount(0, {timeout: 10_000});
  }

  async cancelWidgetModal() {
    await this.widgetCancelButton.click();
    await expect(this.page.locator('cds-modal[open]')).toHaveCount(0, {timeout: 10_000});
  }

  // ─── Widget List Actions ──────────────────────────────────────────

  async editWidgetViaRow(widgetTitle: string) {
    const list = new CarbonList(this.page);
    const row = list.row(widgetTitle);
    await row.click();
    // Wait for the edit modal to open
    await expect(this.widgetTitleInput).toBeVisible();
  }

  async deleteWidgetViaOverflow(widgetTitle: string) {
    const list = new CarbonList(this.page);
    const row = list.row(widgetTitle);
    await row.clickAction('Delete');
    // Confirm deletion in the delete modal
    await expect(this.widgetDeleteButton).toBeVisible();
    await this.widgetDeleteButton.click();
    // Wait for the modal to close and list to refresh
    await expect(this.page.locator('cds-modal[open]')).toHaveCount(0, {timeout: 10_000});
    await list.waitForLoaded();
  }

  // ─── Widget List Assertions ───────────────────────────────────────

  async assertWidgetVisible(widgetTitle: string) {
    const list = new CarbonList(this.page);
    await list.waitForLoaded();
    const row = list.row(widgetTitle);
    await row.assertVisible();
  }

  async assertWidgetNotVisible(widgetTitle: string) {
    const list = new CarbonList(this.page);
    const row = list.row(widgetTitle);
    await row.assertNotVisible();
  }

  // ─── Widget Reorder ────────────────────────────────────────────────

  /**
   * Returns widget titles in current display order.
   * Column 0 = drag handle, column 1 = title.
   */
  async getWidgetTitlesInOrder(): Promise<string[]> {
    const list = new CarbonList(this.page);
    await list.waitForLoaded();
    const rows = list.rows;
    const count = await rows.count();
    const titles: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await rows.nth(i).locator('td').nth(1).innerText();
      titles.push(text.trim());
    }
    return titles;
  }

  async dragWidgetToPosition(sourceTitle: string, targetTitle: string) {
    const list = new CarbonList(this.page);
    const sourceRow = list.row(sourceTitle);
    const targetRow = list.row(targetTitle);
    await list.dragRow(sourceRow, targetRow);
  }

  // ─── Display Type Configuration Locators ────────────────────────────

  get displayTypeConfig() {
    return this.page.locator('valtimo-widget-configuration-container').last();
  }

  get displayTypeTitleInput() {
    return this.displayTypeConfig.getByRole('textbox', {name: /Title/});
  }

  get displayTypeSubtitleInput() {
    return this.displayTypeConfig.getByRole('textbox', {name: /Subtitle/});
  }

  get displayTypeLabelInput() {
    return this.displayTypeConfig.getByRole('textbox', {name: /Label/});
  }

  get useKpiCheckbox() {
    return this.displayTypeConfig.locator('cds-checkbox');
  }

  // ─── Widget Configuration Form Helpers ─────────────────────────────

  async selectDataSource(label: string) {
    await this.widgetDataSourceDropdown.click();
    await this.page.getByText(label, {exact: true}).click();
  }

  async selectCaseType(caseType: string) {
    const caseTypeDropdown = this.page.locator('valtimo-widget-configuration-container cds-dropdown').first();
    await expect(caseTypeDropdown).toBeVisible({timeout: 5_000});
    await caseTypeDropdown.click();
    // Scope to the open listbox: case type names like "bezwaar" also appear
    // in the breadcrumb and sidenav, and a page-scoped getByText will pick
    // one of those and navigate away from the dashboard config.
    await this.page.getByRole('listbox').getByText(caseType, {exact: true}).click();
  }

  async selectDisplayType(label: string) {
    await expect(this.widgetDisplayTypeDropdown).toBeEnabled({timeout: 5_000});
    await this.widgetDisplayTypeDropdown.click();
    await this.page.getByText(label, {exact: true}).click();
  }

  async addConditionRow() {
    const conditionsSection = this.page.locator('.conditions-multi-input');
    await conditionsSection.getByRole('button', {name: /add condition/i}).click();
  }

  conditionRow(index: number) {
    return this.page.getByTestId(`multiInputValuePathSelectorDropdownValue-${index}`);
  }

  async fillConditionPath(rowIndex: number, pathValue: string) {
    const row = this.conditionRow(rowIndex);
    const pathSelector = row.locator('valtimo-value-path-selector');
    const input = pathSelector.getByTestId(VALUE_PATH_SELECTOR_TEST_IDS.input);

    // If manual input is not visible, toggle from dropdown to manual mode
    if (!(await input.isVisible())) {
      const toggle = pathSelector.getByTestId(VALUE_PATH_SELECTOR_TEST_IDS.toggle);
      await toggle.click();
      await expect(input).toBeVisible();
    }

    await input.fill(pathValue);
  }

  async selectConditionOperator(rowIndex: number, operator: string) {
    const row = this.conditionRow(rowIndex);
    const dropdown = row.getByTestId(VALUE_PATH_SELECTOR_DROPDOWN_VALUE_TEST_IDS.dropdown);
    await dropdown.click();
    await this.page.getByText(operator, {exact: true}).click({force: true});
  }

  async fillConditionValue(rowIndex: number, value: string) {
    const row = this.conditionRow(rowIndex);
    const input = row.getByTestId(VALUE_PATH_SELECTOR_DROPDOWN_VALUE_TEST_IDS.valueInput);
    await input.click();
    await input.fill(value);
  }

  // ─── Display Type Configuration Helpers ─────────────────────────────

  async fillDisplayTypeTitle(title: string) {
    const displayTypeConfig = this.page.locator('valtimo-widget-configuration-container').last();
    const titleInput = displayTypeConfig.getByRole('textbox', {name: /Title/});
    await expect(titleInput).toBeVisible({timeout: 5_000});
    await titleInput.fill(title);
  }

  // ─── Case Counts Configuration Helpers ─────────────────────────────

  async fillCaseCountsTileLabel(tileIndex: number, label: string) {
    const tile = this.page.locator('cds-tile.count-tile').nth(tileIndex);
    await expect(tile).toBeVisible({timeout: 5_000});
    const labelInput = tile.locator('v-input').getByRole('textbox');
    await labelInput.fill(label);
  }

  async fillCaseCountsTileCondition(
    tileIndex: number,
    conditionIndex: number,
    path: string,
    operator: string,
    value: string
  ) {
    const tile = this.page.locator('cds-tile.count-tile').nth(tileIndex);
    const row = tile.getByTestId(`multiInputValuePathSelectorDropdownValue-${conditionIndex}`);
    await expect(row).toBeVisible({timeout: 5_000});

    // Fill path (toggle to manual mode if needed)
    const pathSelector = row.locator('valtimo-value-path-selector');
    const pathInput = pathSelector.getByTestId(VALUE_PATH_SELECTOR_TEST_IDS.input);
    if (!(await pathInput.isVisible())) {
      const toggle = pathSelector.getByTestId(VALUE_PATH_SELECTOR_TEST_IDS.toggle);
      await toggle.click();
      await expect(pathInput).toBeVisible();
    }
    await pathInput.fill(path);

    // Select operator — scope to this row's dropdown to avoid ambiguity with other tiles
    const operatorDropdown = row.getByTestId(VALUE_PATH_SELECTOR_DROPDOWN_VALUE_TEST_IDS.dropdown);
    await operatorDropdown.click();
    await operatorDropdown.locator('cds-dropdown-list').getByText(operator, {exact: true}).click({force: true});

    // Fill value
    const valueInput = row.getByTestId(VALUE_PATH_SELECTOR_DROPDOWN_VALUE_TEST_IDS.valueInput);
    await valueInput.fill(value);
  }

  // ─── Case Group By Configuration Helpers ───────────────────────────

  async fillGroupByPath(pathValue: string) {
    const dataSourceConfig = this.page.locator('valtimo-widget-configuration-container').first();
    // The group-by path selector is a standalone valtimo-value-path-selector (not inside a multi-input)
    const pathSelector = dataSourceConfig.locator('cds-label valtimo-value-path-selector');
    const input = pathSelector.getByTestId(VALUE_PATH_SELECTOR_TEST_IDS.input);

    if (!(await input.isVisible())) {
      const toggle = pathSelector.getByTestId(VALUE_PATH_SELECTOR_TEST_IDS.toggle);
      await toggle.click();
      await expect(input).toBeVisible();
    }

    await input.fill(pathValue);
  }

  // ─── Task Count Configuration Helpers ──────────────────────────────

  async addTaskCountConditionRow() {
    const conditionsSection = this.page.locator('.conditions-multi-input');
    await conditionsSection.getByRole('button', {name: /add condition/i}).click();
  }

  async fillTaskCountCondition(path: string, operator: string, value: string) {
    const conditionsSection = this.page.locator('.conditions-multi-input');

    const keyInput = conditionsSection.getByTestId(KEY_DROPDOWN_VALUE_TEST_IDS.keyInput);
    await keyInput.fill(path);

    const operatorDropdown = conditionsSection.getByTestId(KEY_DROPDOWN_VALUE_TEST_IDS.dropdown);
    await operatorDropdown.click();
    await this.page.getByText(operator, {exact: true}).click({force: true});

    const valueInput = conditionsSection.getByTestId(KEY_DROPDOWN_VALUE_TEST_IDS.valueInput);
    await valueInput.fill(value);
  }

  // ─── API Helpers ──────────────────────────────────────────────────

  async createDashboardViaApi(title: string, description: string): Promise<string> {
    const result = await ApiUtils.apiPost<{key: string}>(endpoints.dashboard.create, {
      title,
      description,
    });
    return result.key;
  }

  async deleteDashboardViaApi(key: string) {
    try {
      await ApiUtils.apiDelete(endpoints.dashboard.delete(key));
    } catch {
      // May already be deleted
    }
  }

  async deleteTestDashboardsViaApi(titlePrefix: string) {
    try {
      const dashboards = await ApiUtils.apiGet<DashboardListItem[]>(endpoints.dashboard.getAll);
      for (const dashboard of dashboards) {
        if (dashboard.title.startsWith(titlePrefix)) {
          await this.deleteDashboardViaApi(dashboard.key);
        }
      }
    } catch {
      // Dashboards may not exist
    }
  }

  async createWidgetViaApi(
    dashboardKey: string,
    widget: {title: string; dataSourceKey: string; displayType: string; dataSourceProperties?: object; displayTypeProperties?: object}
  ): Promise<{key: string}> {
    return ApiUtils.apiPost<{key: string}>(endpoints.dashboard.widgetConfigurations(dashboardKey), {
      ...widget,
      dataSourceProperties: widget.dataSourceProperties ?? {},
      displayTypeProperties: widget.displayTypeProperties ?? {},
    });
  }

  async deleteWidgetViaApi(dashboardKey: string, widgetKey: string) {
    try {
      await ApiUtils.apiDelete(endpoints.dashboard.widgetConfiguration(dashboardKey, widgetKey));
    } catch {
      // May already be deleted
    }
  }

  async getWidgetsViaApi(dashboardKey: string): Promise<Array<{key: string; title: string; [k: string]: unknown}>> {
    return ApiUtils.apiGet<Array<{key: string; title: string; [k: string]: unknown}>>(
      endpoints.dashboard.widgetConfigurations(dashboardKey)
    );
  }

  /**
   * Removes all widgets matching a title prefix from a dashboard via API.
   */
  async cleanupTestWidgetsViaApi(dashboardKey: string, titlePrefix: string) {
    try {
      const widgets = await this.getWidgetsViaApi(dashboardKey);
      for (const widget of widgets) {
        if (widget.title.startsWith(titlePrefix)) {
          await this.deleteWidgetViaApi(dashboardKey, widget.key);
        }
      }
    } catch {
      // Ignore errors during cleanup
    }
  }
}
