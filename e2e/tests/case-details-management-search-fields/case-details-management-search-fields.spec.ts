import {expect, test} from '@playwright/test';

import {JsonEditor} from '../../shared/json-editor/json-editor.utils';
import {clearMonacoEditor, pasteToMonacoEditor} from '../../utils/monaco.utils';
import {
  CASE_VERSIONS,
  SEARCH_FIELDS,
  SEARCH_FIELDS_2,
  UI_SEARCH_FIELD_1,
  UI_SEARCH_FIELD_2,
} from './search-field-config';
import {CaseDetailsManagementSearchFieldsPage} from './page';

test.use({storageState: undefined});

test.describe('Case management - Search Fields', () => {
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

    testPage = new CaseDetailsManagementSearchFieldsPage(page, request);

    await page.goto('/');
    await testPage.goToCaseDetailsManagement('bezwaar');
    await testPage.switchCaseVersionViaDropdown(CASE_VERSIONS.DRAFT);
  });

  test.describe('Success tests', () => {
    test.describe('Search fields', () => {
      test.beforeAll(async () => {
        await testPage.searchFieldsTab.click();
      });

      test('Check search fields page is loaded', async () => {
        // Assert
        await expect(testPage.searchFieldsList).toBeVisible();
      });

      test.describe('JSON Editor', () => {
        let jsonEditor;
        test.beforeAll(async () => {
          jsonEditor = new JsonEditor(page);
        });

        test.beforeEach(async () => {
          // Arrange
          await testPage.switchViewButton.click();
        });

        test('Change view', async () => {
          // Assert
          await expect(testPage.searchFieldJSONEditor).toBeVisible();

          await testPage.switchViewButton.click();
        });

        test('Edit search fields', async () => {
          // Act
          await jsonEditor.saveChanges(SEARCH_FIELDS);
          await testPage.switchViewButton.click();

          // Assert
          await testPage.checkSearchFieldsExisting(SEARCH_FIELDS.map(f => f.key));
        });

        test('Save modal close button', async () => {
          // Assert
          await jsonEditor.assertCloseSaveKeepEditing(SEARCH_FIELDS);

          await testPage.switchViewButton.click();
        });

        test('Discard edit search fields', async () => {
          await jsonEditor.discardChanges();
          await testPage.switchViewButton.click();

          // Assert
          await testPage.checkSearchFieldsExisting(SEARCH_FIELDS.map(f => f.key));
        });

        test('Keep editing changes', async () => {
          // Assert
          await jsonEditor.assertKeepEditingChanges(SEARCH_FIELDS);
          await testPage.switchViewButton.click();
        });

        test('Save changes on cancel', async () => {
          // Act
          await jsonEditor.saveChangesWithCancel(SEARCH_FIELDS_2);
          await testPage.switchViewButton.click();

          // Assert
          await testPage.checkSearchFieldsExisting(SEARCH_FIELDS_2.map(f => f.key));
          await testPage.switchViewButton.click();
        });

        test('Save button disabled for invalid JSON', async () => {
          // Arrange
          await testPage.switchViewButton.click();

          // Act
          await jsonEditor.jsonEditorEditButton.click();
          await clearMonacoEditor(page);
          await pasteToMonacoEditor(page, '{invalid json content!!!');

          // Assert
          await expect(jsonEditor.jsonEditorSaveButton).toBeDisabled();

          // Cleanup
          await jsonEditor.jsonEditorCancelButton.click();
          await jsonEditor.jsonEditorCancelModalConfirmButton.click();
          await testPage.switchViewButton.click();
        });
      });

      test.describe('UI Search Field Management', () => {
        test('Create a search field via UI', async () => {
          // Act
          await testPage.createSearchField(UI_SEARCH_FIELD_1);

          // Assert
          await testPage.assertSearchFieldExists(UI_SEARCH_FIELD_1.key);
        });

        test('Create a second search field via UI', async () => {
          // Act
          await testPage.createSearchField(UI_SEARCH_FIELD_2);

          // Assert
          await testPage.assertSearchFieldExists(UI_SEARCH_FIELD_2.key);
        });

        test('Edit a search field title via UI', async () => {
          // Act
          await testPage.editSearchFieldTitle(UI_SEARCH_FIELD_1.key, 'Updated Title');

          // Assert
          await expect(page.locator('td[title="Updated Title"]').first()).toBeVisible();
        });

        test('Cancel creating a search field', async () => {
          // Act
          await testPage.addSearchFieldButton.click();
          await testPage.cancelButton.click();

          // Assert
          await expect(testPage.addSearchFieldButton).toBeVisible();
        });

        test('Save button disabled when form is invalid', async () => {
          // Act
          await testPage.addSearchFieldButton.click();

          // Assert
          await testPage.assertSaveButtonDisabled();

          // Cleanup
          await testPage.cancelButton.click();
        });

        test('Duplicate key shows validation error', async () => {
          // Arrange
          await testPage.addSearchFieldButton.click();
          await testPage.keyInput.fill(UI_SEARCH_FIELD_1.key);

          // Assert
          await testPage.assertSaveButtonDisabled();

          // Cleanup
          await testPage.cancelButton.click();
        });

        test('Delete a search field via UI', async () => {
          // Act
          await testPage.deleteSearchField(UI_SEARCH_FIELD_1.key);

          // Assert
          await testPage.assertSearchFieldNotExists(UI_SEARCH_FIELD_1.key);
        });

        test('Delete second search field via UI', async () => {
          // Act
          await testPage.deleteSearchField(UI_SEARCH_FIELD_2.key);

          // Assert
          await testPage.assertSearchFieldNotExists(UI_SEARCH_FIELD_2.key);
        });
      });
    });
  });
});
