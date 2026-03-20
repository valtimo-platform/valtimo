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
import {expectNotificationMessage} from '../../utils/ui.utils';
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

  test.describe('Error test', () => {
    test('Upload an invalid file', async () => {
      // Ensure we're on the case management list page
      await caseManagementPage.goToCaseManagement();

      // Act: upload a ZIP with non-case content (IKO config)
      await caseManagementPage.uploadCase({
        archiveName: 'test-case-import-invalid-file.zip',
      });

      // Assert: server returns an error notification
      await expectNotificationMessage(page, 'entity-not-found');
    });

    test('Upload a file with invalid structure', async () => {
      // Ensure we're on the case management list page
      await caseManagementPage.goToCaseManagement();

      // Act: upload a ZIP with non-case content (plain text payload)
      await caseManagementPage.uploadCase({archiveName: 'test-case-import-large.case.zip'});

      // Assert: server returns an error notification
      await expectNotificationMessage(page, 'entity-not-found');
    });
  });
});
