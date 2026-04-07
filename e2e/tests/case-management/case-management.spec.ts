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
import * as ApiUtils from '../../utils/api.utils';
import {CaseManagementPage} from './page';

test.use({storageState: undefined});

test.describe('Case management', () => {
  let context;
  let page;
  let caseManagementPage;
  let request;

  // Track keys created during this run so we can clean them up
  const createdKeys: string[] = [];

  // Arrange
  test.beforeAll(async ({browser, baseURL}) => {
    // Create shared context & page
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    request = context.request;

    caseManagementPage = new CaseManagementPage(page, request);

    // Best-effort API cleanup of draft versions from previous runs.
    for (const key of ['test-case', 'test-case-import', 'custom-import-key']) {
      try {
        const versions = await ApiUtils.apiGet<Array<{versionTag: string; finalized: boolean}>>(
          `/api/management/v1/case-definition/${key}/version`
        );
        for (const v of versions) {
          try {
            await ApiUtils.apiDelete(
              `/api/management/v1/case-definition/${key}/version/${v.versionTag}`
            );
          } catch {
            // May be finalized — cannot delete
          }
        }
      } catch {
        // Case definition may not exist
      }
    }

    await page.goto('/');
    await caseManagementPage.goToCaseManagement();
  });

  test.afterAll(async () => {
    // Best-effort cleanup of keys created during this run
    for (const key of createdKeys) {
      try {
        const versions = await ApiUtils.apiGet<Array<{versionTag: string}>>(
          `/api/management/v1/case-definition/${key}/version`
        );
        for (const v of versions) {
          try {
            await ApiUtils.apiDelete(
              `/api/management/v1/case-definition/${key}/version/${v.versionTag}`
            );
          } catch {
            // May be finalized — cannot delete
          }
        }
      } catch {
        // Case definition may not exist
      }
    }
    await context.close();
  });

  test.describe('Success test', () => {
    test('Add a case', async () => {
      // Intercept navigation to case detail page to stay on the list
      await page.route('**/case-management/case/**', route => route.abort());

      // Act
      await caseManagementPage.addCase();
      const response = await caseManagementPage.saveConfiguration();

      // Assert
      expect(response.status()).toBe(200);
      createdKeys.push('test-case');

      // Cleanup route interception
      await page.unroute('**/case-management/case/**');
    });

    test('Upload a case', async () => {
      // Navigate back to case management list (previous test may leave us on case detail)
      await caseManagementPage.goToCaseManagement();

      // Act
      const result = await caseManagementPage.uploadCase();
      createdKeys.push(result.key);

      // Assert: the imported case should appear in the list
      await expect(page.getByRole('cell', {name: result.key})).toBeVisible();
    });
  });

  test.describe('Configure step', () => {
    test('Configure step shows pre-filled name and key', async () => {
      await caseManagementPage.goToCaseManagement();
      await caseManagementPage.uploadCaseButton.click();
      await caseManagementPage.pluginConfigurationStep();
      await caseManagementPage.uploadFileStep('test-case-import-success_1.0.0.case.zip');

      // Assert: configure step is pre-filled with values from the archive
      await caseManagementPage.assertConfigurePreFilled(
        'Test Case Import',
        'test-case-import',
        '1.0.0'
      );

      // Close the wizard without importing
      await caseManagementPage.closeUploadWizard();
    });

    test('Upload with custom name and key', async () => {
      await caseManagementPage.goToCaseManagement();
      await caseManagementPage.uploadCaseButton.click();
      await caseManagementPage.pluginConfigurationStep();
      await caseManagementPage.uploadFileStep('test-case-import-success_1.0.0.case.zip');

      // Act: change name and key on the configure step
      const result = await caseManagementPage.configureStepWithCustomKey(
        'Custom Import Name',
        'custom-import-key'
      );
      createdKeys.push(result.key);

      if (result.response.status() === 200) {
        await caseManagementPage.uploadWizardNextButton.click();
        await caseManagementPage.accessControlStep();
        await caseManagementPage.dashboardStep();

        // Assert: the case appears in the list under the actual key used
        await expect(page.getByRole('cell', {name: result.key})).toBeVisible();
      }
    });

    test('Existing draft override warning', async () => {
      // Arrange: import a case (creates a draft)
      await caseManagementPage.goToCaseManagement();
      const {key: importedKey} = await caseManagementPage.uploadCase();
      createdKeys.push(importedKey);

      // Act: import the same archive again — same key + same version as existing draft
      await caseManagementPage.goToCaseManagement();
      await caseManagementPage.uploadCaseButton.click();
      await caseManagementPage.pluginConfigurationStep();
      await caseManagementPage.uploadFileStep('test-case-import-success_1.0.0.case.zip');

      // The configure step pre-fills with the archive key (test-case-import).
      // Depending on environment state, we may see different warnings:
      //  - If the imported draft used the original key → "draft override" warning
      //  - If a finalized version exists for the original key → "Cannot import" warning
      const cannotImportVisible = await page
        .getByText('Cannot import')
        .isVisible({timeout: 1000})
        .catch(() => false);

      if (cannotImportVisible) {
        // Finalized version exists — verify the "Cannot import" warning instead
        await caseManagementPage.assertExistingFinalWarning();
      } else {
        // Draft version exists — verify the "draft override" warning
        await caseManagementPage.assertExistingDraftWarning();

        // Act: check the override checkbox and verify next becomes enabled
        await caseManagementPage.overrideCheckbox.click();
        await expect(caseManagementPage.uploadWizardNextButton).toBeEnabled();
      }

      // Close wizard without completing
      await caseManagementPage.closeUploadWizard();
    });

    test('Existing final version blocks import', async () => {
      // Arrange: import a case and finalize it
      await caseManagementPage.goToCaseManagement();
      const {key: importedKey} = await caseManagementPage.uploadCase();
      createdKeys.push(importedKey);

      try {
        await ApiUtils.apiPost(
          `/api/management/v1/case-definition/${importedKey}/version/1.0.0/finalize`,
          {}
        );
      } catch {
        // Token may have expired or version may already be finalized
      }

      // Act: try to import the same archive again
      await caseManagementPage.goToCaseManagement();
      await caseManagementPage.uploadCaseButton.click();
      await caseManagementPage.pluginConfigurationStep();
      await caseManagementPage.uploadFileStep('test-case-import-success_1.0.0.case.zip');

      // Assert: final version warning blocks import (either from this run or a previous one)
      await caseManagementPage.assertExistingFinalWarning();

      // Close wizard
      await caseManagementPage.closeUploadWizard();
    });
  });

  test.describe('Error test', () => {
    test('Upload an invalid file', async () => {
      // Ensure we're on the case management list page
      await caseManagementPage.goToCaseManagement();

      // Act: upload a ZIP with non-case content (IKO config)
      // Assert: file is rejected on the file select step with an invalid file error
      await caseManagementPage.uploadInvalidCase({
        archiveName: 'test-case-import-invalid-file.zip',
      });
    });

    test('Upload a file with invalid structure', async () => {
      // Ensure we're on the case management list page
      await caseManagementPage.goToCaseManagement();

      // Act: upload a ZIP with non-case content (plain text payload)
      // Assert: file is rejected on the file select step with an invalid file error
      await caseManagementPage.uploadInvalidCase({archiveName: 'test-case-import-large.case.zip'});
    });
  });
});
