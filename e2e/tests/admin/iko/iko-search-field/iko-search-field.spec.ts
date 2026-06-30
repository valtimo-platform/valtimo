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
import {IkoSearchActionPage} from '../iko-search-action/page';
import {IkoSearchFieldPage} from './page';
import {
  DATA_TYPE_LABELS,
  FIELD_TYPE_LABELS,
  IKO_SEARCH_FIELD_TITLE_PREFIX,
  MATCH_TYPE_LABELS,
  SEARCH_FIELD_HEADERS,
  ikoSearchFieldConfig,
  uniqueSearchFieldTitle,
} from './iko-search-field-config';

test.use({storageState: undefined});

test.describe('Feature 15D — IKO Search Fields', () => {
  let context: BrowserContext;
  let page: Page;
  let ikoServerPage: IkoServerPage;
  let ikoViewPage: IkoViewPage;
  let searchActionPage: IkoSearchActionPage;
  let searchFieldPage: IkoSearchFieldPage;
  let parentServerKey: string;
  let parentViewKey: string;
  let parentActionKey: string;

  test.beforeAll(async ({browser, baseURL}: {browser: Browser; baseURL?: string}) => {
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    ikoServerPage = new IkoServerPage(page, context.request);
    ikoViewPage = new IkoViewPage(page, context.request);
    searchActionPage = new IkoSearchActionPage(page, context.request);
    searchFieldPage = new IkoSearchFieldPage(page, context.request);

    // Every search field lives under a search action → view → server. All
    // parents are created via the API to keep this suite focused on fields.
    const parentServerTitle = uniqueServerTitle('search-field-suite');
    parentServerKey = await ikoServerPage.createServerViaApi(
      parentServerTitle,
      ikoServerConfig.serverUrl
    );

    const parentViewTitle = `E2E IKO View search-field-suite-parent`;
    parentViewKey = await ikoViewPage.createViewViaApi(parentServerKey, parentViewTitle);

    const parentActionTitle = `E2E IKO Search Action search-field-suite-parent`;
    parentActionKey = await searchActionPage.createSearchActionViaApi(
      parentViewKey,
      parentActionTitle
    );

    await page.goto('/');
    await searchFieldPage.goToSearchFieldsPage(parentServerKey, parentViewKey, parentActionKey);
  });

  test.afterAll(async () => {
    // Fields → action → view → server. Children first.
    await searchFieldPage.cleanupTestFieldsViaApi(
      parentViewKey,
      parentActionKey,
      IKO_SEARCH_FIELD_TITLE_PREFIX
    );
    await searchActionPage.deleteSearchActionViaApi(parentViewKey, parentActionKey);
    await ikoViewPage.deleteViewViaApi(parentViewKey);
    await ikoServerPage.cleanupTestServersViaApi(IKO_SERVER_TITLE_PREFIX);
    await context.close();
  });

  // Guard against tests that fail mid-modal — leaving a stuck modal would
  // poison every subsequent test in this serial run.
  test.afterEach(async () => {
    await searchFieldPage.closeAnyOpenModal();
  });

  // ─── Search fields list (15.31) ─────────────────────────────────────

  test.describe('Search fields list', () => {
    test('15.31 — displays the search fields page with the list and add button', async () => {
      await expect(searchFieldPage.list.table).toBeVisible();
      await expect(searchFieldPage.addFieldButton).toBeVisible();
      await searchFieldPage.list.assertNoResults();
    });

    test('15.31 — shows the expected column headers', async () => {
      for (const header of SEARCH_FIELD_HEADERS) {
        await searchFieldPage.assertHeaderVisible(header);
      }
    });
  });

  // ─── Search field CRUD (15.32 – 15.42) ──────────────────────────────

  test.describe('Search field management', () => {
    const initialTitle = uniqueSearchFieldTitle('crud');
    const editedTitle = uniqueSearchFieldTitle('crud-edited');

    test('15.32 — opens the Add search field modal', async () => {
      await searchFieldPage.openAddModal();
      await expect(searchFieldPage.titleInput).toBeVisible();
      await searchFieldPage.cancelButton.click();
      await expect(searchFieldPage.addModalHeading).toBeHidden();
    });

    test('15.33-15.40 — creates a search field with all required fields', async () => {
      await searchFieldPage.openAddModal();

      // 15.33 enter title → 15.34 the key auto-generates from the title.
      await searchFieldPage.titleInput.fill(initialTitle);
      await expect(searchFieldPage.keyInput).not.toHaveValue('');

      // 15.35 enter path.
      await searchFieldPage.pathInput.fill(ikoSearchFieldConfig.path);

      // 15.36 data type Text → 15.37 match type Exact → 15.38 field type Single.
      await searchFieldPage.selectDataType(DATA_TYPE_LABELS.text.label);
      await searchFieldPage.selectMatchType(MATCH_TYPE_LABELS.exact.label);
      await searchFieldPage.selectFieldType(FIELD_TYPE_LABELS.single.label);

      // 15.39 toggle required on.
      await searchFieldPage.toggleRequired();
      await expect(searchFieldPage.requiredToggleInput).toBeChecked();

      // 15.40 save.
      await searchFieldPage.save();
      await searchFieldPage.assertFieldVisible(initialTitle);
    });

    test('15.36 — match type is hidden when data type is not Text', async () => {
      await searchFieldPage.openAddModal();
      await searchFieldPage.titleInput.fill(uniqueSearchFieldTitle('bsn'));
      await searchFieldPage.pathInput.fill(ikoSearchFieldConfig.path);

      // Select BSN — match type field should disappear from the form.
      await searchFieldPage.selectDataType(DATA_TYPE_LABELS.bsn.label);
      await expect(searchFieldPage.matchTypeDropdown).toBeHidden();

      await searchFieldPage.cancelButton.click();
      await expect(searchFieldPage.addModalHeading).toBeHidden();
    });

    test('15.41 — edits a search field title', async () => {
      await searchFieldPage.openEditModal(initialTitle);
      await searchFieldPage.titleInput.fill(editedTitle);
      await searchFieldPage.save();
      await searchFieldPage.assertFieldVisible(editedTitle);
      await searchFieldPage.assertFieldNotVisible(initialTitle);
    });

    test('15.42 — deletes a search field via the confirmation dialog', async () => {
      await searchFieldPage.openDeleteDialog(editedTitle);
      await searchFieldPage.confirmDelete();
      await searchFieldPage.assertFieldNotVisible(editedTitle);
    });
  });

  // ─── Failure scenarios ──────────────────────────────────────────────

  test.describe('Failure scenarios', () => {
    test('cannot save a search field with an empty title', async () => {
      await searchFieldPage.openAddModal();
      await expect(searchFieldPage.saveButton).toBeDisabled();
      await searchFieldPage.cancelButton.click();
      await expect(searchFieldPage.addModalHeading).toBeHidden();
    });

    test('cannot save without a path', async () => {
      await searchFieldPage.openAddModal();
      await searchFieldPage.titleInput.fill(uniqueSearchFieldTitle('missing-path'));
      await searchFieldPage.selectDataType(DATA_TYPE_LABELS.text.label);
      await searchFieldPage.selectMatchType(MATCH_TYPE_LABELS.exact.label);
      await searchFieldPage.selectFieldType(FIELD_TYPE_LABELS.single.label);

      // Path is required — save must stay disabled.
      await expect(searchFieldPage.saveButton).toBeDisabled();

      await searchFieldPage.cancelButton.click();
      await expect(searchFieldPage.addModalHeading).toBeHidden();
    });

    test('cannot save without a field type', async () => {
      await searchFieldPage.openAddModal();
      await searchFieldPage.titleInput.fill(uniqueSearchFieldTitle('missing-field-type'));
      await searchFieldPage.pathInput.fill(ikoSearchFieldConfig.path);
      await searchFieldPage.selectDataType(DATA_TYPE_LABELS.text.label);
      await searchFieldPage.selectMatchType(MATCH_TYPE_LABELS.exact.label);

      await expect(searchFieldPage.saveButton).toBeDisabled();

      await searchFieldPage.cancelButton.click();
      await expect(searchFieldPage.addModalHeading).toBeHidden();
    });
  });
});
