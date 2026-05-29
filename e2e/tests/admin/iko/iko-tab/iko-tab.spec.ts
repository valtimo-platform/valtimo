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

import {expect, test, type Browser, type BrowserContext, type Page} from '@playwright/test';
import {IkoServerPage} from '../iko-server/page';
import {
  IKO_SERVER_TITLE_PREFIX,
  ikoServerConfig,
  uniqueServerTitle,
} from '../iko-server/iko-server-config';
import {IkoViewPage} from '../iko-view/page';
import {IkoTabPage} from './page';
import {
  IKO_TAB_TITLE_PREFIX,
  TAB_HEADERS,
  TAB_TYPE_LABELS,
  ikoTabConfig,
  uniqueTabTitle,
} from './iko-tab-config';

test.use({storageState: undefined});

test.describe('Feature 15F — IKO Tabs', () => {
  let context: BrowserContext;
  let page: Page;
  let ikoServerPage: IkoServerPage;
  let ikoViewPage: IkoViewPage;
  let tabPage: IkoTabPage;
  let parentServerKey: string;
  let parentViewKey: string;

  test.beforeAll(async ({browser, baseURL}: {browser: Browser; baseURL?: string}) => {
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    ikoServerPage = new IkoServerPage(page, context.request);
    ikoViewPage = new IkoViewPage(page, context.request);
    tabPage = new IkoTabPage(page, context.request);

    // Every tab lives under a view that lives under a server. Both parents
    // are created via the API to keep this suite focused on tabs.
    const parentServerTitle = uniqueServerTitle('tab-suite');
    parentServerKey = await ikoServerPage.createServerViaApi(
      parentServerTitle,
      ikoServerConfig.serverUrl
    );

    const parentViewTitle = `E2E IKO View tab-suite-parent`;
    parentViewKey = await ikoViewPage.createViewViaApi(parentServerKey, parentViewTitle);

    await page.goto('/');
    await tabPage.goToTabsTab(parentServerKey, parentViewKey);
  });

  test.afterAll(async () => {
    // Tabs → view → server. Children first.
    await tabPage.cleanupTestTabsViaApi(parentViewKey, IKO_TAB_TITLE_PREFIX);
    await ikoViewPage.deleteViewViaApi(parentViewKey);
    await ikoServerPage.cleanupTestServersViaApi(IKO_SERVER_TITLE_PREFIX);
    await context.close();
  });

  // Guard against tests that fail mid-modal — leaving a stuck modal would
  // poison every subsequent test in this serial run.
  test.afterEach(async () => {
    await tabPage.closeAnyOpenModal();
  });

  // ─── Tabs tab & list (15.55 – 15.56) ────────────────────────────────

  test.describe('Tabs tab', () => {
    test('15.55 — displays the tabs tab with the list and add button', async () => {
      await expect(tabPage.list.table).toBeVisible();
      await expect(tabPage.addTabButton).toBeVisible();
    });

    test('15.56 — shows the expected column headers', async () => {
      for (const header of TAB_HEADERS) {
        await tabPage.assertHeaderVisible(header);
      }
    });
  });

  // ─── Tab CRUD (15.57 – 15.64) ───────────────────────────────────────

  test.describe('Tab management', () => {
    const initialTitle = uniqueTabTitle('crud');
    const editedTitle = uniqueTabTitle('crud-edited');

    test('15.57 — opens the Add tab modal', async () => {
      await tabPage.openAddModal();
      await expect(tabPage.titleInput).toBeVisible();
      await tabPage.cancelButton.click();
      await expect(tabPage.addModalHeading).toBeHidden();
    });

    test('15.58-15.62 — creates a tab with title, auto-key, type and data profile name', async () => {
      await tabPage.openAddModal();

      // 15.58 enter title → 15.59 the key auto-generates from the title.
      await tabPage.titleInput.fill(initialTitle);
      await expect(tabPage.keyInput).not.toHaveValue('');

      // 15.60 select tab type.
      await tabPage.selectTabType(TAB_TYPE_LABELS.widgets.label);

      // 15.61 enter aggregated data profile name (optional).
      await tabPage.aggregatedDataProfileNameInput.fill(ikoTabConfig.aggregatedDataProfileName);

      // 15.62 save.
      await tabPage.save();
      await tabPage.assertTabVisible(initialTitle);
    });

    test('15.61 — supports omitting the optional data profile name', async () => {
      const minimalTitle = uniqueTabTitle('minimal');
      await tabPage.createTab(minimalTitle, {aggregatedDataProfileName: null});
      await tabPage.assertTabVisible(minimalTitle);
    });

    test('15.63 — edits a tab title via the row action menu', async () => {
      await tabPage.editTabTitle(initialTitle, editedTitle);
      await tabPage.assertTabVisible(editedTitle);
      await tabPage.assertTabNotVisible(initialTitle);
    });

    test('15.64 — deletes a tab via the confirmation dialog', async () => {
      await tabPage.openDeleteDialog(editedTitle);
      await tabPage.confirmDelete();
      await tabPage.assertTabNotVisible(editedTitle);
    });
  });

  // ─── Failure scenarios ──────────────────────────────────────────────

  test.describe('Failure scenarios', () => {
    test('cannot save a tab with an empty title', async () => {
      await tabPage.openAddModal();
      await expect(tabPage.saveButton).toBeDisabled();
      await tabPage.cancelButton.click();
      await expect(tabPage.addModalHeading).toBeHidden();
    });

    test('cannot save without selecting a tab type', async () => {
      await tabPage.openAddModal();
      await tabPage.titleInput.fill(uniqueTabTitle('missing-type'));

      // Type is required by the form — save must stay disabled.
      await expect(tabPage.saveButton).toBeDisabled();

      await tabPage.cancelButton.click();
      await expect(tabPage.addModalHeading).toBeHidden();
    });

    test('auto-key appends a numeric suffix when the slugified title collides', async () => {
      const duplicateTitle = uniqueTabTitle('dup');
      // Seed the duplicate via the API so the auto-key collides on the next add.
      const duplicateKey = await tabPage.createTabViaApi(parentViewKey, duplicateTitle);
      await tabPage.goToTabsTab(parentServerKey, parentViewKey);
      await tabPage.assertTabVisible(duplicateTitle);

      try {
        await tabPage.openAddModal();
        await tabPage.titleInput.fill(duplicateTitle);

        // Rather than blocking save, the auto-key input rewrites the key to
        // `<base>-1` so the user can still proceed without manual edits.
        await expect(tabPage.keyInput).toHaveValue(`${duplicateKey}-1`);
      } finally {
        await tabPage.deleteTabViaApi(parentViewKey, duplicateKey);
      }
    });
  });
});
