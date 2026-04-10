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

  // Track keys created
  const createdKeys: string[] = [];

  // Arrange
  test.beforeAll(async ({browser, baseURL}) => {
    // Create shared context & page
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    request = context.request;

    caseManagementPage = new CaseManagementPage(page, request);

    // Cleanup of draft versions
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
    //Cleanup of keys
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
      // Use a unique name
      const uniqueSuffix = Date.now().toString(36);
      const caseName = `Test Case ${uniqueSuffix}`;

      // Intercept navigation to case detail page to stay on the list
      await page.route('**/case-management/case/**', route => route.abort());

      // Act
      const key = await caseManagementPage.addCase(caseName);
      const response = await caseManagementPage.saveConfiguration();

      // Assert
      expect(response.status()).toBe(200);
      createdKeys.push(key);

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
        await expect(page.getByRole('cell', {name: result.key, exact: true})).toBeVisible();
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
        // Must click the inner label, not the cds-checkbox host, for checkedChange to fire
        await caseManagementPage.overrideCheckbox.locator('label').click();
        await expect(caseManagementPage.uploadWizardNextButton).toBeEnabled();
      }

      // Close wizard without completing
      await caseManagementPage.closeUploadWizard();
    });

    test('Existing final version blocks import', async () => {
      // This test does upload + finalize + second upload — needs extra time
      test.slow();

      // Arrange: import a case with a unique key
      const uniqueKey = `e2e-final-test-${Date.now().toString(36)}`;
      await caseManagementPage.goToCaseManagement();
      await caseManagementPage.uploadCaseButton.click();
      await caseManagementPage.pluginConfigurationStep();
      await caseManagementPage.uploadFileStep('test-case-import-success_1.0.0.case.zip');
      const firstImport = await caseManagementPage.configureStepWithCustomKey(
        'E2e Final Version Test',
        uniqueKey
      );
      createdKeys.push(firstImport.key);

      if (firstImport.response.status() === 200) {
        await caseManagementPage.uploadWizardNextButton.click();
        await caseManagementPage.accessControlStep();
        await caseManagementPage.dashboardStep();
      }

      // Finalize the version
      await ApiUtils.apiPost(
        `/api/management/v1/case-definition/${firstImport.key}/version/1.0.0/finalize`,
        {}
      );

      // Verify finalization succeeded before proceeding
      const versions = await ApiUtils.apiGet<Array<{versionTag: string; final: boolean}>>(
        `/api/management/v1/case-definition/${firstImport.key}/version`
      );
      const finalVersion = versions.find(v => v.versionTag === '1.0.0');
      expect(finalVersion?.final).toBeTruthy();

      // Act: try to import the same archive again, setting the key to the finalized one
      await caseManagementPage.goToCaseManagement();
      await caseManagementPage.uploadCaseButton.click();
      await caseManagementPage.pluginConfigurationStep();
      await caseManagementPage.uploadFileStep('test-case-import-success_1.0.0.case.zip');

      // Wait for the configure step to render, then set the key to the finalized one
      await expect(caseManagementPage.configureNameInput).toBeVisible();
      await expect(caseManagementPage.configureKeyInput).toBeVisible();

      const validationPromise = caseManagementPage.waitForKeyValidationResponse();
      await caseManagementPage.changeConfigureKey(firstImport.key);
      await validationPromise;

      // Wait for the UI to reflect the validation result
      await caseManagementPage.awaitConfigureValidation();

      // Assert: final version warning blocks import
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
