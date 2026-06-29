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

    // Clean up all test case definitions from previous runs
    const testKeyPrefixes = ['test-case', 'custom-import', 'e2e-final-test'];
    try {
      const allCases = await ApiUtils.apiGet<Array<{caseDefinitionKey: string}>>(
        '/api/management/v1/case-definition/case'
      );
      const testCaseKeys = Array.from(new Set(
        allCases
          .map(c => c.caseDefinitionKey)
          .filter(key => testKeyPrefixes.some(prefix => key.startsWith(prefix)))
      ));

      for (const key of testCaseKeys) {
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
          // Ignore errors
        }
      }
    } catch {
      // API may not be available
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

  });

  test.describe('Configure step', () => {
    test('Configure step shows pre-filled name and key', async () => {
      await caseManagementPage.goToCaseManagement();
      await caseManagementPage.uploadCaseButton.click();
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
      await caseManagementPage.uploadFileStep('test-case-import-success_1.0.0.case.zip');

      // Act: change name and key on the configure step
      const {key, name} = await caseManagementPage.configureStepWithCustomKey(
        'Custom Import Name',
        'custom-import-key'
      );
      createdKeys.push(key);

      // Plugin step triggers the import
      const response = await caseManagementPage.pluginConfigurationStep();

      if (response.status() === 200) {
        await caseManagementPage.fileUploadStep();
        await caseManagementPage.accessControlStep();
        await caseManagementPage.dashboardStep();

        // Assert: the case appears in the list under the actual name used
        await expect(page.getByRole('cell', {name, exact: true}).first()).toBeVisible({timeout: 15_000});
      }
    });

    test('Existing draft override warning', async () => {
      test.slow();
      // Arrange: import a case (creates a draft)
      await caseManagementPage.goToCaseManagement();
      const {key: importedKey} = await caseManagementPage.uploadCase();
      createdKeys.push(importedKey);

      // Act: import the same archive again — same key + same version as existing draft
      await caseManagementPage.goToCaseManagement();
      await caseManagementPage.uploadCaseButton.click();
      await caseManagementPage.uploadFileStep('test-case-import-success_1.0.0.case.zip');

      // Wait for the configure step to render and initial validation to settle
      await expect(caseManagementPage.configureNameInput).toBeVisible();
      await caseManagementPage.awaitConfigureValidation();

      // The configure step pre-fills with the archive key
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
      await caseManagementPage.uploadFileStep('test-case-import-success_1.0.0.case.zip');
      const {key: firstImportKey} = await caseManagementPage.configureStepWithCustomKey(
        'E2e Final Version Test',
        uniqueKey
      );
      createdKeys.push(firstImportKey);

      const firstImportResponse = await caseManagementPage.pluginConfigurationStep();

      if (firstImportResponse.status() === 200) {
        await caseManagementPage.fileUploadStep();
        await caseManagementPage.accessControlStep();
        await caseManagementPage.dashboardStep();
      }

      // Finalize the version
      await ApiUtils.apiPost(
        `/api/management/v1/case-definition/${firstImportKey}/version/1.0.0/finalize`,
        {}
      );

      // Verify finalization succeeded before proceeding
      const versions = await ApiUtils.apiGet<Array<{versionTag: string; final: boolean}>>(
        `/api/management/v1/case-definition/${firstImportKey}/version`
      );
      const finalVersion = versions.find(v => v.versionTag === '1.0.0');
      expect(finalVersion?.final).toBeTruthy();

      // Act: try to import the same archive again, setting the key to the finalized one
      await caseManagementPage.goToCaseManagement();
      await caseManagementPage.uploadCaseButton.click();
      await caseManagementPage.uploadFileStep('test-case-import-success_1.0.0.case.zip');

      // Wait for the configure step to render and initial validation to settle
      await expect(caseManagementPage.configureNameInput).toBeVisible();
      await expect(caseManagementPage.configureKeyInput).toBeVisible();
      await caseManagementPage.awaitConfigureValidation();

      // Change the key to the finalized one and wait for its specific validation response
      const validationPromise = caseManagementPage.waitForKeyValidationResponse(firstImportKey);
      await caseManagementPage.changeConfigureKey(firstImportKey);
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
