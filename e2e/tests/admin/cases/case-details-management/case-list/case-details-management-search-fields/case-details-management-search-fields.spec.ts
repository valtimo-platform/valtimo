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

import {JsonEditor} from '../../../../../../shared/json-editor/json-editor.utils';
import {clearMonacoEditor, pasteToMonacoEditor} from '../../../../../../utils/monaco.utils';
import {ensureDraftVersionSelected} from '../../../../../../utils/version.utils';
import {
  SEARCH_FIELDS,
  SEARCH_FIELDS_2,
  UI_SEARCH_FIELD_1,
  UI_SEARCH_FIELD_2,
  UI_SEARCH_FIELD_3,
  UI_SEARCH_FIELD_BOOLEAN,
  UI_SEARCH_FIELD_DATETIME,
  UI_SEARCH_FIELD_NUMBER,
  UI_SEARCH_FIELD_NUMBER_RANGE,
  UI_SEARCH_FIELD_TEXT_EXACT,
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
    await ensureDraftVersionSelected(page);
  });

  test.describe('Success tests', () => {
    test.describe('6.71, 6.72 — Search fields', () => {
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
          // Arrange – ensure JSON view is active (idempotent)
          if (!(await testPage.searchFieldJSONEditor.isVisible())) {
            await testPage.switchViewButton.click();
          }
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
        });

        test('Save button disabled for invalid JSON', async () => {
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

        test('Cancel delete keeps the search field', async () => {
          // Arrange
          await testPage.createSearchField(UI_SEARCH_FIELD_3);
          await testPage.assertSearchFieldExists(UI_SEARCH_FIELD_3.key);

          // Act
          await testPage.cancelDeleteSearchField(UI_SEARCH_FIELD_3.key);

          // Assert
          await testPage.assertSearchFieldExists(UI_SEARCH_FIELD_3.key);

          // Cleanup
          await testPage.deleteSearchField(UI_SEARCH_FIELD_3.key);
          await testPage.assertSearchFieldNotExists(UI_SEARCH_FIELD_3.key);
        });

        test('Save button enabled when form is valid', async () => {
          // Act
          await testPage.addSearchFieldButton.click();
          await testPage.keyInput.fill('uiTestValid');
          await testPage.valuePathSelectorToggle.click();
          await testPage.valuePathSelectorInput.fill('case:createdBy');
          await testPage.selectDropdownItem(testPage.dataTypeDropdown, 'Text');
          await testPage.selectDropdownItem(testPage.fieldTypeDropdown, 'Single');
          await testPage.selectDropdownItem(testPage.matchTypeDropdown, 'Contains');

          // Assert
          await testPage.assertSaveButtonEnabled();

          // Cleanup
          await testPage.cancelButton.click();
        });
      });

      test.describe('Data Types and Field Types', () => {
        test('Create and delete a number search field', async () => {
          // Act
          await testPage.createSearchField(UI_SEARCH_FIELD_NUMBER);

          // Assert
          await testPage.assertSearchFieldExists(UI_SEARCH_FIELD_NUMBER.key);

          // Cleanup
          await testPage.deleteSearchField(UI_SEARCH_FIELD_NUMBER.key);
          await testPage.assertSearchFieldNotExists(UI_SEARCH_FIELD_NUMBER.key);
        });

        test('Create and delete a number range search field', async () => {
          // Act
          await testPage.createSearchField(UI_SEARCH_FIELD_NUMBER_RANGE);

          // Assert
          await testPage.assertSearchFieldExists(UI_SEARCH_FIELD_NUMBER_RANGE.key);

          // Cleanup
          await testPage.deleteSearchField(UI_SEARCH_FIELD_NUMBER_RANGE.key);
          await testPage.assertSearchFieldNotExists(UI_SEARCH_FIELD_NUMBER_RANGE.key);
        });

        test('Create and delete a datetime search field', async () => {
          // Act
          await testPage.createSearchField(UI_SEARCH_FIELD_DATETIME);

          // Assert
          await testPage.assertSearchFieldExists(UI_SEARCH_FIELD_DATETIME.key);

          // Cleanup
          await testPage.deleteSearchField(UI_SEARCH_FIELD_DATETIME.key);
          await testPage.assertSearchFieldNotExists(UI_SEARCH_FIELD_DATETIME.key);
        });

        test('Create and delete a boolean search field', async () => {
          // Act
          await testPage.createSearchField(UI_SEARCH_FIELD_BOOLEAN);

          // Assert
          await testPage.assertSearchFieldExists(UI_SEARCH_FIELD_BOOLEAN.key);

          // Cleanup
          await testPage.deleteSearchField(UI_SEARCH_FIELD_BOOLEAN.key);
          await testPage.assertSearchFieldNotExists(UI_SEARCH_FIELD_BOOLEAN.key);
        });

        test('Create and delete a text search field with exact match type', async () => {
          // Act
          await testPage.createSearchField(UI_SEARCH_FIELD_TEXT_EXACT);

          // Assert
          await testPage.assertSearchFieldExists(UI_SEARCH_FIELD_TEXT_EXACT.key);

          // Cleanup
          await testPage.deleteSearchField(UI_SEARCH_FIELD_TEXT_EXACT.key);
          await testPage.assertSearchFieldNotExists(UI_SEARCH_FIELD_TEXT_EXACT.key);
        });

        test('Boolean data type restricts field type to single only', async () => {
          // Act
          await testPage.addSearchFieldButton.click();
          await testPage.selectDropdownItem(testPage.dataTypeDropdown, 'Yes / no');

          // Assert - only Single should be available, not Range or dropdowns
          await testPage.fieldTypeDropdown.click();
          const listbox = page.getByRole('listbox');
          await expect(listbox.getByText('Single', {exact: true})).toBeVisible();
          await expect(listbox.getByText('Range', {exact: true})).not.toBeVisible();
          await expect(
            listbox.getByText('Single select dropdown', {exact: true})
          ).not.toBeVisible();

          // Cleanup
          await page.keyboard.press('Escape');
          await testPage.cancelButton.click();
        });

        test('Non-text data type restricts field types to single and range', async () => {
          // Act
          await testPage.addSearchFieldButton.click();
          await testPage.selectDropdownItem(testPage.dataTypeDropdown, 'Number');

          // Assert - Single and Range should be available, but not dropdowns
          await testPage.fieldTypeDropdown.click();
          const listbox = page.getByRole('listbox');
          await expect(listbox.getByText('Single', {exact: true})).toBeVisible();
          await expect(listbox.getByText('Range', {exact: true})).toBeVisible();
          await expect(
            listbox.getByText('Single select dropdown', {exact: true})
          ).not.toBeVisible();

          // Cleanup
          await page.keyboard.press('Escape');
          await testPage.cancelButton.click();
        });

        test('Text data type allows all field types including dropdowns', async () => {
          // Act
          await testPage.addSearchFieldButton.click();
          await testPage.selectDropdownItem(testPage.dataTypeDropdown, 'Text');

          // Assert - all field types should be available
          await testPage.fieldTypeDropdown.click();
          const listbox = page.getByRole('listbox');
          await expect(listbox.getByText('Single', {exact: true})).toBeVisible();
          await expect(listbox.getByText('Range', {exact: true})).toBeVisible();
          await expect(listbox.getByText('Single select dropdown', {exact: true})).toBeVisible();
          await expect(listbox.getByText('Multi select dropdown', {exact: true})).toBeVisible();

          // Cleanup
          await page.keyboard.press('Escape');
          await testPage.cancelButton.click();
        });

        test('Match type is visible for text with non-dropdown field type', async () => {
          // Act
          await testPage.addSearchFieldButton.click();
          await testPage.selectDropdownItem(testPage.dataTypeDropdown, 'Text');
          await testPage.selectDropdownItem(testPage.fieldTypeDropdown, 'Single');

          // Assert
          await testPage.assertMatchTypeVisible();

          // Cleanup
          await testPage.cancelButton.click();
        });

        test('Match type is hidden for dropdown field type', async () => {
          // Act
          await testPage.addSearchFieldButton.click();
          await testPage.selectDropdownItem(testPage.dataTypeDropdown, 'Text');
          await testPage.selectDropdownItem(testPage.fieldTypeDropdown, 'Single select dropdown');

          // Assert
          await testPage.assertMatchTypeNotVisible();
          await testPage.assertDropdownDataProviderVisible();

          // Cleanup
          await testPage.cancelButton.click();
        });

        test('Match type is hidden for non-text data types', async () => {
          // Act
          await testPage.addSearchFieldButton.click();
          await testPage.selectDropdownItem(testPage.dataTypeDropdown, 'Number');
          await testPage.selectDropdownItem(testPage.fieldTypeDropdown, 'Single');

          // Assert
          await testPage.assertMatchTypeNotVisible();

          // Cleanup
          await testPage.cancelButton.click();
        });

        test('Dropdown data provider is visible for multi-select dropdown', async () => {
          // Act
          await testPage.addSearchFieldButton.click();
          await testPage.selectDropdownItem(testPage.dataTypeDropdown, 'Text');
          await testPage.selectDropdownItem(testPage.fieldTypeDropdown, 'Multi select dropdown');

          // Assert
          await testPage.assertMatchTypeNotVisible();
          await testPage.assertDropdownDataProviderVisible();

          // Cleanup
          await testPage.cancelButton.click();
        });
      });

      test.describe('Download', () => {
        test('Download button is enabled when search fields exist', async () => {
          // Assert - SEARCH_FIELDS_2 still exists from JSON editor tests
          await testPage.assertDownloadButtonEnabled();
        });
      });

      test.describe('Drag and Drop Reorder', () => {
        test('Reorder search fields via drag and drop and persist after navigation', async () => {
          // Arrange
          const firstKey = SEARCH_FIELDS_2[0].key;
          const secondKey = SEARCH_FIELDS_2[1].key;
          await testPage.assertRowOrder([firstKey, secondKey]);

          // Act
          await testPage.dragSearchFieldToPosition(firstKey, secondKey);

          // Assert - order is swapped immediately
          await testPage.assertRowOrder([secondKey, firstKey]);

          // Navigate away and back to verify persistence
          await testPage.goToCaseDetailsManagement('bezwaar');
          await ensureDraftVersionSelected(page);
          await testPage.searchFieldsTab.click();

          // Assert - order is still swapped after fresh load from API
          await testPage.assertRowOrder([secondKey, firstKey]);

          // Revert
          await testPage.dragSearchFieldToPosition(secondKey, firstKey);
          await testPage.assertRowOrder([firstKey, secondKey]);
        });
      });
    });
  });
});
