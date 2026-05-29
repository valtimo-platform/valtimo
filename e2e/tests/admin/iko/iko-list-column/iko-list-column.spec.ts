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

import {test, expect, type Browser, type BrowserContext, type Page} from '@playwright/test';
import {IkoServerPage} from '../iko-server/page';
import {
  IKO_SERVER_TITLE_PREFIX,
  ikoServerConfig,
  uniqueServerTitle,
} from '../iko-server/iko-server-config';
import {IkoViewPage} from '../iko-view/page';
import {IkoListColumnPage} from './page';
import {
  COLUMN_DISPLAY_TYPES,
  COLUMN_HEADERS,
  COLUMN_SORT_LABELS,
  IKO_LIST_COLUMN_TITLE_PREFIX,
  ikoListColumnConfig,
  uniqueColumnTitle,
} from './iko-list-column-config';

test.use({storageState: undefined});

test.describe('Feature 15E — IKO List Columns', () => {
  let context: BrowserContext;
  let page: Page;
  let ikoServerPage: IkoServerPage;
  let ikoViewPage: IkoViewPage;
  let columnsPage: IkoListColumnPage;
  let parentServerKey: string;
  let parentViewKey: string;

  test.beforeAll(async ({browser, baseURL}: {browser: Browser; baseURL?: string}) => {
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    ikoServerPage = new IkoServerPage(page, context.request);
    ikoViewPage = new IkoViewPage(page, context.request);
    columnsPage = new IkoListColumnPage(page, context.request);

    // Every list column lives under a view that lives under a server. Both
    // parents are created via the API to keep this suite focused on columns.
    const parentServerTitle = uniqueServerTitle('column-suite');
    parentServerKey = await ikoServerPage.createServerViaApi(
      parentServerTitle,
      ikoServerConfig.serverUrl
    );

    const parentViewTitle = `E2E IKO View column-suite-parent`;
    parentViewKey = await ikoViewPage.createViewViaApi(parentServerKey, parentViewTitle);

    await page.goto('/');
    await columnsPage.goToListTab(parentServerKey, parentViewKey);
  });

  test.afterAll(async () => {
    // Columns → view → server. Children first.
    await columnsPage.cleanupTestColumnsViaApi(parentViewKey, IKO_LIST_COLUMN_TITLE_PREFIX);
    await ikoViewPage.deleteViewViaApi(parentViewKey);
    await ikoServerPage.cleanupTestServersViaApi(IKO_SERVER_TITLE_PREFIX);
    await context.close();
  });

  // Guard against tests that fail mid-modal — leaving a stuck modal would
  // poison every subsequent test in this serial run.
  test.afterEach(async () => {
    await columnsPage.closeAnyOpenModal();
  });

  // ─── List tab & headers (15.43 – 15.44) ─────────────────────────────

  test.describe('List tab', () => {
    test('15.43 — displays the list tab with the columns table', async () => {
      await expect(columnsPage.list.table).toBeVisible();
      await expect(columnsPage.addColumnButton).toBeVisible();
    });

    test('15.44 — shows the expected column headers', async () => {
      for (const header of COLUMN_HEADERS) {
        await columnsPage.assertHeaderVisible(header);
      }
    });
  });

  // ─── Column CRUD (15.45 – 15.53) ────────────────────────────────────

  test.describe('Column management', () => {
    const initialTitle = uniqueColumnTitle('crud');
    const editedTitle = uniqueColumnTitle('crud-edited');

    test('15.45 — opens the Add column modal', async () => {
      await columnsPage.openAddModal();
      await expect(columnsPage.titleInput).toBeVisible();
      await columnsPage.cancelButton.click();
      await expect(columnsPage.addModalHeading).toBeHidden();
    });

    test('15.46-15.48, 15.51-15.52 — creates a column with title, auto-key, path and display type', async () => {
      await columnsPage.openAddModal();

      // 15.46 enter title → 15.47 the key auto-generates from the title.
      await columnsPage.titleInput.fill(initialTitle);
      await expect(columnsPage.keyInput).not.toHaveValue('');

      // 15.48 enter path, 15.51 select display type.
      await columnsPage.pathInput.fill(ikoListColumnConfig.path);
      await columnsPage.selectDisplayType(COLUMN_DISPLAY_TYPES.text.label);

      // 15.52 save.
      await columnsPage.save();
      await columnsPage.assertColumnVisible(initialTitle);
    });

    test('15.49 — toggling sorting enabled flips the form control', async () => {
      await columnsPage.openAddModal();

      await expect(columnsPage.sortableToggleInput).not.toBeChecked();
      await columnsPage.toggleSortable();
      await expect(columnsPage.sortableToggleInput).toBeChecked();

      await columnsPage.cancelButton.click();
      await expect(columnsPage.addModalHeading).toBeHidden();
    });

    test('15.50 — selecting a default sort enables sortable and disables the toggle', async () => {
      await columnsPage.openAddModal();

      await columnsPage.selectDefaultSort(COLUMN_SORT_LABELS.asc);
      // Selecting a default sort force-enables `sortable` and disables the
      // switch — see `defaultSort.valueChanges` in the list-modal component.
      await expect(columnsPage.sortableToggleInput).toBeChecked();
      await expect(columnsPage.sortableToggleInput).toBeDisabled();

      await columnsPage.cancelButton.click();
      await expect(columnsPage.addModalHeading).toBeHidden();
    });

    test('15.51 — supports the "hidden" display type variant', async () => {
      const hiddenTitle = uniqueColumnTitle('hidden');
      await columnsPage.createColumn(hiddenTitle, {
        displayTypeLabel: COLUMN_DISPLAY_TYPES.hidden.label,
      });
    });

    test('15.53 — edits a column title', async () => {
      await columnsPage.editColumnTitle(initialTitle, editedTitle);
      await columnsPage.assertColumnVisible(editedTitle);
      await columnsPage.assertColumnNotVisible(initialTitle);
    });
  });

  // ─── Reorder (15.54) ────────────────────────────────────────────────

  test.describe('Reorder columns', () => {
    const firstTitle = uniqueColumnTitle('reorder-1');
    const secondTitle = uniqueColumnTitle('reorder-2');

    test.beforeAll(async () => {
      await columnsPage.createColumn(firstTitle, {path: '/a'});
      await columnsPage.createColumn(secondTitle, {path: '/b'});
    });

    test('15.54 — drag-and-dropping a row updates the column order', async () => {
      const firstIdxBefore = await columnsPage.getColumnRowIndex(firstTitle);
      const secondIdxBefore = await columnsPage.getColumnRowIndex(secondTitle);
      expect(firstIdxBefore).toBeGreaterThanOrEqual(0);
      expect(secondIdxBefore).toBeGreaterThanOrEqual(0);
      expect(firstIdxBefore).toBeLessThan(secondIdxBefore);

      await columnsPage.reorderColumn(secondTitle, firstTitle);

      // After the reorder the second row should now appear before the first.
      await expect
        .poll(async () => {
          const newFirstIdx = await columnsPage.getColumnRowIndex(firstTitle);
          const newSecondIdx = await columnsPage.getColumnRowIndex(secondTitle);
          return newSecondIdx < newFirstIdx;
        })
        .toBe(true);
    });
  });

  // ─── Failure scenarios ──────────────────────────────────────────────

  test.describe('Failure scenarios', () => {
    test('cannot save with an empty title', async () => {
      await columnsPage.openAddModal();
      await expect(columnsPage.saveButton).toBeDisabled();
      await columnsPage.cancelButton.click();
      await expect(columnsPage.addModalHeading).toBeHidden();
    });

    test('cannot save without a path', async () => {
      await columnsPage.openAddModal();
      await columnsPage.titleInput.fill(uniqueColumnTitle('missing-path'));
      await columnsPage.selectDisplayType(COLUMN_DISPLAY_TYPES.text.label);

      // Path is required by the form — save must stay disabled.
      await expect(columnsPage.saveButton).toBeDisabled();

      await columnsPage.cancelButton.click();
      await expect(columnsPage.addModalHeading).toBeHidden();
    });

    test('cannot save without a display type', async () => {
      await columnsPage.openAddModal();
      await columnsPage.titleInput.fill(uniqueColumnTitle('missing-display-type'));
      await columnsPage.pathInput.fill(ikoListColumnConfig.path);

      await expect(columnsPage.saveButton).toBeDisabled();

      await columnsPage.cancelButton.click();
      await expect(columnsPage.addModalHeading).toBeHidden();
    });
  });
});
