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
import {JsonEditor} from '../../shared/json-editor/json-editor.utils';
import {DashboardManagementPage} from './page';
import {CarbonList} from '../../shared/carbon-list/carbon-list.utils';

test.use({storageState: undefined});

// ─── Dashboard configuration tests ─────────────────────────────────

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

// ─── Widget management tests ────────────────────────────────────────

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

    dashboardPage = new DashboardManagementPage(page);

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
    await dashboardPage.cleanupTestWidgetsViaApi(dashboardKey, 'E2e Config');

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
    await dashboardPage.cleanupTestWidgetsViaApi(dashboardKey, 'E2e Config');

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

  // ─── Widget configuration form ────────────────────────────────────

  test.describe('Widget configuration form', () => {
    test.beforeAll(async () => {
      await dashboardPage.openAddWidgetModal();
    });

    test.afterAll(async () => {
      await dashboardPage.cancelWidgetModal();
    });

    test('Enter widget title', async () => {
      await dashboardPage.widgetTitleInput.fill('E2e Form Test Widget');
      await expect(dashboardPage.widgetTitleInput).toHaveValue('E2e Form Test Widget');
    });

    test('Select data source', async () => {
      await dashboardPage.selectDataSource('Case count');
      await expect(dashboardPage.widgetDataSourceDropdown).toContainText('Case count');
    });

    test('Select case type', async () => {
      await dashboardPage.selectCaseType(CASE_DEFINITION_KEY);
      const caseTypeDropdown = page.locator('valtimo-widget-configuration-container cds-dropdown').first();
      await expect(caseTypeDropdown).toContainText(CASE_DEFINITION_KEY);
    });

    test('Select widget display type', async () => {
      await dashboardPage.selectDisplayType('Big number');
      await expect(dashboardPage.widgetDisplayTypeDropdown).toContainText('Big number');
    });

    test('Add conditions', async () => {
      await dashboardPage.addConditionRow();
      await expect(dashboardPage.conditionRow(0)).toBeVisible();
    });

    test('Configure condition path', async () => {
      await dashboardPage.fillConditionPath(0, 'doc:someField');
      const row = dashboardPage.conditionRow(0);
      const pathInput = row.locator('valtimo-value-path-selector').getByTestId('valuePathSelectorInput');
      await expect(pathInput).toHaveValue('doc:someField');
    });

    test('Configure condition operator', async () => {
      await dashboardPage.selectConditionOperator(0, 'Equal to');
      const row = dashboardPage.conditionRow(0);
      const dropdown = row.getByTestId('valuePathSelectorDropdownValueDropDown');
      await expect(dropdown).toContainText('Equal to');
    });

    test('Configure condition value', async () => {
      await dashboardPage.fillConditionValue(0, 'testValue');
      const row = dashboardPage.conditionRow(0);
      const input = row.getByTestId('valuePathSelectorDropdownValueValueInput');
      await expect(input).toHaveValue('testValue');
    });

    test('Use placeholders in conditions', async () => {
      const row = dashboardPage.conditionRow(0);
      const input = row.getByTestId('valuePathSelectorDropdownValueValueInput');
      await input.clear();
      await input.fill('${currentUserId}');
      await expect(input).toHaveValue('${currentUserId}');
    });

    test('Select display type', async () => {
      // Big number was selected in a prior test — verify it's still selected
      await expect(dashboardPage.widgetDisplayTypeDropdown).toContainText('Big number');
    });

    test('Configure display type title', async () => {
      await dashboardPage.displayTypeTitleInput.fill('E2e Display Title');
      await expect(dashboardPage.displayTypeTitleInput).toHaveValue('E2e Display Title');
    });

    test('Configure display subtitle', async () => {
      await dashboardPage.displayTypeSubtitleInput.fill('E2e Subtitle');
      await expect(dashboardPage.displayTypeSubtitleInput).toHaveValue('E2e Subtitle');
    });

    test('Configure display label', async () => {
      await dashboardPage.displayTypeLabelInput.fill('E2e Label');
      await expect(dashboardPage.displayTypeLabelInput).toHaveValue('E2e Label');
    });

    test('Toggle KPI usage', async () => {
      await dashboardPage.displayTypeConfig.getByText('Use KPI').click();
      // KPI threshold fields should appear
      const lowThreshold = dashboardPage.displayTypeConfig.locator('input[type="number"]').first();
      await expect(lowThreshold).toBeVisible();
    });

    test('Set URL path', async () => {
      await dashboardPage.widgetUrlInput.fill('/cases');
      await expect(dashboardPage.widgetUrlInput).toHaveValue('/cases');
    });
  });

  // ─── Widget data source configuration ─────────────────────────────

  test.describe('Widget data source configuration', () => {
    test.afterEach(async () => {
      // Track created widgets for cleanup
      const widgets = await dashboardPage.getWidgetsViaApi(dashboardKey);
      for (const w of widgets) {
        if (w.title.startsWith('E2e Config') && !createdWidgetKeys.includes(w.key)) {
          createdWidgetKeys.push(w.key);
        }
      }
    });

    test('Configure case count widget', async () => {
      await dashboardPage.openAddWidgetModal();
      await dashboardPage.widgetTitleInput.fill('E2e Config Case Count');
      await dashboardPage.selectDataSource('Case count');
      await dashboardPage.selectCaseType(CASE_DEFINITION_KEY);
      await dashboardPage.selectDisplayType('Big number');
      await dashboardPage.fillDisplayTypeTitle('Test title');
      await dashboardPage.saveWidget();
      await dashboardPage.assertWidgetVisible('E2e Config Case Count');
    });

    test('Configure multiple counts widget', async () => {
      await dashboardPage.openAddWidgetModal();
      await dashboardPage.widgetTitleInput.fill('E2e Config Case Counts');
      await dashboardPage.selectDataSource('Multiple case counts');
      await dashboardPage.selectCaseType(CASE_DEFINITION_KEY);

      // Fill tile 0: label + condition
      await dashboardPage.fillCaseCountsTileLabel(0, 'Open');
      await dashboardPage.fillCaseCountsTileCondition(0, 0, 'case:status', 'Equal to', 'open');

      // Fill tile 1: label + condition
      await dashboardPage.fillCaseCountsTileLabel(1, 'Closed');
      await dashboardPage.fillCaseCountsTileCondition(1, 0, 'case:status', 'Equal to', 'closed');

      await dashboardPage.selectDisplayType('Donut chart');
      await dashboardPage.fillDisplayTypeTitle('Test title');
      await dashboardPage.saveWidget();
      await dashboardPage.assertWidgetVisible('E2e Config Case Counts');
    });

    test('Configure group by widget', async () => {
      await dashboardPage.openAddWidgetModal();
      await dashboardPage.widgetTitleInput.fill('E2e Config Group By');
      await dashboardPage.selectDataSource('Group by');
      await dashboardPage.selectCaseType(CASE_DEFINITION_KEY);
      await dashboardPage.fillGroupByPath('case:status');
      await dashboardPage.selectDisplayType('Donut chart');
      await dashboardPage.fillDisplayTypeTitle('Test title');
      await dashboardPage.saveWidget();
      await dashboardPage.assertWidgetVisible('E2e Config Group By');
    });

    test('Configure task count widget', async () => {
      await dashboardPage.openAddWidgetModal();
      await dashboardPage.widgetTitleInput.fill('E2e Config Task Count');
      await dashboardPage.selectDataSource('Task count');
      await dashboardPage.selectDisplayType('Big number');
      await dashboardPage.fillDisplayTypeTitle('Test title');
      await dashboardPage.saveWidget();
      await dashboardPage.assertWidgetVisible('E2e Config Task Count');
    });
  });
});
