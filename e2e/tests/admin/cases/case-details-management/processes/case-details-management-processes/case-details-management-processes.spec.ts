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
import {apiDelete} from '../../../../../../utils/api.utils';
import {expectNotificationMessage} from '../../../../../../utils/ui.utils';

const TEST_PROCESS_NAME = 'E2E Test Process';
const TEST_PROCESS_KEY = 'e2e-test-process';
const CASE_KEY = 'bezwaar';

test.use({storageState: undefined});

test.describe('Case details - Processes tab', () => {
  let context;
  let page;
  let processesPage: CaseDetailsProcessesPage;
  let request;
  let draftVersion: string;

  test.beforeAll(async ({browser, baseURL}) => {
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    request = context.request;

    processesPage = new CaseDetailsProcessesPage(page, request);

    await page.goto('/');
    draftVersion = await processesPage.goToCaseDetailsProcesses(CASE_KEY);

    // Clean up stale test process from previous runs
    try {
      await apiDelete(
        `/api/management/v1/case-definition/${CASE_KEY}/version/${draftVersion}/process-definition/key/${TEST_PROCESS_KEY}`
      );
    } catch {
      // Process may not exist
    }
  });

  test.afterAll(async () => {
    // Clean up the test process in case it was left behind
    try {
      await apiDelete(
        `/api/management/v1/case-definition/${CASE_KEY}/version/${draftVersion}/process-definition/key/${TEST_PROCESS_KEY}`
      );
    } catch {
      // Ignore if already deleted
    }
    await context.close();
  });

  test.describe('6.6 — Process list', () => {
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

  test.describe('6.7, 6.8, 6.9, 6.10, 6.11 — Create, edit, save and delete process', () => {
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

    test('Can navigate back to the process list via the Back button', async () => {
      await processesPage.navigateBackFromBuilder();

      const row = processesPage.carbonList.row(TEST_PROCESS_NAME);
      await row.assertVisible();
    });

    test('Can reopen the uploaded process for editing', async () => {
      await processesPage.clickProcessRow(TEST_PROCESS_NAME);
      await page.waitForURL(/\/processes\//);

      await expect(processesPage.builderContainer).toBeVisible();
      await expect(processesPage.bpmnPalette).toBeVisible();
    });

    test('Save button is disabled before any changes are made', async () => {
      await expect(processesPage.builderSaveButton).toBeDisabled();
    });

    test('6.9 — Can add a BPMN task element via the context pad', async () => {
      const initialTaskCount = await processesPage.taskShapes.count();

      await processesPage.appendTaskToStartEvent();

      await expect(processesPage.taskShapes).toHaveCount(initialTaskCount + 1);
      await expect(processesPage.builderSaveButton).toBeEnabled();
    });

    test('6.10 — Can enable "Starts case" process property', async () => {
      const switchControl = processesPage.startsCaseToggle.getByRole('switch');
      await expect(switchControl).not.toBeChecked();

      await processesPage.clickStartsCaseToggle();

      await expect(switchControl).toBeChecked();
    });

    test('6.10 — Can enable "Startable by user" process property', async () => {
      const switchControl = processesPage.startableByUserToggle.getByRole('switch');
      await expect(switchControl).not.toBeChecked();

      await processesPage.clickStartableByUserToggle();

      await expect(switchControl).toBeChecked();
    });

    test('6.11 — Can save process with success notification and navigate back to list', async () => {
      await processesPage.saveProcess();
      await expectNotificationMessage(page, 'deployed');

      // Saving in case context auto-navigates back to the process list
      await page.waitForURL(/\/processes$/);
      await processesPage.carbonList.waitForLoaded();

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
