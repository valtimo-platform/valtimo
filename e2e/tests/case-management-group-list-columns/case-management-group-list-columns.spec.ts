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
import {apiGet, isApiStatus} from '../../utils/api.utils';
import {
  CaseGroup,
  createGroupWithMembersViaApi,
  deleteGroupViaApi,
  documentColumn,
  GROUP_MANAGEMENT_ENDPOINT,
  putListColumnsViaApi,
  uniqueGroupTitle,
} from '../../utils/case-group.utils';
import {COLUMN_CELL, GroupListColumnsPage} from './page';
import {DOC_PATHS, MEMBER_KEYS} from './list-columns-config';

test.use({storageState: undefined});

// Columns build up across tests (add → edit → reorder → delete) on one group.
test.describe.configure({mode: 'serial'});

interface SavedColumn {
  key: string;
  title: string;
  sortable: boolean;
  defaultSort: string | null;
  displayType: {type: string};
  order: number;
}

test.describe('Case group — List columns', () => {
  let context;
  let page;
  let group: CaseGroup;
  let columnsPage: GroupListColumnsPage;
  const [bezwaar, verhuizing] = MEMBER_KEYS;

  const savedColumns = () =>
    apiGet<SavedColumn[]>(`${GROUP_MANAGEMENT_ENDPOINT}/${group.key}/list-column`);

  test.beforeAll(async ({browser, baseURL}) => {
    group = await createGroupWithMembersViaApi(uniqueGroupTitle('E2E columns'), [...MEMBER_KEYS]);
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    columnsPage = new GroupListColumnsPage(page, group.key);
    await page.goto('/');
  });

  test.afterAll(async () => {
    await deleteGroupViaApi(group.key);
    await context.close();
  });

  // ─── 6.119 View ──────────────────────────────────────────────────

  test.describe('6.119 — View list columns', () => {
    test('a new group shows the empty state', async () => {
      await columnsPage.goTo();
      await expect(columnsPage.list.emptyState).toBeVisible();
      await expect(columnsPage.list.emptyState).toHaveText('No columns configured');
    });
  });

  // ─── 6.120 Add column ────────────────────────────────────────────

  test.describe('6.120 — Add column', () => {
    test.describe('Success', () => {
      test('adds a text column with a different document path per case', async () => {
        await columnsPage.openAddModal();
        await expect(columnsPage.modal.heading).toHaveText('Add column');
        await columnsPage.modal.fillTitle('Name');
        await expect(columnsPage.modal.keyInput).toHaveValue('name');
        await expect(columnsPage.modal.pathCounter).toHaveText('0 of 2 case definitions filled');

        await columnsPage.modal.fillPath(bezwaar, DOC_PATHS[bezwaar]);
        await expect(columnsPage.modal.pathCounter).toHaveText('1 of 2 case definitions filled');
        await columnsPage.modal.fillPath(verhuizing, DOC_PATHS[verhuizing]);
        await expect(columnsPage.modal.pathCounter).toHaveText('2 of 2 case definitions filled');

        const sent = await columnsPage.save();

        expect(sent).toEqual([
          expect.objectContaining({
            key: 'name',
            title: 'Name',
            sortable: false,
            pathMappings: expect.arrayContaining([
              {caseDefinitionKey: bezwaar, path: DOC_PATHS[bezwaar]},
              {caseDefinitionKey: verhuizing, path: DOC_PATHS[verhuizing]},
            ]),
          }),
        ]);
        await expect(columnsPage.list.rows).toHaveCount(1);
        await expect(columnsPage.list.cell('name', COLUMN_CELL.name)).toHaveText('Name');
        await expect(columnsPage.list.cell('name', COLUMN_CELL.displayType)).toHaveText('text');
        await expect(columnsPage.list.cell('name', COLUMN_CELL.sortable)).toHaveText('No');
      });

      test('a column on one shared case field can be sortable with a default sort', async () => {
        await columnsPage.openAddModal();
        await columnsPage.modal.fillTitle('Created on');
        await expect(columnsPage.modal.keyInput).toHaveValue('created-on');
        await expect(columnsPage.sortableInput).toBeDisabled();
        await expect(columnsPage.sortableHint).toBeVisible();

        // One mapped case type already allows sorting; unmapped ones sort as empty
        await columnsPage.modal.fillPath(bezwaar, 'case:createdOn');
        await expect(columnsPage.sortableInput).toBeEnabled();
        await expect(columnsPage.sortableHint).toBeHidden();

        await columnsPage.modal.fillPath(verhuizing, 'case:createdOn');
        await columnsPage.selectDisplayType('date');
        await expect(columnsPage.dateFormatInput).toBeVisible();
        await columnsPage.checkSortable();
        await columnsPage.selectDefaultSort('Descending');

        const sent = await columnsPage.save();

        expect(sent.map(column => column.key)).toEqual(['name', 'created-on']);
        await expect(columnsPage.list.cell('created-on', COLUMN_CELL.sortable)).toHaveText('Yes');
        await expect(columnsPage.list.cell('created-on', COLUMN_CELL.displayType)).toHaveText(
          'date'
        );
        const createdOn = (await savedColumns()).find(column => column.key === 'created-on');
        expect(createdOn).toMatchObject({sortable: true, defaultSort: 'DESC'});
      });
    });

    test.describe('Failure scenarios', () => {
      test('Save stays disabled while the key is empty', async () => {
        await columnsPage.openAddModal();
        await expect(columnsPage.modal.keyInput).toHaveValue('');
        await expect(columnsPage.modal.saveButton).toBeDisabled();
        await columnsPage.modal.cancelButton.click();
        await expect(columnsPage.modal.modal).toBeHidden();
      });

      test('a key already in use shows an error and blocks saving', async () => {
        await columnsPage.openAddModal();
        await columnsPage.modal.typeKey('name');

        await expect(columnsPage.modal.duplicateKeyError).toBeVisible();
        await expect(columnsPage.modal.saveButton).toBeDisabled();

        await columnsPage.modal.typeKey('name-unique');
        await expect(columnsPage.modal.duplicateKeyError).toBeHidden();
        await expect(columnsPage.modal.saveButton).toBeEnabled();
        await columnsPage.modal.cancelButton.click();
      });

      test('different document paths per case cannot be sortable', async () => {
        await columnsPage.openAddModal();
        await columnsPage.modal.fillTitle('Mixed');
        await columnsPage.modal.fillPath(bezwaar, DOC_PATHS[bezwaar]);
        await columnsPage.modal.fillPath(verhuizing, DOC_PATHS[verhuizing]);

        await expect(columnsPage.sortableInput).toBeDisabled();
        await expect(columnsPage.sortableInput).not.toBeChecked();
        await expect(columnsPage.sortableHint).toBeVisible();
        await columnsPage.modal.cancelButton.click();
      });

      test('only one column can have a default sort', async () => {
        await columnsPage.openAddModal();
        await columnsPage.modal.fillTitle('Modified on');
        await columnsPage.modal.fillPath(bezwaar, 'case:modifiedOn');
        await columnsPage.checkSortable();

        await expect(columnsPage.defaultSortButton).toBeDisabled();
        await columnsPage.modal.cancelButton.click();
      });

      test('cancel does not save anything', async () => {
        let saved = false;
        const onRequest = (request: {method(): string; url(): string}) => {
          if (request.method() === 'PUT' && request.url().includes('/list-column')) saved = true;
        };
        page.on('request', onRequest);

        await columnsPage.openAddModal();
        await columnsPage.modal.fillTitle('Never saved');
        await columnsPage.modal.cancelButton.click();
        await expect(columnsPage.modal.modal).toBeHidden();

        page.off('request', onRequest);
        expect(saved).toBe(false);
        await expect(columnsPage.list.rows).toHaveCount(2);
      });

      test('the API rejects a sortable column that maps to a document path', async () => {
        let status: number | undefined;
        try {
          await putListColumnsViaApi(group.key, [
            documentColumn(
              'invalid',
              'Invalid',
              [{caseDefinitionKey: bezwaar, path: DOC_PATHS[bezwaar]}],
              {
                sortable: true,
              }
            ),
          ]);
        } catch (error) {
          status = isApiStatus(error, 400) ? 400 : (error as {status?: number}).status;
        }
        expect(status).toBe(400);
        expect((await savedColumns()).map(column => column.key)).toEqual(['name', 'created-on']);
      });
    });
  });

  // ─── 6.121 Display types ─────────────────────────────────────────

  test.describe('6.121 — Display types', () => {
    test.beforeEach(async () => {
      await columnsPage.openAddModal();
      await columnsPage.modal.fillTitle('Display type check');
    });

    test.afterEach(async () => {
      if (await columnsPage.modal.cancelButton.isVisible())
        await columnsPage.modal.cancelButton.click();
    });

    test('offers text, date, boolean, enum and tags', async () => {
      expect(await columnsPage.modal.dropdownOptions(columnsPage.displayTypeDropdown)).toEqual([
        'text',
        'date',
        'boolean',
        'enum',
        'tags',
      ]);
    });

    test('tags shows the tag amount and forces sorting off', async () => {
      await columnsPage.modal.fillPath(bezwaar, 'case:createdOn');
      await columnsPage.checkSortable();

      await columnsPage.selectDisplayType('tags');

      await expect(columnsPage.tagAmountInput).toBeVisible();
      await expect(columnsPage.sortableInput).not.toBeChecked();
      await expect(columnsPage.sortableInput).toBeDisabled();
    });

    test('enum and boolean show the value mapping input', async () => {
      await columnsPage.selectDisplayType('enum');
      await expect(columnsPage.enumInput).toBeVisible();

      await columnsPage.selectDisplayType('boolean');
      await expect(columnsPage.enumInput).toBeVisible();
      await expect(columnsPage.dateFormatInput).toBeHidden();
    });
  });

  // ─── 6.122 Path filtering in the modal ───────────────────────────

  test.describe('6.122 — Per-case paths', () => {
    test.afterEach(async () => {
      if (await columnsPage.modal.cancelButton.isVisible())
        await columnsPage.modal.cancelButton.click();
    });

    test('"Show only empty" hides case types that already have a path', async () => {
      await columnsPage.openAddModal();
      await columnsPage.modal.fillPath(bezwaar, DOC_PATHS[bezwaar]);

      await columnsPage.modal.toggleShowOnlyEmpty();

      await expect(columnsPage.modal.pathRows).toHaveCount(1);
      await expect(columnsPage.modal.pathRow(verhuizing)).toBeVisible();
    });

    test('searching case types filters the path rows', async () => {
      await columnsPage.openAddModal();

      await columnsPage.modal.pathSearch.fill(verhuizing);
      await expect(columnsPage.modal.pathRows).toHaveCount(1);
      await expect(columnsPage.modal.pathRow(verhuizing)).toBeVisible();

      await columnsPage.modal.pathSearch.fill('no-such-case-zzz');
      await expect(columnsPage.modal.pathRows).toHaveCount(0);
      await expect(columnsPage.modal.noMatchingCaseTypes).toBeVisible();
    });
  });

  // ─── 6.123 Inspect, edit, search ─────────────────────────────────

  test.describe('6.123 — Inspect and edit columns', () => {
    test('expanding a row shows the path per case', async () => {
      await columnsPage.goTo();
      await columnsPage.list.toggleExpand('name');

      await expect(columnsPage.list.expandedRow).toBeVisible();
      await expect(columnsPage.list.pathMappings).toHaveCount(2);
      await expect(columnsPage.list.pathMappings.filter({hasText: bezwaar})).toContainText(
        DOC_PATHS[bezwaar]
      );
      await expect(columnsPage.list.pathMappings.filter({hasText: verhuizing})).toContainText(
        DOC_PATHS[verhuizing]
      );

      await columnsPage.list.toggleExpand('name');
      await expect(columnsPage.list.expandedRow).toBeHidden();
    });

    test('clicking a row opens it for editing; the expand button does not', async () => {
      await columnsPage.list.toggleExpand('name');
      await expect(columnsPage.list.expandedRow).toBeVisible();
      await expect(columnsPage.modal.modal.getByRole('heading', {level: 3})).toBeHidden();
      await columnsPage.list.toggleExpand('name');

      await columnsPage.list.cell('name', COLUMN_CELL.key).click();
      await columnsPage.modal.waitForOpen();
      await expect(columnsPage.modal.heading).toHaveText('Edit column');
      await expect(columnsPage.modal.keyInput).toHaveValue('name');

      await columnsPage.modal.cancelButton.click();
      await expect(columnsPage.modal.titleInput).toBeHidden();
    });

    test('editing keeps the key read-only and saves the new title', async () => {
      await columnsPage.list.openEdit('name');
      await columnsPage.modal.waitForOpen();
      await expect(columnsPage.modal.heading).toHaveText('Edit column');
      await expect(columnsPage.modal.keyInput).toHaveValue('name');
      await expect(columnsPage.modal.keyInput).toHaveAttribute('readonly', '');
      await expect(columnsPage.modal.keyEditButton).toBeHidden();

      await columnsPage.modal.fillTitle('Applicant');
      const sent = await columnsPage.save();

      expect(sent.find(column => column.key === 'name')).toMatchObject({title: 'Applicant'});
      await expect(columnsPage.list.cell('name', COLUMN_CELL.name)).toHaveText('Applicant');
    });

    test('the toolbar search filters columns by key and title', async () => {
      await columnsPage.list.searchInput.fill('created');
      await expect(columnsPage.list.rows).toHaveCount(1);
      await expect(columnsPage.list.row('created-on')).toBeVisible();

      await columnsPage.list.searchInput.fill('Applicant');
      await expect(columnsPage.list.rows).toHaveCount(1);
      await expect(columnsPage.list.row('name')).toBeVisible();

      await columnsPage.list.searchInput.fill('');
      await expect(columnsPage.list.rows).toHaveCount(2);
    });
  });

  // ─── 6.124 Reorder and delete ────────────────────────────────────

  test.describe('6.124 — Reorder and delete', () => {
    test('dragging a row saves the new order', async () => {
      await columnsPage.goTo();
      await expect(columnsPage.list.rows).toHaveCount(2);
      expect(await columnsPage.list.keys()).toEqual(['name', 'created-on']);

      const sent = await columnsPage.list.drag('created-on', 'name');

      expect((sent as SavedColumn[]).map(column => column.key)).toEqual(['created-on', 'name']);
      await page.reload();
      await expect(columnsPage.list.rows).toHaveCount(2);
      expect(await columnsPage.list.keys()).toEqual(['created-on', 'name']);
    });

    test('deleting a column saves the remaining list without confirmation', async () => {
      const sent = await columnsPage.list.delete('name');

      expect((sent as SavedColumn[]).map(column => column.key)).toEqual(['created-on']);
      await expect(columnsPage.list.row('name')).toHaveCount(0);
      expect((await savedColumns()).map(column => column.key)).toEqual(['created-on']);
    });
  });
});
