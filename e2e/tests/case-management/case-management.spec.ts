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

import {test} from '@playwright/test';
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
      // Act
      await page.route('**/case-management/case/**', async route => {
        await caseManagementPage.addCase();
        await caseManagementPage.saveConfiguration();
        route.abort();

        // Assert
        await caseManagementPage.assertCaseExists('Test case');
      });
    });

    test('Upload a case', async () => {
      // Act
      await page.route('**/case-management/case/**', async route => {
        await caseManagementPage.uploadCase();
        await caseManagementPage.saveConfiguration();
        await caseManagementPage.assertCaseUploaded();

        // Assert
        await caseManagementPage.assertCaseExists('Test case');
        route.abort();
      });
    });

    test('Cleanup test file', async () => {
      try {
        await ApiUtils.apiDelete(
          `/api/management/v1/case-definition/${caseConfiguration.caseKey}/version/${caseConfiguration.caseVersion}`
        );
      } catch {
        // Case may not exist if upload tests didn't create it
      }
    });
  });

  test.describe('Error test', () => {
    // test('Upload a case with the same version', async () => {
    //   // Act - first upload (should succeed)
    //   await caseManagementPage.uploadCase();
    //
    //   // Navigate back
    //   await caseManagementPage.goToCaseManagement();
    //
    //   // Restart upload (same version - should fail)
    //   await caseManagementPage.uploadCase();
    //
    //   // Assert
    //   await expectNotificationMessage(page, 'This version already exists for this definition', {
    //     exact: true,
    //   });
    // });

    test('Upload an invalid file', async () => {
      // Act
      await caseManagementPage.uploadCase({
        archiveName: 'test-case-import-invalid-file.zip',
      });

      // Assert
      await expectNotificationMessage(page, 'entity-not-found');
    });

    // test('Upload a file that exceeds the maximum size', async () => {
    //   // Act
    //   await caseManagementPage.uploadCase();
    //
    //   // Assert
    //   await expectNotificationMessage(page, 'Maximum upload size exceeded');
    // });
  });
});
