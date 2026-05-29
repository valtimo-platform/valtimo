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
import {CASE_IDENTIFIER, createWidgetTestData, createDividerTestData, createJsonEditorDividerData, createReorderTestData} from './case-details-management-widgets';
import {CaseDetailsManagementWidgetsPage} from './page';
import {CarbonList} from '../../../../../../../shared/carbon-list/carbon-list.utils';

test.use({storageState: undefined});

test.describe('Case details management — Widgets', () => {
  let context;
  let page;
  let widgetsPage: CaseDetailsManagementWidgetsPage;
  let draftVersion: string;
  let widgetTabKey: string;

  const testData = createWidgetTestData();
  const dividerData = createDividerTestData();
  const jsonDividerData = createJsonEditorDividerData();
  const reorderData = createReorderTestData();

  test.beforeAll(async ({browser, baseURL}) => {
    test.setTimeout(120_000);
    context = await browser.newContext({baseURL: baseURL ?? 'http://localhost:4200'});
    page = await context.newPage();

    widgetsPage = new CaseDetailsManagementWidgetsPage(page, context.request);

    // Navigate to the case management page
    await page.goto('/');
    await widgetsPage.goToCaseManagement(CASE_IDENTIFIER);
    draftVersion = await widgetsPage.ensureDraftVersionSelected();

    // Navigate to Case details > click existing Widgets tab row
    await widgetsPage.goToWidgetTab();
    widgetTabKey = widgetsPage.getWidgetTabKeyFromUrl();

    // Clean up stale test widgets/dividers from previous runs
    await widgetsPage.removeTestWidgetsViaApi(CASE_IDENTIFIER, draftVersion, widgetTabKey, 'E2e Test Widget');
    await widgetsPage.removeTestWidgetsViaApi(CASE_IDENTIFIER, draftVersion, widgetTabKey, 'E2e Test Divider');
    await widgetsPage.removeTestWidgetsViaApi(CASE_IDENTIFIER, draftVersion, widgetTabKey, 'E2e JSON Divider');
    await widgetsPage.removeTestWidgetsViaApi(CASE_IDENTIFIER, draftVersion, widgetTabKey, 'E2e Reorder Widget');
  });

  test.afterAll(async () => {
    // Safety-net: remove any test widgets/dividers that were not cleaned up by the UI delete tests
    await widgetsPage.removeTestWidgetsViaApi(
      CASE_IDENTIFIER,
      draftVersion,
      widgetTabKey,
      'E2e Test Widget'
    );
    await widgetsPage.removeTestWidgetsViaApi(
      CASE_IDENTIFIER,
      draftVersion,
      widgetTabKey,
      'E2e Test Divider'
    );
    await widgetsPage.removeTestWidgetsViaApi(
      CASE_IDENTIFIER,
      draftVersion,
      widgetTabKey,
      'E2e JSON Divider'
    );
    await widgetsPage.removeTestWidgetsViaApi(
      CASE_IDENTIFIER,
      draftVersion,
      widgetTabKey,
      'E2e Reorder Widget'
    );

    await context.close();
  });

  // ─── 6.88–6.93 Add widget (select type, width, density, style, content) ─────

  test.describe('6.88, 6.89, 6.90, 6.91, 6.92, 6.93 — Add widget', () => {
    test('Add a Fields widget via the wizard', async () => {
      await widgetsPage.addFieldsWidget({
        title: testData.widgetTitle,
        fieldTitle: testData.fieldTitle,
        valuePath: testData.valuePath,
      });

      // Verify the widget was added to the list
      await widgetsPage.assertWidgetVisible(testData.widgetTitle);
    });
  });

  // ─── 6.87 View widgets list ───────────────────────────────────────

  test.describe('6.87 — View widgets list', () => {
    test('Widget list is visible and has items', async () => {
      const list = new CarbonList(page);
      await list.waitForLoaded();
      const rowCount = await list.rows.count();
      expect(rowCount).toBeGreaterThan(0);
    });

    test('Widget displays the correct title', async () => {
      await widgetsPage.assertWidgetVisible(testData.widgetTitle);
    });

    test('Widget displays the correct type tag', async () => {
      await widgetsPage.assertWidgetTypeTag(testData.widgetTitle, 'Fields');
    });

    test('Widget displays the correct key', async () => {
      // Column 3: key (auto-generated from title, lowercased and hyphenated)
      await widgetsPage.assertWidgetCellByIndex(testData.widgetTitle, 3, 'e2e-test-widget');
    });

    test('Widget displays the correct width', async () => {
      // Column 4: width
      await widgetsPage.assertWidgetCellByIndex(testData.widgetTitle, 4, 'Medium');
    });

    test('Widget displays the correct color', async () => {
      // Column 5: color
      await widgetsPage.assertWidgetCellByIndex(testData.widgetTitle, 5, 'Default');
    });

    test('Widget displays the correct density', async () => {
      // Column 6: density
      await widgetsPage.assertWidgetCellByIndex(testData.widgetTitle, 6, 'Default');
    });
  });

  // ─── Delete widget ────────────────────────────────────────────────

  test.describe('Delete widget', () => {
    test('Delete the widget via overflow menu', async () => {
      await widgetsPage.deleteWidgetViaOverflowMenu(testData.widgetTitle);

      // Verify the widget is no longer in the list
      await widgetsPage.assertWidgetNotVisible(testData.widgetTitle);
    });
  });

  // ─── 6.97 Use widget JSON editor ───────────────────────────────────

  test.describe('6.97 — Use widget JSON editor', () => {
    test('Add a divider via the JSON editor', async () => {
      const dividerWidget = {
        type: 'divider',
        key: jsonDividerData.dividerKey,
        title: jsonDividerData.dividerTitle,
        icon: null,
        color: 'WHITE',
        width: 4,
        highContrast: false,
        isCompact: null,
        displayConditions: [],
        actions: [],
      };

      await widgetsPage.addWidgetViaJsonEditor(
        CASE_IDENTIFIER,
        draftVersion,
        widgetTabKey,
        dividerWidget
      );

      // Verify the divider appears in the visual editor list
      await widgetsPage.assertWidgetVisible(jsonDividerData.dividerTitle);
      await widgetsPage.assertWidgetTypeTag(jsonDividerData.dividerTitle, 'Divider');
    });

    test('Remove the divider via the JSON editor', async () => {
      await widgetsPage.removeWidgetViaJsonEditor(
        CASE_IDENTIFIER,
        draftVersion,
        widgetTabKey,
        jsonDividerData.dividerKey
      );

      // Verify the divider is gone from the visual editor list
      await widgetsPage.assertWidgetNotVisible(jsonDividerData.dividerTitle);
    });
  });

  // ─── 6.95 Add widget separator (divider) ──────────────────────────

  test.describe('6.95 — Add widget separator', () => {
    test('Add a divider via the modal', async () => {
      // Ensure we're on the visual editor tab (previous JSON editor tests may leave us on the wrong tab)
      await widgetsPage.switchToVisualEditor();
      await widgetsPage.addDivider(dividerData.dividerTitle);

      // Verify the divider was added to the list
      await widgetsPage.assertWidgetVisible(dividerData.dividerTitle);
    });

    test('Divider displays the correct type tag', async () => {
      await widgetsPage.assertWidgetTypeTag(dividerData.dividerTitle, 'Divider');
    });

    test('Divider displays the correct key', async () => {
      // Column 3: key (auto-generated from title, lowercased and hyphenated)
      await widgetsPage.assertWidgetCellByIndex(dividerData.dividerTitle, 3, 'e2e-test-divider');
    });

    test('Delete the divider via overflow menu', async () => {
      await widgetsPage.deleteWidgetViaOverflowMenu(dividerData.dividerTitle);

      // Verify the divider is no longer in the list
      await widgetsPage.assertWidgetNotVisible(dividerData.dividerTitle);
    });
  });

  // ─── 6.95 Failure scenarios ───────────────────────────────────────

  test.describe('6.95 — Failure scenarios', () => {
    test('Create button is disabled when key is empty', async () => {
      await widgetsPage.addDividerButton.click();
      // Form starts with empty key — Create button should be disabled
      await expect(widgetsPage.dividerCreateButton).toBeDisabled();
      await widgetsPage.dividerCancelButton.click();
    });
  });

  // ─── 6.96 Rearrange widgets ───────────────────────────────────────

  test.describe('6.96 — Rearrange widgets', () => {
    test('Add two dividers for reordering', async () => {
      await widgetsPage.addDivider(reorderData.titleA);
      await widgetsPage.assertWidgetVisible(reorderData.titleA);

      await widgetsPage.addDivider(reorderData.titleB);
      await widgetsPage.assertWidgetVisible(reorderData.titleB);
    });

    test('Reorder widgets via drag and drop', async ({}, testInfo) => {
      testInfo.setTimeout(60_000);
      // Get initial positions
      const initialOrder = await widgetsPage.getWidgetTitlesInOrder();
      const indexA = initialOrder.indexOf(reorderData.titleA);
      const indexB = initialOrder.indexOf(reorderData.titleB);
      expect(indexA).not.toBe(-1);
      expect(indexB).not.toBe(-1);

      // Drag the lower one above the higher one
      if (indexA < indexB) {
        await widgetsPage.dragWidgetToPosition(reorderData.titleB, reorderData.titleA);
      } else {
        await widgetsPage.dragWidgetToPosition(reorderData.titleA, reorderData.titleB);
      }

      // Assert — relative order should be reversed
      const newOrder = await widgetsPage.getWidgetTitlesInOrder();
      const newIndexA = newOrder.indexOf(reorderData.titleA);
      const newIndexB = newOrder.indexOf(reorderData.titleB);
      if (indexA < indexB) {
        expect(newIndexB).toBeLessThan(newIndexA);
      } else {
        expect(newIndexA).toBeLessThan(newIndexB);
      }
    });

    test('Clean up reorder widgets', async () => {
      await widgetsPage.deleteWidgetViaOverflowMenu(reorderData.titleA);
      await widgetsPage.assertWidgetNotVisible(reorderData.titleA);

      await widgetsPage.deleteWidgetViaOverflowMenu(reorderData.titleB);
      await widgetsPage.assertWidgetNotVisible(reorderData.titleB);
    });
  });
});
