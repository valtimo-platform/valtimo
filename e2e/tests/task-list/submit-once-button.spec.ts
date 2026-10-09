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
import {apiDelete, apiPost} from '../../utils/api.utils';

test.describe('Submit once button', () => {
  const TASK_NAME = 'Submit once task';
  const FORM_SUBMISSION = /\/api\/v1\/process-link\/[^/]+\/form\/submission(\?|$)/;
  let context;
  let page;
  let taskListPage: TaskListPage;
  let createdDocumentId: string | undefined;

  test.beforeAll(async ({browser, baseURL}) => {
    test.setTimeout(60_000);
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    taskListPage = new TaskListPage(page);

    const created = await apiPost<{document: {id: string}}>(TASK_CONFIG.processDocumentEndpoint, {
      processDefinitionKey: TASK_CONFIG.submitOnceProcess,
      request: {
        definition: TASK_CONFIG.submitOnceProcess,
        caseDefinitionKey: TASK_CONFIG.submitOnceProcess,
        caseDefinitionVersionTag: '1.0.0',
        content: {},
      },
    });
    createdDocumentId = created?.document?.id;

    await page.goto('/tasks');
    await taskListPage.waitForTaskListLoaded();
    await taskListPage.selectCaseFromDropdown('Submit once test');
    await taskListPage.selectTab('All tasks');
    await expect(page.locator(`td:has-text("${TASK_NAME}")`).first()).toBeVisible({
      timeout: 25_000,
    });
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

  test('highlights an empty required field and completes the task once however often Submit is clicked', async () => {
    test.slow();
    const submissions: string[] = [];

    // Hold the submission so the form stays open while the user keeps clicking.
    await page.route(FORM_SUBMISSION, async route => {
      submissions.push(route.request().url());
      await new Promise(resolve => setTimeout(resolve, 2_000));
      await route.continue();
    });

    await taskListPage.openTaskByName(TASK_NAME);
    await taskListPage.claimTask();

    const dialog = page.getByRole('dialog');
    const submitButton = dialog.getByRole('button', {name: 'Submit'});

    await submitButton.click();
    await expect(dialog.getByText('Name is required').first()).toBeVisible();
    await expect(submitButton).toBeEnabled();
    expect(submissions).toHaveLength(0);

    await dialog.getByRole('textbox', {name: 'Name'}).fill('Jane Doe');
    for (let click = 0; click < 3; click++) {
      await submitButton.click({force: true});
      await page.waitForTimeout(400);
    }

    await taskListPage.assertTaskCompletedNotification(TASK_NAME);
    expect(submissions).toHaveLength(1);
  });
});
