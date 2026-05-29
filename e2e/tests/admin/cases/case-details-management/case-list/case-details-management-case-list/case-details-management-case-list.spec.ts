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
  LIST_COLUMNS,
  LIST_COLUMNS_2,
  UI_COLUMN_1,
  UI_COLUMN_2,
  UI_COLUMN_DATE,
  UI_COLUMN_DEFAULT_SORT,
  UI_COLUMN_ENUM,
  UI_COLUMN_EXPORTABLE,
  UI_COLUMN_TAGS,
} from './json-list-column-config';
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
    await ensureDraftVersionSelected(page);
  });

  test.describe('Success test', () => {
    test.describe('6.68–6.70, 6.73 — List columns', () => {
      test.beforeAll(async () => {
        await testPage.listColumnsTab.click();
      });

      test('Check list column page is loaded', async () => {
        // Assert
        await expect(testPage.caseListColumnsList).toBeVisible();
      });

      test.describe('JSON Editor', () => {
        let jsonEditor;
        test.beforeAll(async () => {
          jsonEditor = new JsonEditor(page);
        });

        test.beforeEach(async () => {
          //Arrange – ensure JSON view is active (idempotent)
          if (!(await testPage.listColumnJSONEditor.isVisible())) {
            await testPage.switchViewButton.click();
          }
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

      test.describe('UI Column Management', () => {
        test('Create a column via UI', async () => {
          // Act
          await testPage.createColumn(UI_COLUMN_1);

          // Assert
          await testPage.assertColumnExists(UI_COLUMN_1.key);
        });

        test('Create a second column via UI', async () => {
          // Act
          await testPage.createColumn(UI_COLUMN_2);

          // Assert
          await testPage.assertColumnExists(UI_COLUMN_2.key);
        });

        test('Edit a column title via UI', async () => {
          // Act
          await testPage.editColumnTitle(UI_COLUMN_1.key, 'Updated Title');

          // Assert
          await expect(page.locator('td[title="Updated Title"]').first()).toBeVisible();
        });

        test('Cancel creating a column', async () => {
          // Act
          await testPage.addListColumnButton.click();
          await testPage.listColumnCancelButton.click();

          // Assert
          await expect(testPage.addListColumnButton).toBeVisible();
        });

        test('Save button disabled when form is invalid', async () => {
          // Act
          await testPage.addListColumnButton.click();

          // Assert
          await testPage.assertSaveButtonDisabled();

          // Cleanup
          await testPage.listColumnCancelButton.click();
        });

        test('Duplicate key shows validation error', async () => {
          // Arrange
          await testPage.addListColumnButton.click();
          await testPage.keyInput.fill(UI_COLUMN_1.key);

          // Assert
          await testPage.assertSaveButtonDisabled();

          // Cleanup
          await testPage.listColumnCancelButton.click();
        });

        test('Delete a column via UI', async () => {
          // Act
          await testPage.deleteColumn(UI_COLUMN_1.key);

          // Assert
          await testPage.assertColumnNotExists(UI_COLUMN_1.key);
        });

        test('Delete second column via UI', async () => {
          // Act
          await testPage.deleteColumn(UI_COLUMN_2.key);

          // Assert
          await testPage.assertColumnNotExists(UI_COLUMN_2.key);
        });
      });

      test.describe('Column Display Types', () => {
        test('Create and delete a date column with date format', async () => {
          // Act
          await testPage.createColumn(UI_COLUMN_DATE);

          // Assert
          await testPage.assertColumnExists(UI_COLUMN_DATE.key);

          // Cleanup
          await testPage.deleteColumn(UI_COLUMN_DATE.key);
          await testPage.assertColumnNotExists(UI_COLUMN_DATE.key);
        });

        test('Create and delete an enum column with enumeration values', async () => {
          // Act
          await testPage.createColumn(UI_COLUMN_ENUM);

          // Assert
          await testPage.assertColumnExists(UI_COLUMN_ENUM.key);

          // Cleanup
          await testPage.deleteColumn(UI_COLUMN_ENUM.key);
          await testPage.assertColumnNotExists(UI_COLUMN_ENUM.key);
        });

        test('Create and delete a tags column with tag amount', async () => {
          // Act
          await testPage.createColumn(UI_COLUMN_TAGS);

          // Assert
          await testPage.assertColumnExists(UI_COLUMN_TAGS.key);

          // Cleanup
          await testPage.deleteColumn(UI_COLUMN_TAGS.key);
          await testPage.assertColumnNotExists(UI_COLUMN_TAGS.key);
        });

        test('Create and delete an exportable column', async () => {
          // Act
          await testPage.createColumn(UI_COLUMN_EXPORTABLE);

          // Assert
          await testPage.assertColumnExists(UI_COLUMN_EXPORTABLE.key);

          // Also verify cancel delete keeps the column
          await testPage.cancelDelete(UI_COLUMN_EXPORTABLE.key);
          await testPage.assertColumnExists(UI_COLUMN_EXPORTABLE.key);

          // Cleanup
          await testPage.deleteColumn(UI_COLUMN_EXPORTABLE.key);
          await testPage.assertColumnNotExists(UI_COLUMN_EXPORTABLE.key);
        });

        test('Create column with default sort and verify only one allowed', async () => {
          // Act
          await testPage.createColumn(UI_COLUMN_DEFAULT_SORT);

          // Assert
          await testPage.assertColumnExists(UI_COLUMN_DEFAULT_SORT.key);

          // Verify a second column cannot set default sort
          await testPage.addListColumnButton.click();
          await testPage.assertDefaultSortDropdownDisabled();
          await testPage.listColumnCancelButton.click();

          // Cleanup
          await testPage.deleteColumn(UI_COLUMN_DEFAULT_SORT.key);
          await testPage.assertColumnNotExists(UI_COLUMN_DEFAULT_SORT.key);
        });

        test('Save button enabled when form is valid', async () => {
          // Act
          await testPage.addListColumnButton.click();
          await testPage.keyInput.fill('uiTestValid');
          await testPage.valuePathSelectorToggle.click();
          await testPage.valuePathSelectorInput.fill('case:createdBy');
          await testPage.selectDropdownItem(testPage.displayTypeDropdown, 'Text');

          // Assert
          await testPage.assertSaveButtonEnabled();

          // Cleanup
          await testPage.listColumnCancelButton.click();
        });
      });

      test.describe('Download', () => {
        test('Download button is enabled when columns exist', async () => {
          // Assert - LIST_COLUMNS_2 still exists from JSON editor tests
          await testPage.assertDownloadButtonEnabled();
        });
      });

      test.describe('Drag and Drop Reorder', () => {
        test('Reorder columns via drag and drop and persist after navigation', async () => {
          // Arrange
          const firstKey = LIST_COLUMNS_2[0].key;
          const secondKey = LIST_COLUMNS_2[1].key;
          await testPage.assertRowOrder([firstKey, secondKey]);

          // Act
          await testPage.dragColumnToPosition(firstKey, secondKey);

          // Assert - order is swapped immediately
          await testPage.assertRowOrder([secondKey, firstKey]);

          // Navigate away and back to verify persistence
          await testPage.goToCaseDetailsManagementCaseList('bezwaar');
          await ensureDraftVersionSelected(page);
          await testPage.listColumnsTab.click();

          // Assert - order is still swapped after fresh load from API
          await testPage.assertRowOrder([secondKey, firstKey]);

          // Revert
          await testPage.dragColumnToPosition(secondKey, firstKey);
          await testPage.assertRowOrder([firstKey, secondKey]);
        });
      });
    });
  });
});
