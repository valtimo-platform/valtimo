import {expect, test} from '@playwright/test';

import {JsonEditor} from '../../shared/json-editor/json-editor.utils';
import {CASE_VERSIONS, LIST_COLUMNS, LIST_COLUMNS_2} from './json-list-column-config';
import {CaseDetailsManagementCaseListPage} from './page';

test.use({storageState: undefined});

test.describe('Case management', () => {
  let context;
  let page;
  let testPage;
  let request;

  // Arrange
  test.beforeAll(async ({browser, baseURL}) => {
    // Create shared context & page
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    request = context.request;

    testPage = new CaseDetailsManagementCaseListPage(page, request);

    await page.goto('/');
    await testPage.goToCaseDetailsManagementCaseList('bezwaar');
    await testPage.switchCaseVersionViaDropdown(CASE_VERSIONS.DRAFT);
  });

  test.describe('Success test', () => {
    test.describe('List columns', () => {
      test.beforeAll(async () => {
        await testPage.listColumnsTab.click();
      });

      test('Check list column page is loaded', async () => {
        // Assert
        await expect(testPage.caseListColumnsList).toBeTruthy();
      });

      test.describe('JSON Editor', () => {
        let jsonEditor;
        test.beforeAll(async () => {
          jsonEditor = new JsonEditor(page);
        });

        test.beforeEach(async () => {
          //Arrange
          await testPage.switchViewButton.click();
        });

        test('Change view', async () => {
          //Assert
          await expect(testPage.listColumnJSONEditor).toBeVisible();

          await testPage.switchViewButton.click();
        });

        test('Edit columns', async () => {
          //Act
          await jsonEditor.saveChanges(LIST_COLUMNS);
          await testPage.switchViewButton.click();

          //Assert
          await testPage.checkColumnsExisting(LIST_COLUMNS.map(col => col.key));
        });

        test('Save modal close button', async () => {
          //Assert
          await jsonEditor.assertCloseSaveKeepEditing(LIST_COLUMNS);

          await testPage.switchViewButton.click();
        });

        test('Discard edit columns', async () => {
          await jsonEditor.discardChanges();
          await testPage.switchViewButton.click();

          //Assert
          await testPage.checkColumnsExisting(LIST_COLUMNS.map(col => col.key));
        });

        test('Keep editing changes', async () => {
          //Assert
          await jsonEditor.assertKeepEditingChanges(LIST_COLUMNS);
          await testPage.switchViewButton.click();
        });

        test('Save changes on cancel', async () => {
          //Act
          await jsonEditor.saveChangesWithCancel(LIST_COLUMNS_2);
          await testPage.switchViewButton.click();

          //Assert
          await testPage.checkColumnsExisting(LIST_COLUMNS_2.map(col => col.key));
          await testPage.switchViewButton.click();
        });
      });
    });
  });
});
