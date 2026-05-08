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

import {expect, test} from '@playwright/test';
import {JsonEditor} from '../../shared/json-editor/json-editor.utils';
import {DashboardManagementPage} from './page';

test.use({storageState: undefined});

const TEST_TITLE = 'E2E Test Dashboard';
const TEST_DESCRIPTION = 'E2E test dashboard description';
const EDITED_TITLE = 'E2E Test Dashboard Edited';
const EDITED_DESCRIPTION = 'E2E test dashboard edited description';

test.describe('Dashboard management', () => {
  let context;
  let page;
  let dashboardPage: DashboardManagementPage;
  let jsonEditor: JsonEditor;
  let createdKey: string;

  test.beforeAll(async ({browser, baseURL}) => {
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    dashboardPage = new DashboardManagementPage(page);
    jsonEditor = new JsonEditor(page);

    await page.goto('/');

    // Clean up stale test dashboards from previous runs
    await dashboardPage.deleteTestDashboardsViaApi(TEST_TITLE);
    await dashboardPage.deleteTestDashboardsViaApi(EDITED_TITLE);

    await dashboardPage.goToDashboardManagement();
  });

  test.afterAll(async () => {
    if (createdKey) {
      await dashboardPage.deleteDashboardViaApi(createdKey);
    }
    // Also clean by title prefix in case the key changed or was not captured
    await dashboardPage.deleteTestDashboardsViaApi(TEST_TITLE);
    await dashboardPage.deleteTestDashboardsViaApi(EDITED_TITLE);

    await context.close();
  });

  test.describe('Success scenarios', () => {
    test('Create a new dashboard', async () => {
      await dashboardPage.createDashboard(TEST_TITLE, TEST_DESCRIPTION);

      const row = dashboardPage.carbonList.row(TEST_TITLE);
      await row.assertVisible();

      // Extract the auto-generated key from the Key column (3rd column, index 2)
      createdKey = await row.cellByIndex(2).textContent();
      createdKey = createdKey.trim();

      expect(createdKey).toBeTruthy();
    });

    test('View dashboard list shows created dashboard', async () => {
      const row = dashboardPage.carbonList.row(TEST_TITLE);
      await row.assertVisible();

      await expect(row.cellByIndex(0)).toContainText(TEST_TITLE);
      await expect(row.cellByIndex(1)).toContainText(TEST_DESCRIPTION);
      await expect(row.cellByIndex(2)).toContainText(createdKey);
    });

    test('View dashboard metadata on detail page', async () => {
      const row = dashboardPage.carbonList.row(TEST_TITLE);
      await row.click();

      await expect(page).toHaveURL(new RegExp(`/dashboard-management/${createdKey}`));
      await expect(dashboardPage.pageSubtitle).toBeVisible();
      await expect(dashboardPage.pageSubtitle).toContainText('Created by');
      await expect(dashboardPage.pageSubtitle).toContainText('Created on');
      await expect(dashboardPage.pageSubtitle).toContainText('Dashboard key');
      await expect(dashboardPage.pageSubtitle).toContainText(createdKey);
    });

    test('Edit dashboard title and description', async () => {
      await dashboardPage.editDashboard(EDITED_TITLE, EDITED_DESCRIPTION);

      // Wait for modal to close
      await expect(dashboardPage.editTitleInput).not.toBeVisible();

      // Navigate back to list
      await dashboardPage.goToDashboardManagement();

      // Verify the updated title appears in the list
      const row = dashboardPage.carbonList.row(EDITED_TITLE);
      await row.assertVisible();
      await expect(row.cellByIndex(1)).toContainText(EDITED_DESCRIPTION);

      // Navigate back to detail for subsequent tests
      await row.click();
      await expect(page).toHaveURL(new RegExp(`/dashboard-management/${createdKey}`));
    });

    test('Toggle between JSON and visual editor', async () => {
      // Switch to JSON editor
      await dashboardPage.switchToJsonEditor();
      await expect(dashboardPage.monacoEditor).toBeVisible();

      // Switch back to visual editor
      await dashboardPage.switchToVisualEditor();
      await expect(dashboardPage.widgetList).toBeVisible();
    });

    test('Edit dashboard JSON', async () => {
      await dashboardPage.switchToJsonEditor();

      // Use the shared JsonEditor util to save an empty widget array
      await jsonEditor.saveChanges([]);

      // Wait for the PUT response on widget-configuration
      await page.waitForResponse(
        res =>
          res.url().includes(`/api/management/v1/dashboard/${createdKey}/widget-configuration`) &&
          res.request().method() === 'PUT'
      );

      // Switch back to visual to verify
      await dashboardPage.switchToVisualEditor();
    });
  });

  test.describe('Failure scenarios', () => {
    test('Create button is disabled with empty title', async () => {
      await dashboardPage.goToDashboardManagement();
      await dashboardPage.addDashboardButton.click();
      await expect(dashboardPage.createTitleInput).toBeVisible();

      // Only fill description, leave title empty
      await dashboardPage.createDescriptionInput.fill('Some description');

      await expect(dashboardPage.createButton).toBeDisabled();

      // Close the modal
      await page.getByRole('dialog').getByRole('button', {name: 'Cancel'}).click();
    });

    test('Create button is disabled with empty description', async () => {
      await dashboardPage.addDashboardButton.click();
      await expect(dashboardPage.createTitleInput).toBeVisible();

      // Only fill title, leave description empty
      await dashboardPage.createTitleInput.fill('Some title');

      await expect(dashboardPage.createButton).toBeDisabled();

      // Close the modal
      await page.getByRole('dialog').getByRole('button', {name: 'Cancel'}).click();
    });

    test('Complete button is disabled with empty title in edit modal', async () => {
      // Navigate to dashboard detail
      await dashboardPage.goToDashboardManagement();
      const row = dashboardPage.carbonList.row(EDITED_TITLE);
      await row.click();
      await expect(page).toHaveURL(new RegExp(`/dashboard-management/${createdKey}`));

      await dashboardPage.editButton.click();
      await expect(dashboardPage.editTitleInput).toBeVisible();

      // Clear the title
      await dashboardPage.editTitleInput.clear();
      // Trigger validation by typing and deleting
      await dashboardPage.editTitleInput.fill(' ');
      await dashboardPage.editTitleInput.clear();

      await expect(dashboardPage.completeButton).toBeDisabled();

      // Close the modal
      await page.getByRole('dialog').getByRole('button', {name: 'Cancel'}).click();
    });
  });
});
