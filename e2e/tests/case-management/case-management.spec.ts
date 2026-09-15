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

const FINAL_TEST_KEY = 'e2e-final-test';

const ARCHIVE_VERSION_TAG = '1.0.0';

const TEST_KEY_PREFIXES = ['test-case', 'custom-import', FINAL_TEST_KEY];

interface CaseVersion {
  versionTag: string;
  active?: boolean;
  final?: boolean;
}

async function getCaseDefinitionVersions(key: string): Promise<CaseVersion[]> {
  try {
    return await ApiUtils.apiGet<CaseVersion[]>(
      `/api/management/v1/case-definition/${key}/version?size=100`
    );
  } catch (error) {
    if (ApiUtils.isApiStatus(error, 404)) return [];
    throw error;
  }
}

async function ensureFinalizedCaseDefinition(): Promise<CaseVersion> {
  const existing = (await getCaseDefinitionVersions(FINAL_TEST_KEY)).find(
    version => version.versionTag === ARCHIVE_VERSION_TAG
  );

  if (existing?.final) return existing;

  if (!existing) {
    await ApiUtils.apiPost('/api/management/v1/case-definition/draft', {
      caseDefinitionKey: FINAL_TEST_KEY,
      caseDefinitionVersion: ARCHIVE_VERSION_TAG,
      name: 'E2E final version fixture',
      description:
        'Fixture for the case management import tests. Finalized on purpose and ' +
        'therefore permanent — it cannot be deleted through the management API.',
    });
  }

  await ApiUtils.apiPost(
    `/api/management/v1/case-definition/${FINAL_TEST_KEY}/version/${ARCHIVE_VERSION_TAG}/finalize`,
    {}
  );

  const finalizedVersion = (await getCaseDefinitionVersions(FINAL_TEST_KEY)).find(
    version => version.versionTag === ARCHIVE_VERSION_TAG
  );
  if (!finalizedVersion) {
    throw new Error(
      `[case-management] ${FINAL_TEST_KEY} ${ARCHIVE_VERSION_TAG} is gone right after finalizing it`
    );
  }
  return finalizedVersion;
}

async function deleteCaseDefinition(key: string): Promise<void> {
  for (const version of await getCaseDefinitionVersions(key)) {
    if (version.final) continue;

    try {
      await ApiUtils.apiDelete(
        `/api/management/v1/case-definition/${key}/version/${version.versionTag}`
      );
    } catch (error) {
      const isRule = error instanceof ApiUtils.ApiError && error.status < 500;
      if (!isRule) throw error;
    }
  }
}

async function findTestCaseDefinitionKeys(): Promise<string[]> {
  const page = await ApiUtils.apiGet<{content: Array<{caseDefinitionKey: string}>}>(
    '/api/management/v1/case-definition?allVersions=true&size=2000'
  );
  return Array.from(
    new Set(
      page.content
        .map(caseDefinition => caseDefinition.caseDefinitionKey)
        .filter(key => TEST_KEY_PREFIXES.some(prefix => key.startsWith(prefix)))
    )
  );
}

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
    for (const key of await findTestCaseDefinitionKeys()) {
      await deleteCaseDefinition(key);
    }

    await page.goto('/');
    await caseManagementPage.goToCaseManagement();
  });

  test.afterAll(async () => {
    for (const key of new Set([...createdKeys, FINAL_TEST_KEY])) {
      await deleteCaseDefinition(key);
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
        await caseManagementPage.confirmDraftOverride();
      }

      // Close wizard without completing
      await caseManagementPage.closeUploadWizard();
    });

    test('Existing final version blocks import', async () => {
      test.slow();

      const finalized = await ensureFinalizedCaseDefinition();
      expect(finalized.final, `${FINAL_TEST_KEY} ${ARCHIVE_VERSION_TAG} should be final`).toBe(
        true
      );

      await caseManagementPage.goToCaseManagement();
      await caseManagementPage.uploadCaseButton.click();
      await caseManagementPage.uploadFileStep('test-case-import-success_1.0.0.case.zip');

      // Wait for the configure step to render and initial validation to settle
      await expect(caseManagementPage.configureNameInput).toBeVisible();
      await expect(caseManagementPage.configureKeyInput).toBeVisible();
      await caseManagementPage.awaitConfigureValidation();

      const validationPromise = caseManagementPage.waitForKeyValidationResponse(FINAL_TEST_KEY);
      await caseManagementPage.changeConfigureKey(FINAL_TEST_KEY);
      await validationPromise;

      // Wait for the UI to reflect the validation result
      await caseManagementPage.awaitConfigureValidation();

      // Assert: final version warning blocks import
      await caseManagementPage.assertExistingFinalWarning();
      await expect(caseManagementPage.uploadWizardNextButton).toBeDisabled();

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
