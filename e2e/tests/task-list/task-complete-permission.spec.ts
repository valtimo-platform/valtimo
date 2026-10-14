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

import {expect, Page, test} from '@playwright/test';
import {TaskListPage} from './page';
import {TASK_CONFIG} from './task-config';
import {UserCasesPage} from '../user-cases/page';
import {USER_CASES_CONFIG} from '../user-cases/user-cases-config';
import {apiDelete, apiPost} from '../../utils/api.utils';

const OPERATON_TASK = 'com.ritense.valtimo.operaton.domain.OperatonTask';
const AUTO_ASSIGN_TASK_NAME = 'Task for ROLE_ADMIN';

// The suite only logs in as admin, so a role without 'complete' is simulated by its permission answer
async function answerCompletePermission(page: Page, available: boolean) {
  await page.route('**/api/v1/permissions', async route => {
    const requested = route.request().postDataJSON() as {action: string; resource: string}[];
    const response = await route.fetch();
    const answers = (await response.json()) as {available: boolean}[];
    await route.fulfill({
      response,
      json: answers.map((answer, index) =>
        requested[index]?.action === 'complete' && requested[index]?.resource === OPERATON_TASK
          ? {...answer, available}
          : answer
      ),
    });
  });
}

test.describe('3.7 — Task form without the complete permission', () => {
  test.describe('Task list', () => {
    let createdDocumentId: string | undefined;
    let taskListPage: TaskListPage;

    test.beforeAll(async () => {
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
    });

    test.afterAll(async () => {
      if (createdDocumentId) {
        try {
          await apiDelete(`${TASK_CONFIG.documentEndpoint}/${createdDocumentId}`);
        } catch {
          // Already deleted or permission denied — best-effort cleanup
        }
      }
    });

    const openAutoAssignTask = async (page: Page) => {
      taskListPage = new TaskListPage(page);
      await page.goto('/tasks');
      await taskListPage.waitForTaskListLoaded();
      await taskListPage.selectCaseFromDropdown('Auto assign test');
      await taskListPage.selectTab('All tasks');
      await taskListPage.openTaskByName(AUTO_ASSIGN_TASK_NAME);
    };

    test('disables the submit button when the complete permission is denied', async ({page}) => {
      await answerCompletePermission(page, false);
      await openAutoAssignTask(page);

      const submitButton = taskListPage.taskDetailDialog.getByRole('button', {name: 'Submit'});
      await expect(submitButton).toBeVisible({timeout: 10_000});
      await expect(submitButton).toBeDisabled();
    });

    test('enables the submit button when the complete permission is granted', async ({page}) => {
      await answerCompletePermission(page, true);
      await openAutoAssignTask(page);

      const submitButton = taskListPage.taskDetailDialog.getByRole('button', {name: 'Submit'});
      await expect(submitButton).toBeEnabled({timeout: 10_000});
    });
  });

  test.describe('Tasks of a case', () => {
    let createdDocumentId: string | undefined;
    let userCasesPage: UserCasesPage;

    test.beforeEach(async ({page}) => {
      userCasesPage = new UserCasesPage(page);
      createdDocumentId = (await userCasesPage.createCaseViaApi()).documentId;
    });

    test.afterEach(async () => {
      if (createdDocumentId) await userCasesPage.deleteCaseViaApi(createdDocumentId);
    });

    const openValidateRequestTask = async () => {
      await userCasesPage.goToCaseDetail(createdDocumentId!);
      await userCasesPage.openTaskInPanel(USER_CASES_CONFIG.validateRequestTask);
    };

    test('shows the task form read-only when the complete permission is denied', async ({page}) => {
      await answerCompletePermission(page, false);
      await openValidateRequestTask();

      // This form keeps its submit button disabled until it is valid, so its fields show the read-only state
      const bsnField = userCasesPage.taskDetailPanel.getByRole('textbox', {
        name: 'Burgerservicenummer',
      });
      await expect(bsnField).toBeVisible({timeout: 15_000});
      await expect(bsnField).toBeDisabled();
      await expect(
        userCasesPage.taskDetailPanel.getByRole('button', {name: 'Submit'})
      ).toBeDisabled();
    });

    test('keeps the task form editable when the complete permission is granted', async ({page}) => {
      await answerCompletePermission(page, true);
      await openValidateRequestTask();

      const bsnField = userCasesPage.taskDetailPanel.getByRole('textbox', {
        name: 'Burgerservicenummer',
      });
      await expect(bsnField).toBeEditable({timeout: 15_000});
    });
  });
});
