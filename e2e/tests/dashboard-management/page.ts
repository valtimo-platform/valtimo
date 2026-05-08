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

import {type APIRequestContext, expect, type Page} from '@playwright/test';
import * as ApiUtils from '../../utils/api.utils';
import {CarbonList} from '../../shared/carbon-list/carbon-list.utils';
import {DASHBOARD_MANAGEMENT_TEST_IDS} from '../../constants';
import {endpoints} from '../../api/endpoints';

export class DashboardManagementPage {
  constructor(
    private readonly page: Page,
    private readonly request: APIRequestContext
  ) {}

  // ─── Navigation ───────────────────────────────────────────────────

  async goToDashboardManagement() {
    await this.page.getByRole('button', {name: 'Admin'}).click();
    // Scope to the admin sidebar to avoid matching the top-level "Dashboard" nav item.
    // The sidebar uses data-testid (not data-test-id), so use locator() directly.
    await this.page.locator('[data-testid="sidenav-item-Admin"]').getByRole('link', {name: 'Dashboard'}).click();
    await this.page.waitForSelector('valtimo-carbon-list');
  }

  async goToDashboardDetails(dashboardTitle: string) {
    const list = new CarbonList(this.page);
    await list.waitForLoaded();
    const row = list.row(dashboardTitle);
    await row.click();
    // Wait for the widget list to load on the details page
    await this.page.waitForSelector('valtimo-carbon-list');
    const detailList = new CarbonList(this.page);
    await detailList.waitForLoaded();
  }

  // ─── Dashboard List UI Elements ────────────────────────────────────

  get addDashboardButton() {
    return this.page.getByTestId(DASHBOARD_MANAGEMENT_TEST_IDS.addDashboardButton);
  }

  get dashboardNameInput() {
    return this.page.getByTestId(DASHBOARD_MANAGEMENT_TEST_IDS.dashboardNameInput);
  }

  get dashboardDescriptionInput() {
    return this.page.getByTestId(DASHBOARD_MANAGEMENT_TEST_IDS.dashboardDescriptionInput);
  }

  get createDashboardButton() {
    return this.page.getByTestId(DASHBOARD_MANAGEMENT_TEST_IDS.createDashboardButton);
  }

  // ─── Widget List UI Elements ───────────────────────────────────────

  get addWidgetButton() {
    // Scope to toolbar to avoid matching the duplicate button in the no-results panel
    return this.page.getByLabel('Table action bar').getByTestId(DASHBOARD_MANAGEMENT_TEST_IDS.addWidgetButton);
  }

  // ─── Widget Modal UI Elements ──────────────────────────────────────

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

  // ─── API Helpers ──────────────────────────────────────────────────

  async createDashboardViaApi(title: string, description: string): Promise<string> {
    const result = await ApiUtils.apiPost<{key: string}>(endpoints.dashboard.create, {
      title,
      description,
    });
    return result.key;
  }

  async deleteDashboardViaApi(dashboardKey: string) {
    try {
      await ApiUtils.apiDelete(endpoints.dashboard.delete(dashboardKey));
    } catch {
      // May already be deleted
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
