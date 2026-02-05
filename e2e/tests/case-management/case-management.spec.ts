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
      await ApiUtils.apiDelete(
        `/api/management/v1/case-definition/${caseConfiguration.caseKey}/version/${caseConfiguration.caseVersion}`
      );
    });
  });

  test.describe('Error test', () => {
    test('Upload a case with the same version', async () => {
      // Act
      await caseManagementPage.uploadCase();
      await caseManagementPage.saveConfiguration();
      await caseManagementPage.assertCaseUploaded();

      // Navigate back
      await caseManagementPage.goToCaseManagement();

      // Restart upload
      await caseManagementPage.uploadCase();
      await caseManagementPage.saveConfiguration();

      // Assert
      await expectNotificationMessage(page, 'This version already exists for this definition', {
        exact: true,
      });

      await caseManagementPage.createCancelButton.click();
    });

    test('Upload an invalid file', async () => {
      // Act
      await caseManagementPage.uploadCase({
        archiveName: 'test-case-import-invalid-file.zip',
      });
      await caseManagementPage.saveConfiguration();
      await caseManagementPage.assertCaseUploaded();

      // Assert
      await expectNotificationMessage(page, 'entity-not-found', {exact: true});

      await caseManagementPage.createCancelButton.click();
    });

    test('Upload a file that exceeds the maximum size', async () => {
      // Act
      await caseManagementPage.uploadCase();
      await caseManagementPage.saveConfiguration();
      await caseManagementPage.assertCaseUploaded();

      // Assert
      await expectNotificationMessage(page, 'Maximum upload size exceeded', {exact: true});

      await caseManagementPage.createCancelButton.click();
    });
  });
});
