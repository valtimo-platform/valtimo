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

import {test, expect, type Browser, type BrowserContext, type Page} from '@playwright/test';
import {IkoServerPage} from './page';
import {IKO_SERVER_TITLE_PREFIX, ikoServerConfig, uniqueServerTitle} from './iko-server-config';

test.use({storageState: undefined});

test.describe('Feature 15A — IKO Server', () => {
  let context: BrowserContext;
  let page: Page;
  let ikoServerPage: IkoServerPage;

  test.beforeAll(async ({browser, baseURL}: {browser: Browser; baseURL?: string}) => {
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    ikoServerPage = new IkoServerPage(page, context.request);

    await ikoServerPage.goToIkoManagement();
  });

  test.afterAll(async () => {
    // Remove every server created by this suite (matched by title prefix).
    await ikoServerPage.cleanupTestServersViaApi(IKO_SERVER_TITLE_PREFIX);
    await context.close();
  });

  // ─── Server CRUD (15.1 – 15.9) ──────────────────────────────────────

  test.describe('Server management', () => {
    const initialTitle = uniqueServerTitle('crud');
    // Independent title (not a superset of `initialTitle`) — CarbonList row
    // matching uses substring `hasText`, so an "... (edited)" suffix would
    // still match the original title and break the not-visible assertion.
    const editedTitle = uniqueServerTitle('crud-edited');

    test('15.1 — displays the IKO servers list', async () => {
      await ikoServerPage.list.waitForLoaded();
      await expect(ikoServerPage.configureServerButton).toBeVisible();
    });

    test('15.2-15.6 — creates a server with auto-generated key and URL', async () => {
      await ikoServerPage.openConfigureModal();

      // 15.3 enter title → 15.4 key auto-generates → 15.5 enter the server URL.
      await ikoServerPage.fillServerForm(initialTitle, ikoServerConfig.serverUrl);

      // 15.6 save the configuration.
      await ikoServerPage.save();
      await ikoServerPage.assertServerVisible(initialTitle);
    });

    test('15.7 — edits a server title', async () => {
      await ikoServerPage.editServerTitle(initialTitle, editedTitle);
      await ikoServerPage.assertServerVisible(editedTitle);
      await ikoServerPage.assertServerNotVisible(initialTitle);
    });

    test('15.8-15.9 — deletes a server via the confirmation dialog', async () => {
      // 15.9 the confirmation dialog is asserted inside openDeleteDialog().
      await ikoServerPage.openDeleteDialog(editedTitle);
      await ikoServerPage.confirmDelete();
      await ikoServerPage.assertServerNotVisible(editedTitle);
    });
  });

  // ─── Definition import (15.10 – 15.12) ──────────────────────────────

  test.describe('Definition import', () => {
    const importServerTitle = uniqueServerTitle('import');

    test.beforeAll(async () => {
      // Create the parent server via the API (not the modal UI) — this suite
      // tests the import flow, not server creation, and the API path is fast
      // and free of the modal's reactive-form races that would otherwise eat
      // into the beforeAll hook timeout.
      await ikoServerPage.createServerViaApi(importServerTitle, ikoServerConfig.serverUrl);
      await ikoServerPage.goToIkoManagement();
      // The import button lives on the server's (empty) views page.
      await ikoServerPage.enterServer(importServerTitle);
    });

    test('15.10 — opens the import definition modal', async () => {
      await ikoServerPage.openImportModal();
      await expect(ikoServerPage.importModalHeading).toBeVisible();
      await expect(ikoServerPage.importFileInput).toBeAttached();
      await ikoServerPage.cancelImport();
    });

    test('15.11 — selects a file and requires overwrite confirmation', async () => {
      await ikoServerPage.openImportModal();
      await ikoServerPage.selectImportFile(ikoServerConfig.importZipPath);

      // The overwrite confirmation appears only once a file is selected.
      await expect(ikoServerPage.importOverwriteCheckbox).toBeVisible();
      // Upload stays disabled until the overwrite warning is acknowledged.
      await expect(ikoServerPage.importStartButton).toBeDisabled();

      await ikoServerPage.importOverwriteCheckbox.click();
      await expect(ikoServerPage.importStartButton).toBeEnabled();

      // Do not actually upload the dummy archive — just close the modal.
      await ikoServerPage.cancelImport();
    });

    test('15.12 — cancels the import', async () => {
      await ikoServerPage.openImportModal();
      await ikoServerPage.cancelImport();
      await expect(ikoServerPage.importModalHeading).toBeHidden();
    });
  });

  // ─── Failure scenarios ──────────────────────────────────────────────

  test.describe('Failure scenarios', () => {
    test.beforeAll(async () => {
      await ikoServerPage.goToIkoManagement();
    });

    test('cannot save a server with an empty title', async () => {
      await ikoServerPage.openConfigureModal();
      await expect(ikoServerPage.saveButton).toBeDisabled();
      await ikoServerPage.cancelButton.click();
      await expect(ikoServerPage.modalHeading).toBeHidden();
    });

    test('cannot save a server without an IKO server URL', async () => {
      await ikoServerPage.openConfigureModal();

      // Title alone is not enough — the IKO server URL is also required.
      await ikoServerPage.titleInput.fill(uniqueServerTitle('no-url'));
      await expect(ikoServerPage.saveButton).toBeDisabled();

      await ikoServerPage.cancelButton.click();
      await expect(ikoServerPage.modalHeading).toBeHidden();
    });

    test('save becomes disabled again after clearing the title', async () => {
      await ikoServerPage.openConfigureModal();
      // Title and URL are both required, so fill both to reach a valid form.
      await ikoServerPage.titleInput.fill('Temporary title');
      await ikoServerPage.serverUrlInput.fill(ikoServerConfig.serverUrl);
      await expect(ikoServerPage.saveButton).toBeEnabled();

      await ikoServerPage.titleInput.fill('');
      await expect(ikoServerPage.saveButton).toBeDisabled();

      await ikoServerPage.cancelButton.click();
      await expect(ikoServerPage.modalHeading).toBeHidden();
    });
  });
});
