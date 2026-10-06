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
import {apiGet} from '../../utils/api.utils';
import {
  CaseGroup,
  createGroupWithMembersViaApi,
  deleteGroupViaApi,
  GROUP_MANAGEMENT_ENDPOINT,
  uniqueGroupTitle,
} from '../../utils/case-group.utils';
import {GroupSearchFieldsPage, SEARCH_FIELD_CELL} from './page';
import {DOC_PATHS, MEMBER_KEYS} from './search-fields-config';

test.use({storageState: undefined});

// Fields build up across tests (add → edit → reorder → delete) on one group.
test.describe.configure({mode: 'serial'});

interface SavedSearchField {
  key: string;
  title: string;
  dataType: string;
  fieldType: string;
  matchType?: string;
  order: number;
}

test.describe('Case group — Search fields', () => {
  let context;
  let page;
  let group: CaseGroup;
  let fieldsPage: GroupSearchFieldsPage;
  const [bezwaar, verhuizing] = MEMBER_KEYS;

  const savedFields = () =>
    apiGet<SavedSearchField[]>(`${GROUP_MANAGEMENT_ENDPOINT}/${group.key}/search-field`);

  test.beforeAll(async ({browser, baseURL}) => {
    group = await createGroupWithMembersViaApi(uniqueGroupTitle('E2E search fields'), [
      ...MEMBER_KEYS,
    ]);
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    fieldsPage = new GroupSearchFieldsPage(page, group.key);
    await page.goto('/');
  });

  test.afterAll(async () => {
    await deleteGroupViaApi(group.key);
    await context.close();
  });

  // ─── 6.125 View ──────────────────────────────────────────────────

  test.describe('6.125 — View search fields', () => {
    test('a new group shows the empty state', async () => {
      await fieldsPage.goTo();
      await expect(fieldsPage.list.emptyRow).toHaveText('No search fields configured');
    });
  });

  // ─── 6.126 Add search field ──────────────────────────────────────

  test.describe('6.126 — Add search field', () => {
    test.describe('Success', () => {
      test('adds a text field with a like match and a path per case', async () => {
        await fieldsPage.openAddModal();
        await expect(fieldsPage.modal.heading).toHaveText('Add search field');
        await fieldsPage.modal.fillTitle('Name');
        await expect(fieldsPage.modal.keyInput).toHaveValue('name');
        await fieldsPage.modal.fillPath(bezwaar, DOC_PATHS[bezwaar]);
        await fieldsPage.modal.fillPath(verhuizing, DOC_PATHS[verhuizing]);

        await fieldsPage.selectDataType('text');
        await fieldsPage.selectFieldType('single');
        await fieldsPage.selectMatchType('like');
        const sent = await fieldsPage.save();

        expect(sent).toEqual([
          expect.objectContaining({
            key: 'name',
            dataType: 'text',
            fieldType: 'single',
            matchType: 'like',
            pathMappings: expect.arrayContaining([
              {caseDefinitionKey: bezwaar, path: DOC_PATHS[bezwaar]},
              {caseDefinitionKey: verhuizing, path: DOC_PATHS[verhuizing]},
            ]),
          }),
        ]);
        await expect(fieldsPage.list.cell('name', SEARCH_FIELD_CELL.dataType)).toHaveText('text');
        await expect(fieldsPage.list.cell('name', SEARCH_FIELD_CELL.fieldType)).toHaveText(
          'single'
        );
        await expect(fieldsPage.list.cell('name', SEARCH_FIELD_CELL.matchType)).toHaveText('like');
      });

      test('adds a date range field on a shared case field', async () => {
        await fieldsPage.openAddModal();
        await fieldsPage.modal.fillTitle('Created');
        await fieldsPage.modal.fillPath(bezwaar, 'case:createdOn');
        await fieldsPage.modal.fillPath(verhuizing, 'case:createdOn');
        await fieldsPage.selectDataType('date');
        await fieldsPage.selectFieldType('range');

        await expect(fieldsPage.matchTypeDropdown).toBeHidden();
        const sent = await fieldsPage.save();

        expect(sent.map(field => field.key)).toEqual(['name', 'created']);
        await expect(fieldsPage.list.cell('created', SEARCH_FIELD_CELL.matchType)).toHaveText('-');
      });
    });

    test.describe('Failure scenarios', () => {
      test('Save stays disabled until key, data type and field type are set', async () => {
        await fieldsPage.openAddModal();
        await expect(fieldsPage.modal.saveButton).toBeDisabled();

        await fieldsPage.modal.fillTitle('Incomplete');
        await expect(fieldsPage.modal.saveButton).toBeDisabled();
        await fieldsPage.selectDataType('number');
        await expect(fieldsPage.modal.saveButton).toBeDisabled();
        await fieldsPage.selectFieldType('range');
        await expect(fieldsPage.modal.saveButton).toBeEnabled();

        await fieldsPage.modal.cancelButton.click();
      });

      test('a key already in use shows an error and blocks saving', async () => {
        await fieldsPage.openAddModal();
        await fieldsPage.selectDataType('text');
        await fieldsPage.selectFieldType('single');
        await fieldsPage.modal.typeKey('name');

        await expect(fieldsPage.modal.duplicateKeyError).toBeVisible();
        await expect(fieldsPage.modal.saveButton).toBeDisabled();

        await fieldsPage.modal.typeKey('name-2');
        await expect(fieldsPage.modal.saveButton).toBeEnabled();
        await fieldsPage.modal.cancelButton.click();
      });

      test('cancel does not save anything', async () => {
        let saved = false;
        const onRequest = (request: {method(): string; url(): string}) => {
          if (request.method() === 'PUT' && request.url().includes('/search-field')) saved = true;
        };
        page.on('request', onRequest);

        await fieldsPage.openAddModal();
        await fieldsPage.modal.fillTitle('Never saved');
        await fieldsPage.modal.cancelButton.click();
        await expect(fieldsPage.modal.modal).toBeHidden();

        page.off('request', onRequest);
        expect(saved).toBe(false);
        expect(await savedFields()).toHaveLength(2);
      });
    });
  });

  // ─── 6.127 Conditional fields ────────────────────────────────────

  test.describe('6.127 — Conditional fields', () => {
    test.beforeEach(async () => {
      await fieldsPage.openAddModal();
    });

    test.afterEach(async () => {
      if (await fieldsPage.modal.cancelButton.isVisible())
        await fieldsPage.modal.cancelButton.click();
    });

    test('offers the expected data and field types', async () => {
      expect(await fieldsPage.modal.dropdownOptions(fieldsPage.dataTypeDropdown)).toEqual([
        'text',
        'number',
        'date',
        'datetime',
        'boolean',
      ]);
      expect(await fieldsPage.modal.dropdownOptions(fieldsPage.fieldTypeDropdown)).toEqual([
        'single',
        'range',
        'multi-select-dropdown',
        'single-select-dropdown',
      ]);
    });

    test('match type only shows for a single text field', async () => {
      await fieldsPage.selectDataType('text');
      await fieldsPage.selectFieldType('single');
      await expect(fieldsPage.matchTypeDropdown).toBeVisible();
      expect(await fieldsPage.modal.dropdownOptions(fieldsPage.matchTypeDropdown)).toEqual([
        'exact',
        'like',
      ]);

      await fieldsPage.selectDataType('number');
      await expect(fieldsPage.matchTypeDropdown).toBeHidden();
    });

    test('dropdown field types replace match type with a data provider', async () => {
      await fieldsPage.selectDataType('text');
      await fieldsPage.selectFieldType('single-select-dropdown');

      await expect(fieldsPage.dropdownDataProviderInput).toBeVisible();
      await expect(fieldsPage.matchTypeDropdown).toBeHidden();

      await fieldsPage.selectFieldType('single');
      await expect(fieldsPage.dropdownDataProviderInput).toBeHidden();
      await expect(fieldsPage.matchTypeDropdown).toBeVisible();
    });
  });

  // ─── 6.128 Inspect, edit, reorder, delete ────────────────────────

  test.describe('6.128 — Manage search fields', () => {
    test('expanding a row shows the path per case', async () => {
      await fieldsPage.goTo();
      await fieldsPage.list.toggleExpand('name');

      await expect(fieldsPage.list.pathMappings).toHaveCount(2);
      await expect(fieldsPage.list.pathMappings.filter({hasText: verhuizing})).toContainText(
        DOC_PATHS[verhuizing]
      );
      await fieldsPage.list.toggleExpand('name');
    });

    test('editing keeps the key read-only and saves the new title', async () => {
      await fieldsPage.list.openEdit('name');
      await fieldsPage.modal.waitForOpen();
      await expect(fieldsPage.modal.heading).toHaveText('Edit search field');
      await expect(fieldsPage.modal.keyInput).toHaveAttribute('readonly', '');

      await fieldsPage.modal.fillTitle('Applicant');
      const sent = await fieldsPage.save();

      expect(sent.find(field => field.key === 'name')).toMatchObject({title: 'Applicant'});
      await expect(fieldsPage.list.cell('name', SEARCH_FIELD_CELL.name)).toHaveText('Applicant');
    });

    test('the toolbar search filters fields', async () => {
      await fieldsPage.list.searchInput.fill('created');
      await expect(fieldsPage.list.rows).toHaveCount(1);
      await fieldsPage.list.searchInput.fill('');
      await expect(fieldsPage.list.rows).toHaveCount(2);
    });

    test('dragging a row saves the new order', async () => {
      await fieldsPage.goTo();
      expect(await fieldsPage.list.keys()).toEqual(['name', 'created']);

      const sent = await fieldsPage.list.drag('created', 'name');

      expect((sent as SavedSearchField[]).map(field => field.key)).toEqual(['created', 'name']);
      await page.reload();
      await expect(fieldsPage.list.rows).toHaveCount(2);
      expect(await fieldsPage.list.keys()).toEqual(['created', 'name']);
    });

    test('deleting a field saves the remaining list', async () => {
      const sent = await fieldsPage.list.delete('name');

      expect((sent as SavedSearchField[]).map(field => field.key)).toEqual(['created']);
      await expect(fieldsPage.list.row('name')).toHaveCount(0);
      expect((await savedFields()).map(field => field.key)).toEqual(['created']);
    });
  });
});
