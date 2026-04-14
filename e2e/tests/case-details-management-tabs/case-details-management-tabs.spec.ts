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
import {CASE_IDENTIFIER, createTabTestData, createTabReorderTestData} from './case-details-management-tabs';
import {CaseDetailsManagementTabsPage} from './page';

test.use({storageState: undefined});

test.describe('Case details management — Tabs', () => {
  let context;
  let page;
  let tabsPage: CaseDetailsManagementTabsPage;
  let request;
  let draftVersion: string;

  // Generate unique test data per run to avoid key collisions
  const tabTestData = createTabTestData();
  const tabReorderTestData = createTabReorderTestData();

  // Arrange
  test.beforeAll(async ({browser, baseURL}) => {
    test.setTimeout(60_000);
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    request = context.request;

    tabsPage = new CaseDetailsManagementTabsPage(page, request);

    await page.goto('/');
    await tabsPage.goToCaseManagement(CASE_IDENTIFIER);
    draftVersion = await tabsPage.ensureDraftVersionSelected();

    // ensureDraftVersionSelected may redirect to /general — navigate to Case details > Tabs
    await tabsPage.switchToCaseDetailsTabs();
  });

  test.afterAll(async () => {
    const tabKey = tabTestData.title.toLowerCase().replace(/\s+/g, '-');
    const updatedTabKey = tabTestData.updatedTitle.toLowerCase().replace(/\s+/g, '-');
    const reorderKeyA = tabReorderTestData.titleA.toLowerCase().replace(/\s+/g, '-');
    const reorderKeyB = tabReorderTestData.titleB.toLowerCase().replace(/\s+/g, '-');

    await tabsPage.deleteTabViaApi(CASE_IDENTIFIER, draftVersion, tabKey);
    await tabsPage.deleteTabViaApi(CASE_IDENTIFIER, draftVersion, updatedTabKey);
    await tabsPage.deleteTabViaApi(CASE_IDENTIFIER, draftVersion, reorderKeyA);
    await tabsPage.deleteTabViaApi(CASE_IDENTIFIER, draftVersion, reorderKeyB);

    await context.close();
  });

  // ─── 6.74 View tabs configuration ─────────────────────────────────

  test.describe('6.74 — View tabs', () => {
    test('Tabs list is visible', async () => {
      await expect(tabsPage.tabsList).toBeVisible();
    });
  });

  // ─── 6.75 Add tab ─────────────────────────────────────────────────

  test.describe('6.75 — Add tab', () => {
    test.describe('Success', () => {
      test('Add a widgets tab', async () => {
        // Act
        await tabsPage.addWidgetsTab(tabTestData.title);

        // Assert
        await tabsPage.assertTabExists(tabTestData.title);
      });

      test('Delete the added tab', async () => {
        // Act
        await tabsPage.deleteTab(tabTestData.title);

        // Assert
        await tabsPage.assertTabNotExists(tabTestData.title);
      });
    });

    test.describe('Cancel', () => {
      test('Cancel the add-tab modal without saving', async () => {
        // Act — open modal then cancel
        await tabsPage.addTabButton.click();
        await tabsPage.modalCancelButton.click();

        // Assert — add-tab modal component is removed from DOM (*ngIf on openAddModal$)
        await expect(page.locator('valtimo-case-management-add-tab-modal')).toHaveCount(0);
      });
    });
  });

  // ─── 6.76 Rearrange tabs ──────────────────────────────────────────

  test.describe('6.76 — Rearrange tabs', () => {
    test('Add two tabs for reordering', async () => {
      await tabsPage.addWidgetsTab(tabReorderTestData.titleA);
      await tabsPage.assertTabExists(tabReorderTestData.titleA);

      await tabsPage.addWidgetsTab(tabReorderTestData.titleB);
      await tabsPage.assertTabExists(tabReorderTestData.titleB);
    });

    test('Reorder tabs via drag and drop', async () => {
      // Get initial positions
      const initialOrder = await tabsPage.getTabTitlesInOrder();
      const indexA = initialOrder.indexOf(tabReorderTestData.titleA);
      const indexB = initialOrder.indexOf(tabReorderTestData.titleB);
      expect(indexA).not.toBe(-1);
      expect(indexB).not.toBe(-1);

      // Act
      if (indexA < indexB) {
        await tabsPage.dragTabToPosition(tabReorderTestData.titleB, tabReorderTestData.titleA);
      } else {
        await tabsPage.dragTabToPosition(tabReorderTestData.titleA, tabReorderTestData.titleB);
      }

      // Assert — relative order should be reversed
      const newOrder = await tabsPage.getTabTitlesInOrder();
      const newIndexA = newOrder.indexOf(tabReorderTestData.titleA);
      const newIndexB = newOrder.indexOf(tabReorderTestData.titleB);
      if (indexA < indexB) {
        expect(newIndexB).toBeLessThan(newIndexA);
      } else {
        expect(newIndexA).toBeLessThan(newIndexB);
      }
    });

    test('Clean up reorder tabs', async () => {
      await tabsPage.deleteTab(tabReorderTestData.titleA);
      await tabsPage.assertTabNotExists(tabReorderTestData.titleA);

      await tabsPage.deleteTab(tabReorderTestData.titleB);
      await tabsPage.assertTabNotExists(tabReorderTestData.titleB);
    });
  });
});
