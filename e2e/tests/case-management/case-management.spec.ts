import {test} from '@playwright/test';
import {CaseManagementPage} from './page';
import * as ApiUtils from '../../utils/api.utils';
import {caseConfiguration} from './case-config';
import {expectErrorMessage} from '../../utils/ui.utils';

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

  test.afterAll(async () => {
    await ApiUtils.apiDelete(
      `/api/management/v1/case-definition/${caseConfiguration.caseKey}/version/${caseConfiguration.caseVersion}`
    );
  });

  test.describe('Success test', () => {
    test('Add a case', async () => {
      // Act
      await caseManagementPage.addCase();
      await caseManagementPage.saveConfiguration();

      // Assert
      await caseManagementPage.assertCaseExists('Test case');
    });

    test('Upload a case', async () => {
      // Act
      await caseManagementPage.uploadCase();
      await caseManagementPage.saveConfiguration();
      await caseManagementPage.assertCaseUploaded();

      // Assert
      await caseManagementPage.assertCaseExists('Test case');
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
      await expectErrorMessage(
        page,
        'This version already exists for this definition',
        {exact: true}
      );

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
      await expectErrorMessage(
          page,
          'entity-not-found',
          {exact: true}
      );

      await caseManagementPage.createCancelButton.click();
    });

    test('Upload a file that exceeds the maximum size', async () => {
      // Act
      await caseManagementPage.uploadCase();
      await caseManagementPage.saveConfiguration();
      await caseManagementPage.assertCaseUploaded();

      // Assert
      await expectErrorMessage(
          page,
          'Maximum upload size exceeded',
          {exact: true}
      );

      await caseManagementPage.createCancelButton.click();
    });
  });
});
