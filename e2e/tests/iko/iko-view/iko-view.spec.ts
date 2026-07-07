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
import {IkoViewPage} from './page';
import {
  IKO_VIEW_PROPERTY_KEYS,
  IKO_VIEW_PROPERTY_TOOLTIPS,
  IKO_VIEW_TITLE_PREFIX,
  ikoViewConfig,
  uniqueViewTitle,
} from './iko-view-config';

test.use({storageState: undefined});

test.describe('Feature 15B — IKO View Management', () => {
  let context: BrowserContext;
  let page: Page;
  let ikoServerPage: IkoServerPage;
  let ikoViewPage: IkoViewPage;
  let parentServerKey: string;

  test.beforeAll(async ({browser, baseURL}: {browser: Browser; baseURL?: string}) => {
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    ikoServerPage = new IkoServerPage(page, context.request);
    ikoViewPage = new IkoViewPage(page, context.request);

    // Every view lives under a parent IKO server. Create it via the API to
    // keep the setup fast and decoupled from the server modal's UI.
    const parentTitle = uniqueServerTitle('view-suite');
    parentServerKey = await ikoServerPage.createServerViaApi(
      parentTitle,
      ikoServerConfig.serverUrl
    );

    await page.goto('/');
    await ikoViewPage.goToServerViews(parentServerKey);
  });

  test.afterAll(async () => {
    // Children first, then the parent server.
    await ikoViewPage.cleanupTestViewsViaApi(parentServerKey, IKO_VIEW_TITLE_PREFIX);
    await ikoServerPage.cleanupTestServersViaApi(IKO_SERVER_TITLE_PREFIX);
    await context.close();
  });

  // ─── Property field tooltips ────────────────────────────────────────

  test.describe('Property field tooltips', () => {
    test.beforeAll(async () => {
      // Open the modal once and reuse it across the tooltip assertions.
      await ikoViewPage.openAddModal();
    });

    test.afterAll(async () => {
      await ikoViewPage.cancelButton.click();
      await expect(ikoViewPage.addModalHeading).toBeHidden();
    });

    for (const [key, expectedText] of Object.entries(IKO_VIEW_PROPERTY_TOOLTIPS)) {
      test(`shows the tooltip for ${key}`, async () => {
        await ikoViewPage.assertTooltip(key, expectedText);
      });
    }
  });

  // ─── View CRUD (15.13 – 15.23) ──────────────────────────────────────

  test.describe('View management', () => {
    const initialTitle = uniqueViewTitle('crud');
    const editedTitle = uniqueViewTitle('crud-edited');

    test('15.13 — displays the views list (empty by default)', async () => {
      await ikoViewPage.list.waitForLoaded();
      await ikoViewPage.list.assertNoResults();
      await expect(ikoViewPage.addViewButton).toBeVisible();
    });

    test('15.14-15.21 — creates a view with title, auto-key and all properties', async () => {
      await ikoViewPage.openAddModal();

      // 15.15 enter title → 15.16 key auto-generates → 15.17 connector
      // reference, 15.18 connector instance ref, 15.19 endpoint reference,
      // 15.20 key-value pair.
      await ikoViewPage.fillViewForm(initialTitle);

      // 15.21 save.
      await ikoViewPage.save();
      await ikoViewPage.assertViewVisible(initialTitle);
    });

    test('15.20 — supports adding and removing key-value pair rows', async () => {
      await ikoViewPage.openAddModal();

      const kvKey = IKO_VIEW_PROPERTY_KEYS.endpointQueryParameters;
      const keys = ikoViewPage.propertyKvKeyAll(kvKey);
      const values = ikoViewPage.propertyKvValueAll(kvKey);
      const removeButtons = ikoViewPage.propertyKvRemoveAll(kvKey);

      // The mandatory first row cannot be removed.
      await expect(keys).toHaveCount(1);
      await expect(removeButtons.first()).toBeDisabled();

      // Add a second row, fill it, then remove it.
      await ikoViewPage.propertyKvAddRowButton(kvKey).click();
      await expect(keys).toHaveCount(2);
      await keys.nth(1).fill('second-key');
      await values.nth(1).fill('second-value');

      await expect(removeButtons.nth(1)).toBeEnabled();
      await removeButtons.nth(1).click();
      await expect(keys).toHaveCount(1);

      await ikoViewPage.cancelButton.click();
      await expect(ikoViewPage.addModalHeading).toBeHidden();
    });

    test('15.22 — edits a view title', async () => {
      await ikoViewPage.editViewTitle(initialTitle, editedTitle);
      await ikoViewPage.assertViewVisible(editedTitle);
      await ikoViewPage.assertViewNotVisible(initialTitle);
    });

    test('15.23 — deletes a view via the confirmation dialog', async () => {
      await ikoViewPage.openDeleteDialog(editedTitle);
      await ikoViewPage.confirmDelete();
      await ikoViewPage.assertViewNotVisible(editedTitle);
    });
  });

  // ─── Failure scenarios ──────────────────────────────────────────────

  test.describe('Failure scenarios', () => {
    test('cannot save a view with an empty title', async () => {
      await ikoViewPage.openAddModal();
      await expect(ikoViewPage.saveButton).toBeDisabled();
      await ikoViewPage.cancelButton.click();
      await expect(ikoViewPage.addModalHeading).toBeHidden();
    });

    test('cannot save a view when a required property field is empty', async () => {
      await ikoViewPage.openAddModal();
      await ikoViewPage.titleInput.fill(uniqueViewTitle('missing-prop'));

      // Fill everything except the Connector Reference — save must stay disabled.
      await ikoViewPage
        .propertyInput(IKO_VIEW_PROPERTY_KEYS.connectorInstanceTag)
        .fill(ikoViewConfig.connectorInstanceTag);
      await ikoViewPage
        .propertyInput(IKO_VIEW_PROPERTY_KEYS.endpointOperation)
        .fill(ikoViewConfig.endpointOperation);
      await ikoViewPage
        .propertyKvKey(IKO_VIEW_PROPERTY_KEYS.endpointQueryParameters)
        .fill(ikoViewConfig.queryParamKey);
      await ikoViewPage
        .propertyKvValue(IKO_VIEW_PROPERTY_KEYS.endpointQueryParameters)
        .fill(ikoViewConfig.queryParamValue);

      await expect(ikoViewPage.saveButton).toBeDisabled();

      await ikoViewPage.cancelButton.click();
      await expect(ikoViewPage.addModalHeading).toBeHidden();
    });
  });
});
