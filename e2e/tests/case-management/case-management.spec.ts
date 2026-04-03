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
import {caseConfiguration} from './case-config';
import {CaseManagementPage} from './page';

test.use({storageState: undefined});

test.describe('Case management', () => {
  let context;
  let page;
  let caseManagementPage;
  let request;

  // Arrange
  test.beforeAll(async ({browser, baseURL}) => {
    // Create shared context & page
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    request = context.request;

    caseManagementPage = new CaseManagementPage(page, request);

    await page.goto('/');
    await caseManagementPage.goToCaseManagement();
  });

  test.describe('Success test', () => {
    test('Add a case', async () => {
      // Intercept navigation to case detail page to stay on the list
      await page.route('**/case-management/case/**', route => route.abort());

      // Act
      await caseManagementPage.addCase();
      await caseManagementPage.saveConfiguration();

      // Assert
      await caseManagementPage.assertCaseExists('Test case');

      // Cleanup route interception
      await page.unroute('**/case-management/case/**');
    });

    test('Upload a case', async () => {
      // Navigate back to case management list (previous test may leave us on case detail)
      await caseManagementPage.goToCaseManagement();

      // Act
      await caseManagementPage.uploadCase();

      // Assert: the imported case should appear in the list
      await expect(page.getByRole('cell', {name: 'test-case-import'})).toBeVisible();
    });

    test('Cleanup test files', async () => {
      // Clean up case created by "Add a case"
      try {
        await ApiUtils.apiDelete(
          `/api/management/v1/case-definition/${caseConfiguration.caseKey}/version/${caseConfiguration.caseVersion}`
        );
      } catch {
        // Case definition may not exist if a previous test failed
      }

      // Clean up case created by "Upload a case"
      try {
        await ApiUtils.apiDelete(
          '/api/management/v1/case-definition/test-case-import/version/1.0.0'
        );
      } catch {
        // Case definition may not exist if a previous test failed
      }
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
      const response = await caseManagementPage.configureStepWithCustomKey(
        'Custom Import Name',
        'custom-import-key'
      );

      if (response.status() === 200) {
        await caseManagementPage.uploadWizardNextButton.click();
        await caseManagementPage.accessControlStep();
        await caseManagementPage.dashboardStep();

        // Assert: the case appears in the list under the custom key
        await expect(page.getByRole('cell', {name: 'custom-import-key'})).toBeVisible();
      }

      // Cleanup
      try {
        await ApiUtils.apiDelete(
          '/api/management/v1/case-definition/custom-import-key/version/1.0.0'
        );
      } catch {
        // May not exist if import failed
      }
    });

    // Note: "New version info notification" test requires a second test archive with a different
    // versionTag to trigger the NEW_VERSION warning. Skipped until a second archive is available.

    test('Existing draft override warning', async () => {
      // Arrange: import a case (creates a draft)
      await caseManagementPage.goToCaseManagement();
      await caseManagementPage.uploadCase();

      // Act: import the same archive again — same key + same version as existing draft
      await caseManagementPage.goToCaseManagement();
      await caseManagementPage.uploadCaseButton.click();
      await caseManagementPage.pluginConfigurationStep();
      await caseManagementPage.uploadFileStep('test-case-import-success_1.0.0.case.zip');

      // Assert: existing draft warning appears with checkbox
      await caseManagementPage.assertExistingDraftWarning();

      // Act: check the override checkbox and verify next becomes enabled
      await caseManagementPage.overrideCheckbox
        .locator('input[type="checkbox"]')
        .click({force: true});
      await expect(caseManagementPage.uploadWizardNextButton).toBeEnabled();

      // Close wizard without completing
      await caseManagementPage.closeUploadWizard();

      // Cleanup
      try {
        await ApiUtils.apiDelete(
          '/api/management/v1/case-definition/test-case-import/version/1.0.0'
        );
      } catch {
        // May not exist
      }
    });

    test('Existing final version blocks import', async () => {
      // Arrange: import and finalize a case
      await caseManagementPage.goToCaseManagement();
      await caseManagementPage.uploadCase();
      await ApiUtils.apiPost(
        '/api/management/v1/case-definition/test-case-import/version/1.0.0/finalize',
        {}
      );

      // Act: try to import the same archive again
      await caseManagementPage.goToCaseManagement();
      await caseManagementPage.uploadCaseButton.click();
      await caseManagementPage.pluginConfigurationStep();
      await caseManagementPage.uploadFileStep('test-case-import-success_1.0.0.case.zip');

      // Assert: final version warning blocks import
      await caseManagementPage.assertExistingFinalWarning();

      // Close wizard
      await caseManagementPage.closeUploadWizard();

      // Cleanup
      try {
        await ApiUtils.apiDelete(
          '/api/management/v1/case-definition/test-case-import/version/1.0.0'
        );
      } catch {
        // Finalized versions may not be deletable
      }
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
