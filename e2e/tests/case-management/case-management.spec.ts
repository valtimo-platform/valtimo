import {test} from '@playwright/test';
import {CaseManagementPage} from './page';
import * as ApiUtils from '../../utils/api.utils';
import {caseConfiguration} from './case-config';

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
      //Navigate back
      //Restart upload

      // Assert
      //Use expectErrorMessage method from ui.utils.ts
      // });
    });
  });
});
