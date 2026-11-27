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
import {getAutoRefreshSettingViaApi, setAutoRefreshSettingViaApi, TaskListPage} from './page';
import {TASK_CONFIG} from './task-config';
import {apiDelete, apiPost} from '../../utils/api.utils';

test.describe('3.1, 3.2 — Task list', () => {
  let taskListPage: TaskListPage;

  test.beforeEach(async ({page}) => {
    taskListPage = new TaskListPage(page);
    await page.goto('/tasks');
    await taskListPage.waitForTaskListLoaded();
  });

  test('Selecting the same dropdown item twice does not break the task list', async ({page}) => {
    // Get the available case options from the dropdown
    await taskListPage.caseDropdown.click();
    const options = page.getByRole('option');
    const optionCount = await options.count();

    // Need at least 2 options (All cases + one case definition) to test this
    test.skip(optionCount < 2, 'Not enough case definitions to test dropdown selection');

    // Find a unique option to avoid duplicate names
    let targetOption = options.nth(1);
    let targetOptionText = (await targetOption.innerText()).trim();

    // Check for duplicates — if the chosen option name appears more than once, try others
    for (let i = 1; i < optionCount; i++) {
      const candidate = options.nth(i);
      const candidateText = (await candidate.innerText()).trim();
      const matchCount = await page.getByRole('option', {name: candidateText}).count();
      if (matchCount === 1) {
        targetOption = candidate;
        targetOptionText = candidateText;
        break;
      }
    }

    await targetOption.click();

    // Wait for the task list to reload after selection
    await taskListPage.waitForTaskListLoaded();

    // Act: select the same item again
    await taskListPage.selectCaseFromDropdown(targetOptionText);

    // Assert: the task list should still be functional
    await taskListPage.assertTaskTableVisible();
    await taskListPage.assertTabsVisible();

    // Verify the dropdown still shows the selected case
    await expect(taskListPage.caseDropdown).toContainText(targetOptionText);
  });
});

test.describe('3.7 — Automatic task list refresh per user', () => {
  let taskListPage: TaskListPage;
  let originalAutoRefresh: boolean | null | undefined;
  const createdDocumentIds: string[] = [];

  const startAutoAssignCase = async () => {
    const created = await apiPost<{document: {id: string}}>(TASK_CONFIG.processDocumentEndpoint, {
      processDefinitionKey: TASK_CONFIG.autoAssignProcess,
      request: {
        definition: TASK_CONFIG.autoAssignProcess,
        caseDefinitionKey: TASK_CONFIG.autoAssignProcess,
        caseDefinitionVersionTag: '1.0.0',
        content: {},
      },
    });
    if (created?.document?.id) createdDocumentIds.push(created.document.id);
  };

  test.beforeAll(async () => {
    originalAutoRefresh = await getAutoRefreshSettingViaApi();
  });

  test.afterAll(async () => {
    for (const id of createdDocumentIds) {
      try {
        await apiDelete(`${TASK_CONFIG.documentEndpoint}/${id}`);
      } catch {
        // Best-effort cleanup
      }
    }

    try {
      // null = no user choice, so the admin default applies again
      await setAutoRefreshSettingViaApi(originalAutoRefresh ?? null);
    } catch {
      // Best-effort restore
    }
  });

  test('manual refresh shows changes, and the user choice survives a reload', async ({page}) => {
    test.slow();
    taskListPage = new TaskListPage(page);
    await setAutoRefreshSettingViaApi(false);

    await page.goto('/tasks');
    await taskListPage.waitForTaskListLoaded();
    await expect(taskListPage.refreshTasksButton).toBeVisible();
    await expect(taskListPage.tasksChangedNotice).toBeHidden();

    // Manual: a task change shows the notice instead of reloading
    await startAutoAssignCase();
    await expect(taskListPage.tasksChangedNotice).toBeVisible({timeout: 15_000});

    await taskListPage.refreshTasksButton.click();
    await expect(taskListPage.tasksChangedNotice).toBeHidden();

    // Switch to automatic via the menu
    await taskListPage.openRefreshSettings();
    await taskListPage.assertAutoRefreshOption(false);
    const saved = page.waitForResponse(
      response =>
        response.url().endsWith('/api/v1/user/settings') && response.request().method() === 'PUT'
    );
    await taskListPage.autoRefreshOption.click();
    await saved;

    await expect(taskListPage.refreshTasksButton).toBeHidden();
    expect(await getAutoRefreshSettingViaApi()).toBe(true);

    await page.reload();
    await taskListPage.waitForTaskListLoaded();
    await expect(taskListPage.refreshTasksButton).toBeHidden();
    await taskListPage.openRefreshSettings();
    await taskListPage.assertAutoRefreshOption(true);

    // Back to manual
    await taskListPage.autoRefreshOption.click();
    await expect(taskListPage.refreshTasksButton).toBeVisible();
  });
});

test.describe('Task details', () => {
  const TASK_NAME = 'Task for ROLE_ADMIN';
  let context;
  let page;
  let taskListPage: TaskListPage;
  let createdDocumentId: string | undefined;

  test.beforeAll(async ({browser, baseURL}) => {
    test.setTimeout(60_000);
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    taskListPage = new TaskListPage(page);

    // Create a case with the auto-assign-test process to generate simple tasks
    const created = await apiPost<{document: {id: string}}>(TASK_CONFIG.processDocumentEndpoint, {
      processDefinitionKey: TASK_CONFIG.autoAssignProcess,
      request: {
        definition: TASK_CONFIG.autoAssignProcess,
        caseDefinitionKey: TASK_CONFIG.autoAssignProcess,
        caseDefinitionVersionTag: '1.0.0',
        content: {},
      },
    });
    createdDocumentId = created?.document?.id;

    await page.goto('/tasks');
    await taskListPage.waitForTaskListLoaded();
    await taskListPage.selectCaseFromDropdown('Auto assign test');
    await taskListPage.selectTab('All tasks');

    const taskCell = page.locator(`td:has-text("${TASK_NAME}")`).first();
    try {
      await taskCell.waitFor({state: 'visible', timeout: 5_000});
    } catch {
      await page.reload();
      await taskListPage.waitForTaskListLoaded();
      await taskListPage.selectCaseFromDropdown('Auto assign test');
      await taskListPage.selectTab('All tasks');
      await expect(taskCell).toBeVisible({timeout: 25_000});
    }
  });

  test.afterAll(async () => {
    if (createdDocumentId) {
      try {
        await apiDelete(`${TASK_CONFIG.documentEndpoint}/${createdDocumentId}`);
      } catch {
        // Already deleted or permission denied — best-effort cleanup
      }
    }
    await context.close();
  });

  test.describe('3.3 — View task details', () => {
    test('opens task detail modal when clicking a task row', async () => {
      await taskListPage.openTaskByName(TASK_NAME);
      await taskListPage.assertTaskDetailVisible(TASK_NAME);
      await taskListPage.closeTaskDetailModal();
    });
  });

  test.describe('3.4 — Claim task, 3.5 + 3.6 — Complete task', () => {
    test('can claim, submit, and complete a task', async () => {
      test.slow();
      await taskListPage.openTaskByName(TASK_NAME);
      await taskListPage.assertTaskDetailVisible(TASK_NAME);
      await taskListPage.claimTask();
      await taskListPage.assertTaskAssigned();
      await taskListPage.submitEmptyForm();
      await taskListPage.assertTaskCompletedNotification(TASK_NAME);
    });
  });
});
