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
import {WidgetProcessAccessPage} from './page';
import {WIDGET_PROCESS_ACCESS_CONFIG as CONFIG} from './widget-process-access-config';

test.use({storageState: 'playwright/.auth/uiState.json'});

// The admin role's right to start processes is narrowed for the whole group and restored in
// afterAll, so the tests share one context and run in order.
test.describe.configure({mode: 'serial'});

test.describe('Case widget process button follows access rules on the case status', () => {
  let context;
  let page;
  let widgetProcessPage: WidgetProcessAccessPage;
  let allowedCaseId: string;
  let otherCaseId: string;
  let movingCaseId: string;

  test.beforeAll(async ({browser, baseURL}) => {
    test.setTimeout(120_000);
    context = await browser.newContext({
      baseURL,
      storageState: 'playwright/.auth/uiState.json',
    });
    page = await context.newPage();
    widgetProcessPage = new WidgetProcessAccessPage(page);

    await widgetProcessPage.importCaseDefinition();
    allowedCaseId = await widgetProcessPage.createCaseViaApi(CONFIG.allowedStatus);
    otherCaseId = await widgetProcessPage.createCaseViaApi(CONFIG.otherStatus);
    movingCaseId = await widgetProcessPage.createCaseViaApi(CONFIG.otherStatus);
    await widgetProcessPage.restrictProcessStartRights();
  });

  test.afterAll(async () => {
    await widgetProcessPage.restoreProcessStartRights();
    for (const documentId of [allowedCaseId, otherCaseId, movingCaseId]) {
      if (documentId) await widgetProcessPage.deleteCaseViaApi(documentId);
    }
    await context?.close();
  });

  test('offers the process on the widget, as under Start, when the case status allows it', async () => {
    await widgetProcessPage.goToWidgetTab(allowedCaseId);

    await expect(widgetProcessPage.widgetProcessButton).toBeVisible();
    await expect(widgetProcessPage.startButton).toBeEnabled();
    await widgetProcessPage.startButton.click();
    await expect(widgetProcessPage.startMenuItem).toBeVisible();
    await page.keyboard.press('Escape');

    await widgetProcessPage.widgetProcessButton.click();
    await expect(widgetProcessPage.startDialogTitle).toBeVisible();
  });

  test('offers the process on neither when the case status does not allow it', async () => {
    await widgetProcessPage.goToWidgetTab(otherCaseId);

    await expect(widgetProcessPage.widgetProcessButton).toHaveCount(0);
    await expect(widgetProcessPage.startButton).toBeDisabled();
  });

  test('offers the process on both once the case moves into the allowed status while it is open', async () => {
    await widgetProcessPage.goToWidgetTab(movingCaseId);
    await expect(widgetProcessPage.widgetProcessButton).toHaveCount(0);
    await expect(widgetProcessPage.startButton).toBeDisabled();

    await widgetProcessPage.changeStatusViaApi(movingCaseId, CONFIG.allowedStatus);

    await expect(widgetProcessPage.widgetProcessButton).toBeVisible({timeout: 15_000});
    await expect(widgetProcessPage.startButton).toBeEnabled();
  });
});
