import {expect, test} from '@playwright/test';
import {CaseDetailsManagementPage} from './page';
import * as ApiUtils from '../../utils/api.utils';
import {caseConfiguration} from './case-config';
import {expectErrorMessage} from '../../utils/ui.utils';
import {CaseManagementUtils} from '../../utils/case.utils';

test.use({storageState: undefined});

test.describe('Case management', () => {
  let context;
  let page;
  let caseDetailsManagementPage;
  let request;

  // Arrange
  test.beforeAll(async ({browser, baseURL}) => {
    // Create shared context & page
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    request = context.request;

    caseDetailsManagementPage = new CaseDetailsManagementPage(page, request);

    await page.goto('/');
    await caseDetailsManagementPage.goToCaseDetailsManagement('bezwaar');
  });

  test.describe('Success test', () => {
    test('Switch version via dropdown', async () => {
      // Act
      await caseDetailsManagementPage.switchCaseVersionViaDropdown('1.0.0');

      // Assert
      expect(page).toHaveURL('/case-management/case/bezwaar/version/1.0.0/general');
    });

    test('Switch version via list', async () => {
      // Act
      await caseDetailsManagementPage.switchCaseVersionViaList('1.0.0');

      // Assert
      expect(page).toHaveURL('/case-management/case/bezwaar/version/1.0.0/general');
    });

    test('Export case definition', async () => {
      //Act
      await caseDetailsManagementPage.switchCaseVersionViaDropdown('1.0.0');
      const download = await caseDetailsManagementPage.exportCaseDefinition();

      //Assert
      expect(download.suggestedFilename()).toContain('1.0.0');
    });

    test('Set active version', async () => {
      //Act
      await caseDetailsManagementPage.makeVersionGlobal('1.0.0');

      //Assert
      await expect(
          caseDetailsManagementPage.versionSelectDropdown.locator('cds-tag', { hasText: 'Globally active' })
      ).toBeVisible();    });
  });
});