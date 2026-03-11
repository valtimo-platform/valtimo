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

test.describe('Task list', () => {
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

    // Select the second option (first case definition after "All cases")
    const secondOption = options.nth(1);
    const secondOptionText = (await secondOption.innerText()).trim();
    await secondOption.click();

    // Wait for the task list to reload after selection
    await taskListPage.waitForTaskListLoaded();

    // Act: select the same item again
    await taskListPage.selectCaseFromDropdown(secondOptionText);

    // Assert: the task list should still be functional
    await taskListPage.assertTaskTableVisible();
    await taskListPage.assertTabsVisible();

    // Verify the dropdown still shows the selected case
    await expect(taskListPage.caseDropdown).toContainText(secondOptionText);
  });
});
