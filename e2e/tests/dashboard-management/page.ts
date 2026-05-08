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

import {expect, Page} from '@playwright/test';
import {DASHBOARD_MANAGEMENT_TEST_IDS} from '../../constants';
import {CarbonList} from '../../shared/carbon-list/carbon-list.utils';
import * as ApiUtils from '../../utils/api.utils';

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

  // ─── Actions ──────────────────────────────────────────────────────

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

  // ─── Cleanup ──────────────────────────────────────────────────────

  async deleteTestDashboardsViaApi(titlePrefix: string) {
    try {
      const dashboards = await ApiUtils.apiGet<DashboardListItem[]>(
        '/api/management/v1/dashboard'
      );
      for (const dashboard of dashboards) {
        if (dashboard.title.startsWith(titlePrefix)) {
          await this.deleteDashboardViaApi(dashboard.key);
        }
      }
    } catch {
      // Dashboards may not exist
    }
  }

  async deleteDashboardViaApi(key: string) {
    try {
      await ApiUtils.apiDelete(`/api/management/v1/dashboard/${key}`);
    } catch {
      // Dashboard may already be deleted
    }
  }
}
