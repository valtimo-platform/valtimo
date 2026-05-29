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
import {ensureDraftVersionSelected} from '../../../../../../../utils/version.utils';
import {CaseDetailsManagementZgwPage, UPLOAD_FIELD_KEY_LABELS, UploadField} from './page';

test.use({storageState: undefined});

const CASE_KEY = 'bezwaar';
const COLUMN_1 = {key: 'auteur', label: 'Author'};
const COLUMN_2 = {key: 'taal', label: 'Language'};
const COLUMN_3 = {key: 'bronorganisatie', label: 'Source organisation'};

test.describe('Case details management — ZGW', () => {
  let context;
  let page;
  let request;
  let testPage: CaseDetailsManagementZgwPage;

  test.beforeAll(async ({browser, baseURL}) => {
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    request = context.request;
    testPage = new CaseDetailsManagementZgwPage(page, request);

    // Clean up any residue from previous tests
    for (const key of [COLUMN_1.key, COLUMN_2.key, COLUMN_3.key]) {
      await testPage.deleteColumnViaApi(CASE_KEY, key);
    }

    await page.goto('/');
    await testPage.goToCaseManagementForCase(CASE_KEY);
    await ensureDraftVersionSelected(page);
    await testPage.openDocumentColumnsTab();
  });

  test.afterAll(async () => {
    for (const key of [COLUMN_1.key, COLUMN_2.key, COLUMN_3.key]) {
      await testPage.deleteColumnViaApi(CASE_KEY, key);
    }
    await context.close();
  });

  test.describe('6.102–6.105 — Document columns', () => {
    test('Add, edit and delete a document column', async () => {
      // Add
      await testPage.addColumn(COLUMN_1.label);
      await testPage.assertColumnVisible(COLUMN_1.label);

      // Edit: click row opens the edit modal. The column selector must be disabled.
      await testPage.openEditModalForRow(COLUMN_1.label);
      await testPage.assertEditDropdownDisabled();
      await testPage.saveEditModal();

      // Column is still present after saving with no changes
      await testPage.assertColumnVisible(COLUMN_1.label);

      // Delete
      await testPage.deleteColumnViaUi(COLUMN_1.label);
      await testPage.assertColumnNotVisible(COLUMN_1.label);
    });

    test('Create two columns, reorder them, and delete both', async () => {
      // Add two columns in order
      await testPage.addColumn(COLUMN_2.label);
      await testPage.assertColumnVisible(COLUMN_2.label);

      await testPage.addColumn(COLUMN_3.label);
      await testPage.assertColumnVisible(COLUMN_3.label);

      // Reorder: drag COLUMN_2 below COLUMN_3
      const initialRows = await testPage.columnsList.rows.allInnerTexts();
      const col2Index = initialRows.findIndex(t => t.includes(COLUMN_2.label));
      const col3Index = initialRows.findIndex(t => t.includes(COLUMN_3.label));
      expect(col2Index).toBeGreaterThanOrEqual(0);
      expect(col3Index).toBeGreaterThan(col2Index);

      await testPage.reorderColumns(COLUMN_3.label, COLUMN_2.label);

      const reorderedRows = await testPage.columnsList.rows.allInnerTexts();
      const newCol2Index = reorderedRows.findIndex(t => t.includes(COLUMN_2.label));
      const newCol3Index = reorderedRows.findIndex(t => t.includes(COLUMN_3.label));
      expect(newCol3Index).toBeLessThan(newCol2Index);

      // Delete both
      await testPage.deleteColumnViaUi(COLUMN_2.label);
      await testPage.assertColumnNotVisible(COLUMN_2.label);

      await testPage.deleteColumnViaUi(COLUMN_3.label);
      await testPage.assertColumnNotVisible(COLUMN_3.label);
    });

    test.describe('Failure scenarios', () => {
      test('Submit button disabled when no column is selected', async () => {
        await testPage.addColumnButton.click();
        await expect(testPage.modalColumnDropdown).toBeVisible();

        await testPage.assertSubmitButtonDisabled();
        await testPage.modalCancelButton.click();
        await expect(testPage.modalColumnDropdown).not.toBeVisible();
      });
    });

    test.describe('Set column sorting', () => {
      const SORT_COLUMN = {key: 'auteur', label: 'Author'};
      const CONFIGURABLE_URL = `**/api/management/v1/case-definition/${CASE_KEY}/zgw-document-column-key`;

      test.beforeAll(async () => {
        await testPage.deleteColumnViaApi(CASE_KEY, SORT_COLUMN.key);

        await page.route(CONFIGURABLE_URL, async route => {
          const response = await route.fetch();
          const body = await response.json();
          const mutated = body.map((c: {key: string; sortable: boolean}) =>
            c.key === SORT_COLUMN.key ? {...c, sortable: true} : c
          );
          await route.fulfill({response, json: mutated});
        });

        // Reload so the mocked configurable-columns response is used.
        await page.reload();
        await ensureDraftVersionSelected(page);
        await testPage.openDocumentColumnsTab();
      });

      test.afterAll(async () => {
        await page.unroute(CONFIGURABLE_URL);
        await testPage.deleteColumnViaApi(CASE_KEY, SORT_COLUMN.key);
      });

      test('Set descending default sort on a sortable column', async () => {
        await testPage.addColumnButton.click();
        await expect(testPage.modalColumnDropdown).toBeVisible();

        await testPage.selectColumnInModal(SORT_COLUMN.label);

        // Radio group only renders when the selected column is sortable.
        await expect(testPage.defaultSortRadioGroup).toBeVisible();
        await testPage.defaultSortRadio('Descending').click();

        await expect(testPage.modalSubmitButton).toBeEnabled();
        await testPage.modalSubmitButton.click();
        await expect(testPage.modalColumnDropdown).not.toBeVisible();

        // Persisted default sort shows up in the list (reloaded from real backend).
        await testPage.assertColumnVisible(SORT_COLUMN.label);
        await testPage.assertRowDefaultSort(SORT_COLUMN.label, 'Descending');
      });
    });
  });

  test.describe('6.106, 6.107 — Document upload fields', () => {
    let originalField: UploadField;
    let targetLabel: string;

    test.beforeAll(async () => {
      const fields = await testPage.getUploadFields(CASE_KEY);
      expect(fields.length).toBeGreaterThan(0);
      originalField = {...fields[0]};
      targetLabel = UPLOAD_FIELD_KEY_LABELS[originalField.key] ?? originalField.key;

      await testPage.openDocumentUploadFieldsTab();
    });

    test.afterAll(async () => {
      try {
        await testPage.putUploadField(CASE_KEY, originalField);
      } catch (error) {
        throw new Error(
          `Failed to restore upload field '${originalField.key}' on ${CASE_KEY}: ${error}`,
        );
      }
    });

    test('Edit visible and readonly on the first upload field', async () => {
      // List is not empty
      expect(await testPage.uploadFieldsList.rows.count()).toBeGreaterThan(0);

      // Verify the list cells reflect the captured original state
      await testPage.assertUploadFieldRowBooleans(targetLabel, {
        visible: originalField.visible,
        readonly: originalField.readonly,
      });

      // Open edit modal for the first row
      await testPage.openUploadFieldEditModal(targetLabel);

      // Toggles start in sync with the current persisted values
      expect(await testPage.uploadFieldVisibleSwitch.isChecked()).toBe(originalField.visible);
      expect(await testPage.uploadFieldReadonlySwitch.isChecked()).toBe(originalField.readonly);

      // Flip both toggles
      await testPage.toggleUploadFieldVisible();
      await testPage.toggleUploadFieldReadonly();

      // Confirm the switches now hold the flipped values
      await expect(testPage.uploadFieldVisibleSwitch).toBeChecked({checked: !originalField.visible});
      await expect(testPage.uploadFieldReadonlySwitch).toBeChecked({
        checked: !originalField.readonly,
      });

      await testPage.saveUploadFieldModal();

      // The list should now reflect the flipped values
      await testPage.assertUploadFieldRowBooleans(targetLabel, {
        visible: !originalField.visible,
        readonly: !originalField.readonly,
      });

      // The API returns the flipped values
      const updatedFields = await testPage.getUploadFields(CASE_KEY);
      const updatedField = updatedFields.find(f => f.key === originalField.key);
      expect(updatedField?.visible).toBe(!originalField.visible);
      expect(updatedField?.readonly).toBe(!originalField.readonly);
    });

    test.describe('6.108 — Set default value via combo-box', () => {
      const COMBO_FIELD_KEY = 'taal';
      const COMBO_FIELD_LABEL = UPLOAD_FIELD_KEY_LABELS[COMBO_FIELD_KEY];
      let originalComboField: UploadField;

      test.beforeAll(async () => {
        const fields = await testPage.getUploadFields(CASE_KEY);
        const field = fields.find(f => f.key === COMBO_FIELD_KEY);
        expect(field, `${COMBO_FIELD_KEY} field should exist on ${CASE_KEY}`).toBeDefined();
        originalComboField = {...(field as UploadField)};
      });

      test.afterAll(async () => {
        try {
          await testPage.putUploadField(CASE_KEY, originalComboField);
        } catch (error) {
          throw new Error(
            `Failed to restore upload field '${originalComboField.key}' on ${CASE_KEY}: ${error}`,
          );
        }
      });

      test('Open combo-box, select the first option, and save', async () => {
        await testPage.openUploadFieldEditModal(COMBO_FIELD_LABEL);
        await expect(testPage.uploadFieldDefaultValueComboBox).toBeVisible();
        await expect(testPage.uploadFieldDefaultValueInput).toHaveCount(0);

        await testPage.selectFirstDefaultValueOption();
        await testPage.saveUploadFieldModal();

        const updatedFields = await testPage.getUploadFields(CASE_KEY);
        const updatedField = updatedFields.find(f => f.key === COMBO_FIELD_KEY);
        expect(updatedField?.defaultValue).toBeTruthy();
        expect(['nld', 'eng', 'deu']).toContain(updatedField?.defaultValue);
      });
    });
  });
});
