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
import {CaseDetailsProcessesPage} from './page';
import {apiDelete} from '../../utils/api.utils';
import {expectNotificationMessage} from '../../utils/ui.utils';

const TEST_PROCESS_NAME = 'E2E Test Process';
const TEST_PROCESS_KEY = 'e2e-test-process';
const CASE_KEY = 'bezwaar';
const CASE_VERSION = '1.0.1';

test.use({storageState: undefined});

test.describe('Case details - Processes tab', () => {
  let context;
  let page;
  let processesPage: CaseDetailsProcessesPage;
  let request;

  test.beforeAll(async ({browser, baseURL}) => {
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    request = context.request;

    processesPage = new CaseDetailsProcessesPage(page, request);

    await page.goto('/');
    await processesPage.goToCaseDetailsProcesses(CASE_KEY);
  });

  test.afterAll(async () => {
    // Clean up the test process in case it was left behind
    try {
      await apiDelete(
        `/api/management/v1/case-definition/${CASE_KEY}/version/${CASE_VERSION}/process-definition/key/${TEST_PROCESS_KEY}`
      );
    } catch {
      // Ignore if already deleted
    }
    await context.close();
  });

  test.describe('Process list', () => {
    test('Process list is visible and loaded', async () => {
      await processesPage.carbonList.waitForLoaded();
      await expect(processesPage.carbonList.table).toBeVisible();
    });

    test('Process list contains at least one process', async () => {
      const rowCount = await processesPage.carbonList.rows.count();
      expect(rowCount).toBeGreaterThan(0);
    });

    test('Process list shows the Bezwaar process', async () => {
      const row = processesPage.carbonList.row('Bezwaar');
      await row.assertVisible();
    });
  });

  test.describe('Toolbar buttons', () => {
    test('Upload button is visible', async () => {
      await expect(processesPage.uploadButton).toBeVisible();
    });

    test('Create Process button is visible', async () => {
      await expect(processesPage.createProcessButton).toBeVisible();
    });
  });

  test.describe('Upload modal', () => {
    test('Can open and close the upload modal', async () => {
      await processesPage.openUploadModal();
      await expect(processesPage.uploadModalUploadButton).toBeDisabled();

      await processesPage.closeUploadModal();
    });
  });

  test.describe('Create, edit and delete process', () => {
    test('Can upload a new process via the upload modal', async () => {
      await processesPage.uploadProcess();

      await expectNotificationMessage(page, 'success');
      const row = processesPage.carbonList.row(TEST_PROCESS_NAME);
      await row.assertVisible();
    });

    test('Can open the uploaded process in the editor', async () => {
      await processesPage.clickProcessRow(TEST_PROCESS_NAME);
      await page.waitForURL(/\/processes\//);

      // Verify the BPMN builder page loaded
      await expect(processesPage.builderContainer).toBeVisible();
      await expect(processesPage.builderBackButton).toBeVisible();
      await expect(processesPage.builderSaveButton).toBeVisible();
    });

    test('Process editor shows case-specific toggles', async () => {
      await expect(processesPage.startsCaseToggle).toBeVisible();
      await expect(processesPage.startableByUserToggle).toBeVisible();
    });

    test('Can navigate back to the process list', async () => {
      await processesPage.navigateBackFromBuilder();

      const row = processesPage.carbonList.row(TEST_PROCESS_NAME);
      await row.assertVisible();
    });

    test('Can delete the uploaded process', async () => {
      await processesPage.deleteProcess(TEST_PROCESS_NAME);

      await expectNotificationMessage(page, 'Delete');

      const row = processesPage.carbonList.row(TEST_PROCESS_NAME);
      await row.assertNotVisible();
    });
  });
});
