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
import {CASE_IDENTIFIER, tabTestData, tabReorderTestData} from './case-details-management-tabs';
import {CaseDetailsManagementTabsPage} from './page';

test.use({storageState: undefined});

test.describe('Case details management — Tabs', () => {
  let context;
  let page;
  let tabsPage: CaseDetailsManagementTabsPage;
  let request;
  let draftVersion: string;

  // Arrange
  test.beforeAll(async ({browser, baseURL}) => {
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    request = context.request;

    tabsPage = new CaseDetailsManagementTabsPage(page, request);

    await page.goto('/');
    await tabsPage.goToCaseManagement(CASE_IDENTIFIER);
    draftVersion = await tabsPage.ensureDraftVersionSelected();

    // Clean up leftover tabs from previous failed runs (across all versions)
    const tabKey = tabTestData.title.toLowerCase().replace(/\s+/g, '-');
    const updatedTabKey = tabTestData.updatedTitle.toLowerCase().replace(/\s+/g, '-');
    const reorderKeyA = tabReorderTestData.titleA.toLowerCase().replace(/\s+/g, '-');
    const reorderKeyB = tabReorderTestData.titleB.toLowerCase().replace(/\s+/g, '-');
    await tabsPage.deleteTabFromAllVersions(CASE_IDENTIFIER, tabKey);
    await tabsPage.deleteTabFromAllVersions(CASE_IDENTIFIER, updatedTabKey);
    await tabsPage.deleteTabFromAllVersions(CASE_IDENTIFIER, reorderKeyA);
    await tabsPage.deleteTabFromAllVersions(CASE_IDENTIFIER, reorderKeyB);

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

  test.describe('View tabs', () => {
    test('Tabs list is visible', async () => {
      await expect(tabsPage.tabsList).toBeVisible();
    });
  });

  // ─── 6.75 Add tab ─────────────────────────────────────────────────

  test.describe('Add tab', () => {
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

  test.describe('Rearrange tabs', () => {
    test('Add two tabs for reordering', async () => {
      await tabsPage.addWidgetsTab(tabReorderTestData.titleA);
      await tabsPage.assertTabExists(tabReorderTestData.titleA);

      await tabsPage.addWidgetsTab(tabReorderTestData.titleB);
      await tabsPage.assertTabExists(tabReorderTestData.titleB);
    });

    test('Drag tab B above tab A', async () => {
      // Arrange — verify initial order: A before B
      const initialOrder = await tabsPage.getTabTitlesInOrder();
      const indexA = initialOrder.indexOf(tabReorderTestData.titleA);
      const indexB = initialOrder.indexOf(tabReorderTestData.titleB);
      expect(indexA).toBeLessThan(indexB);

      // Act
      await tabsPage.dragTabToPosition(tabReorderTestData.titleB, tabReorderTestData.titleA);

      // Assert — B is now before A
      const newOrder = await tabsPage.getTabTitlesInOrder();
      const newIndexA = newOrder.indexOf(tabReorderTestData.titleA);
      const newIndexB = newOrder.indexOf(tabReorderTestData.titleB);
      expect(newIndexB).toBeLessThan(newIndexA);
    });

    test('Clean up reorder tabs', async () => {
      await tabsPage.deleteTab(tabReorderTestData.titleA);
      await tabsPage.assertTabNotExists(tabReorderTestData.titleA);

      await tabsPage.deleteTab(tabReorderTestData.titleB);
      await tabsPage.assertTabNotExists(tabReorderTestData.titleB);
    });
  });
});
