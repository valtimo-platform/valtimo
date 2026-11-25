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
import * as fs from 'fs';
import path from 'path';
import {runCleanups} from '../../utils/cleanup.utils';
import {FORM_IN_USE_PROCESS, FORM_IN_USE_TEXTS} from './form-management-config';
import {FormManagementPage} from './page';

test.use({storageState: undefined});

test.describe.configure({mode: 'serial'});

test.describe('Form management — delete a form that a process link uses', () => {
  let context;
  let page;
  let formManagementPage: FormManagementPage;
  let formId: string;
  let processLinkId: string;

  const formName = `e2e-form-in-use-${Date.now()}`;
  const usagesText = `${FORM_IN_USE_PROCESS.name} (${FORM_IN_USE_PROCESS.userTaskId})`;

  test.beforeAll(async ({browser, baseURL}) => {
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    formManagementPage = new FormManagementPage(page, context.request);

    await formManagementPage.deleteGlobalProcessViaApi(FORM_IN_USE_PROCESS.key);
    const processDefinitionId = await formManagementPage.deployGlobalProcessViaApi(
      FORM_IN_USE_PROCESS.key,
      fs.readFileSync(path.resolve(__dirname, '../../assets', FORM_IN_USE_PROCESS.assetFileName))
    );
    formId = await formManagementPage.createGlobalFormViaApi(formName);
    processLinkId = await formManagementPage.createFormProcessLinkViaApi(
      processDefinitionId,
      FORM_IN_USE_PROCESS.userTaskId,
      formId
    );
  });

  test.afterAll(async () => {
    await runCleanups(
      async () => processLinkId && formManagementPage.deleteProcessLinkViaApi(processLinkId),
      async () => formId && formManagementPage.deleteGlobalFormViaApi(formId),
      () => formManagementPage.deleteGlobalProcessViaApi(FORM_IN_USE_PROCESS.key)
    );
    if (context) await context.close();
  });

  test('Deleting from the list shows the in-use toast and keeps the form', async () => {
    // Arrange
    await formManagementPage.goToFormManagement();
    await formManagementPage.carbonList.search(formName);
    await formManagementPage.carbonList.waitForLoaded();

    // Act
    await formManagementPage.deleteFromList(formName);

    // Assert
    const inUseToast = formManagementPage.toasts(FORM_IN_USE_TEXTS.inUse(usagesText));
    await expect(inUseToast).toHaveCount(1);
    await expect(formManagementPage.toasts(FORM_IN_USE_TEXTS.unexpectedError)).toHaveCount(0);
    await formManagementPage.assertFormVisible(formName);
  });

  test('Deleting from the edit page shows the in-use toast and keeps the form', async () => {
    // Arrange
    await formManagementPage.goToFormEditPage(formName);

    // Act
    await formManagementPage.deleteFromEditPage();

    // Assert
    const inUseToast = formManagementPage.toasts(FORM_IN_USE_TEXTS.inUse(usagesText));
    await expect(inUseToast).toHaveCount(1);
    await expect(formManagementPage.toasts(FORM_IN_USE_TEXTS.unexpectedError)).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/form-management/${formId}$`));

    await formManagementPage.goToFormManagement();
    await formManagementPage.carbonList.search(formName);
    await formManagementPage.carbonList.waitForLoaded();
    await formManagementPage.assertFormVisible(formName);
  });
});
