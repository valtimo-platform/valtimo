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
import {
  createDashboardTestData,
  createWidgetTestData,
  createReorderTestData,
  CASE_DEFINITION_KEY,
} from './dashboard-management-config';
import {DashboardManagementPage} from './page';
import {CarbonList} from '../../shared/carbon-list/carbon-list.utils';

test.use({storageState: undefined});

test.describe('Dashboard management — Widget management', () => {
  let context;
  let page;
  let dashboardPage: DashboardManagementPage;

  const dashboardData = createDashboardTestData();
  const widgetData = createWidgetTestData();
  const reorderData = createReorderTestData();

  let dashboardKey: string;
  const createdWidgetKeys: string[] = [];

  test.beforeAll(async ({browser, baseURL}) => {
    test.setTimeout(120_000);
    context = await browser.newContext({baseURL: baseURL ?? 'http://localhost:4200'});
    page = await context.newPage();

    dashboardPage = new DashboardManagementPage(page, context.request);

    // Create a test dashboard via API
    await page.goto('/');
    dashboardKey = await dashboardPage.createDashboardViaApi(
      dashboardData.title,
      dashboardData.description
    );

    // Clean up stale test widgets from previous runs
    await dashboardPage.cleanupTestWidgetsViaApi(dashboardKey, 'E2e Test Widget');
    await dashboardPage.cleanupTestWidgetsViaApi(dashboardKey, 'E2e Edited Widget');
    await dashboardPage.cleanupTestWidgetsViaApi(dashboardKey, 'E2e Reorder Widget');

    // Navigate to the dashboard details page
    await dashboardPage.goToDashboardManagement();
    await dashboardPage.goToDashboardDetails(dashboardData.title);
  });

  test.afterAll(async () => {
    // Clean up all test widgets
    for (const widgetKey of createdWidgetKeys) {
      await dashboardPage.deleteWidgetViaApi(dashboardKey, widgetKey);
    }

    // Clean up by title prefix as safety net
    await dashboardPage.cleanupTestWidgetsViaApi(dashboardKey, 'E2e Test Widget');
    await dashboardPage.cleanupTestWidgetsViaApi(dashboardKey, 'E2e Edited Widget');
    await dashboardPage.cleanupTestWidgetsViaApi(dashboardKey, 'E2e Reorder Widget');

    // Delete the test dashboard
    await dashboardPage.deleteDashboardViaApi(dashboardKey);

    await context.close();
  });

  // ─── View widgets list ────────────────────────────────────────────

  test.describe('View widgets list', () => {
    test('Widget list is visible', async () => {
      const list = new CarbonList(page);
      await list.waitForLoaded();
      await expect(list.table).toBeVisible();
    });
  });

  // ─── Add new widget ───────────────────────────────────────────────

  test.describe('Add new widget', () => {
    test('Add widget with case-count data source and big-number display', async () => {
      await dashboardPage.openAddWidgetModal();
      await dashboardPage.fillWidgetForm({
        title: widgetData.widgetTitle,
        dataSourceLabel: 'Case count',
        caseType: CASE_DEFINITION_KEY,
        displayTypeLabel: 'Big number',
        displayTypeTitle: 'Test display title',
      });
      await dashboardPage.saveWidget();

      // Track the created widget for cleanup
      const widgets = await dashboardPage.getWidgetsViaApi(dashboardKey);
      const created = widgets.find(w => w.title === widgetData.widgetTitle);
      if (created) createdWidgetKeys.push(created.key);

      await dashboardPage.assertWidgetVisible(widgetData.widgetTitle);
    });
  });

  // ─── Edit widget configuration ────────────────────────────────────

  test.describe('Edit widget configuration', () => {
    test('Edit widget title via row click', async () => {
      await dashboardPage.editWidgetViaRow(widgetData.widgetTitle);

      // Clear and fill with new title
      await dashboardPage.widgetTitleInput.clear();
      await dashboardPage.widgetTitleInput.fill(widgetData.editedWidgetTitle);
      await dashboardPage.saveWidget();

      await dashboardPage.assertWidgetVisible(widgetData.editedWidgetTitle);
      await dashboardPage.assertWidgetNotVisible(widgetData.widgetTitle);
    });
  });

  // ─── Rearrange widgets via drag and drop ──────────────────────────

  test.describe('Rearrange widgets via drag and drop', () => {
    test('Add two widgets for reordering', async () => {
      // Create two widgets via API for reliable reorder testing
      const widgetA = await dashboardPage.createWidgetViaApi(dashboardKey, {
        title: reorderData.titleA,
        dataSourceKey: 'case-count',
        displayType: 'number',
        dataSourceProperties: {caseDefinitionKey: CASE_DEFINITION_KEY},
      });
      createdWidgetKeys.push(widgetA.key);

      const widgetB = await dashboardPage.createWidgetViaApi(dashboardKey, {
        title: reorderData.titleB,
        dataSourceKey: 'case-count',
        displayType: 'number',
        dataSourceProperties: {caseDefinitionKey: CASE_DEFINITION_KEY},
      });
      createdWidgetKeys.push(widgetB.key);

      // Reload the page to see the new widgets
      await page.reload();
      const list = new CarbonList(page);
      await list.waitForLoaded();

      await dashboardPage.assertWidgetVisible(reorderData.titleA);
      await dashboardPage.assertWidgetVisible(reorderData.titleB);
    });

    test('Reorder widgets via drag and drop', async ({}, testInfo) => {
      testInfo.setTimeout(60_000);

      const initialOrder = await dashboardPage.getWidgetTitlesInOrder();
      const indexA = initialOrder.indexOf(reorderData.titleA);
      const indexB = initialOrder.indexOf(reorderData.titleB);
      expect(indexA).not.toBe(-1);
      expect(indexB).not.toBe(-1);

      // Drag the lower one above the higher one
      if (indexA < indexB) {
        await dashboardPage.dragWidgetToPosition(reorderData.titleB, reorderData.titleA);
      } else {
        await dashboardPage.dragWidgetToPosition(reorderData.titleA, reorderData.titleB);
      }

      // Assert relative order is reversed
      const newOrder = await dashboardPage.getWidgetTitlesInOrder();
      const newIndexA = newOrder.indexOf(reorderData.titleA);
      const newIndexB = newOrder.indexOf(reorderData.titleB);
      if (indexA < indexB) {
        expect(newIndexB).toBeLessThan(newIndexA);
      } else {
        expect(newIndexA).toBeLessThan(newIndexB);
      }
    });

    test('Clean up reorder widgets', async () => {
      await dashboardPage.deleteWidgetViaOverflow(reorderData.titleA);
      await dashboardPage.assertWidgetNotVisible(reorderData.titleA);

      await dashboardPage.deleteWidgetViaOverflow(reorderData.titleB);
      await dashboardPage.assertWidgetNotVisible(reorderData.titleB);
    });
  });

  // ─── Delete widget ────────────────────────────────────────────────

  test.describe('Delete widget', () => {
    test('Delete widget via overflow menu', async () => {
      await dashboardPage.deleteWidgetViaOverflow(widgetData.editedWidgetTitle);
      await dashboardPage.assertWidgetNotVisible(widgetData.editedWidgetTitle);
    });
  });

  // ─── Failure scenarios ────────────────────────────────────────────

  test.describe('Failure scenarios', () => {
    test('Save button is disabled with empty title', async () => {
      await dashboardPage.openAddWidgetModal();
      // Title is empty by default — Save should be disabled
      await expect(dashboardPage.widgetSaveButton).toBeDisabled();
      await dashboardPage.cancelWidgetModal();
    });
  });
});
