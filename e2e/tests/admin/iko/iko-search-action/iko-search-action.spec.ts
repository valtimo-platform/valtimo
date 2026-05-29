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
import {IkoSearchActionPage} from './page';
import {
  IKO_SEARCH_ACTION_TITLE_PREFIX,
  uniqueSearchActionTitle,
} from './iko-search-action-config';

test.use({storageState: undefined});

test.describe('Feature 15C — IKO Search Actions', () => {
  let context: BrowserContext;
  let page: Page;
  let ikoServerPage: IkoServerPage;
  let ikoViewPage: IkoViewPage;
  let searchActionPage: IkoSearchActionPage;
  let parentServerKey: string;
  let parentViewKey: string;

  test.beforeAll(async ({browser, baseURL}: {browser: Browser; baseURL?: string}) => {
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    ikoServerPage = new IkoServerPage(page, context.request);
    ikoViewPage = new IkoViewPage(page, context.request);
    searchActionPage = new IkoSearchActionPage(page, context.request);

    // Every search action lives under a view that lives under a server. Both
    // parents are created via the API to keep this suite focused on actions.
    const parentServerTitle = uniqueServerTitle('search-action-suite');
    parentServerKey = await ikoServerPage.createServerViaApi(
      parentServerTitle,
      ikoServerConfig.serverUrl
    );

    const parentViewTitle = `E2E IKO View search-action-suite-parent`;
    parentViewKey = await ikoViewPage.createViewViaApi(parentServerKey, parentViewTitle);

    await page.goto('/');
    await searchActionPage.goToSearchActionsTab(parentServerKey, parentViewKey);
  });

  test.afterAll(async () => {
    // Actions → view → server. Children first.
    await searchActionPage.cleanupTestActionsViaApi(parentViewKey, IKO_SEARCH_ACTION_TITLE_PREFIX);
    await ikoViewPage.deleteViewViaApi(parentViewKey);
    await ikoServerPage.cleanupTestServersViaApi(IKO_SERVER_TITLE_PREFIX);
    await context.close();
  });

  // Guard against tests that fail mid-modal — leaving a stuck modal would
  // poison every subsequent test in this serial run.
  test.afterEach(async () => {
    await searchActionPage.closeAnyOpenModal();
  });

  // ─── Search actions tab & list (15.24 – 15.25) ──────────────────────

  test.describe('Search actions tab', () => {
    test('15.24 — displays the search actions tab with the list and add button', async () => {
      await expect(searchActionPage.list.table).toBeVisible();
      await expect(searchActionPage.addActionButton).toBeVisible();
    });

    test('15.25 — shows the search actions list (empty by default)', async () => {
      await searchActionPage.list.assertNoResults();
    });
  });

  // ─── Search action CRUD (15.26 – 15.30) ─────────────────────────────

  test.describe('Search action management', () => {
    const initialTitle = uniqueSearchActionTitle('crud');
    let createdKey: string;

    test('15.26-15.28 — creates a search action with title and auto-key', async () => {
      await searchActionPage.openAddModal();

      // 15.27 enter title → 15.28 the key auto-generates from the title.
      await searchActionPage.titleInput.fill(initialTitle);
      await expect(searchActionPage.keyInput).not.toHaveValue('');
      createdKey = await searchActionPage.keyInput.inputValue();

      // 15.26 save.
      await searchActionPage.save();
      await searchActionPage.assertActionVisible(initialTitle);
    });

    test('15.30 — clicking a search action opens its details page', async () => {
      await searchActionPage.openSearchActionDetails(initialTitle);

      // URL switches to the search-fields page for the action.
      await expect(page).toHaveURL(
        new RegExp(
          `/iko-management/${parentServerKey}/${parentViewKey}/search/search-action/${createdKey}$`
        )
      );

      // The details page renders its own page title with the action's name.
      await expect(
        page.getByRole('heading', {name: `Search action: ${initialTitle}`})
      ).toBeVisible();

      // Return to the search actions tab so subsequent tests can interact
      // with the list again.
      await searchActionPage.goToSearchActionsTab(parentServerKey, parentViewKey);
      await searchActionPage.assertActionVisible(initialTitle);
    });

    test('15.29 — deletes a search action via the confirmation dialog', async () => {
      await searchActionPage.openDeleteDialog(initialTitle);
      await searchActionPage.confirmDelete();
      await searchActionPage.assertActionNotVisible(initialTitle);
    });
  });

  // ─── Failure scenarios ──────────────────────────────────────────────

  test.describe('Failure scenarios', () => {
    test('cannot save a search action with an empty title', async () => {
      await searchActionPage.openAddModal();
      await expect(searchActionPage.saveButton).toBeDisabled();
      await searchActionPage.cancelButton.click();
      await expect(searchActionPage.addModalHeading).toBeHidden();
    });
  });
});
