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
  CASE_IDENTIFIER,
  taskColumnReorderTestData,
  taskColumnTestData,
  taskSearchFieldTestData,
} from './case-details-management-tasks';
import {CaseDetailsManagementTasksPage} from './page';

test.use({storageState: undefined});

test.describe('Case details management — Tasks', () => {
  let context;
  let page;
  let tasksPage: CaseDetailsManagementTasksPage;
  let request;

  // Arrange
  test.beforeAll(async ({browser, baseURL}) => {
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    request = context.request;

    tasksPage = new CaseDetailsManagementTasksPage(page, request);

    await page.goto('/');
    await tasksPage.goToCaseManagement(CASE_IDENTIFIER);
    await tasksPage.ensureDraftVersionSelected();

    // Clean up leftover data
    await tasksPage.deleteColumnViaApi(CASE_IDENTIFIER, taskColumnTestData.key);
    await tasksPage.deleteColumnViaApi(CASE_IDENTIFIER, taskColumnReorderTestData.keyA);
    await tasksPage.deleteColumnViaApi(CASE_IDENTIFIER, taskColumnReorderTestData.keyB);
    await tasksPage.deleteSearchFieldViaApi(CASE_IDENTIFIER, taskSearchFieldTestData.key);

    await tasksPage.switchToTasksTab();
  });

  test.afterAll(async () => {
    await tasksPage.deleteColumnViaApi(CASE_IDENTIFIER, taskColumnTestData.key);
    await tasksPage.deleteColumnViaApi(CASE_IDENTIFIER, taskColumnReorderTestData.keyA);
    await tasksPage.deleteColumnViaApi(CASE_IDENTIFIER, taskColumnReorderTestData.keyB);
    await tasksPage.deleteSearchFieldViaApi(CASE_IDENTIFIER, taskSearchFieldTestData.key);

    await context.close();
  });

  // ─── 6.62 View task list columns ──────────────────────────────────

  test.describe('View task list columns', () => {
    test('Columns list is visible', async () => {
      await expect(tasksPage.columnsList).toBeVisible();
    });
  });

  // ─── 6.63 Add task list column ────────────────────────────────────

  test.describe('Add task list column', () => {
    test.describe('Success', () => {
      test('Add a column', async () => {
        // Act
        await tasksPage.addColumn(taskColumnTestData);

        // Assert
        await tasksPage.assertColumnExists(taskColumnTestData.key);
      });

      test('Delete the added column', async () => {
        // Act
        await tasksPage.deleteColumn(taskColumnTestData.key);

        // Assert
        await tasksPage.assertColumnNotExists(taskColumnTestData.key);
      });
    });
  });

  // ─── 6.64 Rearrange task list columns ─────────────────────────────

  test.describe('Rearrange task list columns', () => {
    test('Add two columns for reordering', async () => {
      await tasksPage.addColumn({
        title: taskColumnReorderTestData.titleA,
        key: taskColumnReorderTestData.keyA,
        path: taskColumnReorderTestData.pathA,
        displayType: taskColumnTestData.displayType,
      });
      await tasksPage.assertColumnExists(taskColumnReorderTestData.keyA);

      await tasksPage.addColumn({
        title: taskColumnReorderTestData.titleB,
        key: taskColumnReorderTestData.keyB,
        path: taskColumnReorderTestData.pathB,
        displayType: taskColumnTestData.displayType,
      });
      await tasksPage.assertColumnExists(taskColumnReorderTestData.keyB);
    });

    test('Reorder columns via drag and drop', async () => {
      // Get initial positions
      const indexA = await tasksPage.getColumnIndexInList(taskColumnReorderTestData.keyA);
      const indexB = await tasksPage.getColumnIndexInList(taskColumnReorderTestData.keyB);
      expect(indexA).not.toBe(-1);
      expect(indexB).not.toBe(-1);

      // Act — drag the later column above the earlier one
      if (indexA < indexB) {
        await tasksPage.dragColumnToPosition(
          taskColumnReorderTestData.keyB,
          taskColumnReorderTestData.keyA
        );
      } else {
        await tasksPage.dragColumnToPosition(
          taskColumnReorderTestData.keyA,
          taskColumnReorderTestData.keyB
        );
      }

      // Assert — relative order should be reversed
      const newIndexA = await tasksPage.getColumnIndexInList(taskColumnReorderTestData.keyA);
      const newIndexB = await tasksPage.getColumnIndexInList(taskColumnReorderTestData.keyB);
      if (indexA < indexB) {
        expect(newIndexB).toBeLessThan(newIndexA);
      } else {
        expect(newIndexA).toBeLessThan(newIndexB);
      }
    });

    test('Clean up reorder columns', async () => {
      await tasksPage.deleteColumn(taskColumnReorderTestData.keyA);
      await tasksPage.assertColumnNotExists(taskColumnReorderTestData.keyA);

      await tasksPage.deleteColumn(taskColumnReorderTestData.keyB);
      await tasksPage.assertColumnNotExists(taskColumnReorderTestData.keyB);
    });
  });

  // ─── 6.65 View task search fields ────────────────────────────────

  test.describe('View task search fields', () => {
    test('Switch to Search fields sub-tab', async () => {
      await tasksPage.switchToSearchFieldsSubTab();
    });

    test('Search fields list is visible', async () => {
      await expect(tasksPage.searchFieldsList).toBeVisible();
    });
  });

  // ─── 6.66 Add task search field ──────────────────────────────────

  test.describe('Add task search field', () => {
    test('Add a search field', async () => {
      // Act
      await tasksPage.addSearchField(taskSearchFieldTestData);

      // Assert
      await tasksPage.assertSearchFieldExists(taskSearchFieldTestData.key);
    });

    test('Delete the added search field', async () => {
      // Act
      await tasksPage.deleteSearchField(taskSearchFieldTestData.key);

      // Assert
      await tasksPage.assertSearchFieldNotExists(taskSearchFieldTestData.key);
    });
  });
});
