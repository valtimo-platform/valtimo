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
import {CaseTaskPanelPage} from './page';

test.use({storageState: 'playwright/.auth/uiState.json'});

test.describe('Case detail — task panel headings', () => {
  let context;
  let page;
  let taskPanelPage: CaseTaskPanelPage;
  let documentId: string | undefined;

  test.beforeAll(async ({browser, baseURL}) => {
    context = await browser.newContext({
      baseURL,
      storageState: 'playwright/.auth/uiState.json',
    });
    page = await context.newPage();
    taskPanelPage = new CaseTaskPanelPage(page);
    documentId = await taskPanelPage.createCaseViaApi();
  });

  test.afterAll(async () => {
    if (documentId) await taskPanelPage.deleteCaseViaApi(documentId);
    await context.close();
  });

  test('heads the panel once with "My tasks", at the widget heading size, with "Other tasks" the same size', async () => {
    await taskPanelPage.goToCaseDetail(documentId);

    const myTasks = taskPanelPage.panelHeadings('My tasks');
    const otherTasks = taskPanelPage.panelHeadings('Other tasks');

    await expect(myTasks).toHaveCount(1);
    await expect(
      taskPanelPage.taskListPanel.getByRole('heading', {level: 2, name: 'My tasks', exact: true})
    ).toHaveCount(1);
    await expect(taskPanelPage.panelHeadings('Tasks')).toHaveCount(0);
    await expect(otherTasks).toHaveCount(1);

    const headingSize = await taskPanelPage.fontSize(myTasks);
    expect(headingSize).toBe('16px');
    expect(await taskPanelPage.fontSize(otherTasks)).toBe(headingSize);
  });
});
