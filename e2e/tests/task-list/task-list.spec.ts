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
import {TaskListPage} from './page';
import {TASK_CONFIG} from './task-config';
import {apiPost} from '../../utils/api.utils';

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

test.describe('Task details', () => {
  const TASK_NAME = 'Task for ROLE_ADMIN';
  let context;
  let page;
  let taskListPage: TaskListPage;

  test.beforeAll(async ({browser, baseURL}) => {
    test.setTimeout(60_000);
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    taskListPage = new TaskListPage(page);

    // Create a case with the auto-assign-test process to generate simple tasks
    await apiPost(TASK_CONFIG.processDocumentEndpoint, {
      processDefinitionKey: TASK_CONFIG.autoAssignProcess,
      request: {
        definition: TASK_CONFIG.autoAssignProcess,
        caseDefinitionKey: TASK_CONFIG.autoAssignProcess,
        caseDefinitionVersionTag: '1.0.0',
        content: {},
      },
    });

    await page.goto('/tasks');
    await taskListPage.waitForTaskListLoaded();
    await taskListPage.selectTab('All tasks');
    await taskListPage.selectCaseFromDropdown('Auto assign test');

    const taskCell = page.locator(`td:has-text("${TASK_NAME}")`).first();
    try {
      await taskCell.waitFor({state: 'visible', timeout: 5_000});
    } catch {
      await page.reload();
      await taskListPage.waitForTaskListLoaded();
      await taskListPage.selectTab('All tasks');
      await taskListPage.selectCaseFromDropdown('Auto assign test');
      await expect(taskCell).toBeVisible({timeout: 25_000});
    }
  });

  test.afterAll(async () => {
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
