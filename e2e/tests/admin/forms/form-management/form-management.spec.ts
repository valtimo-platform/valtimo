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
import {FormManagementPage} from './page';

const KNOWN_FORM_EDIT = 'boom.editform';
const KNOWN_FORM_SUMMARY = 'boom.summary';
const EDIT_SEARCH_TERM = 'editform';
const NO_MATCH_SEARCH_TERM = 'zz-form-that-does-not-exist-xyz';

test.use({storageState: undefined});

test.describe('Form management — Forms list', () => {
  let context;
  let page;
  let request;
  let formManagementPage: FormManagementPage;

  test.beforeAll(async ({browser, baseURL}) => {
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    request = context.request;

    formManagementPage = new FormManagementPage(page, request);

    await page.goto('/');
    await formManagementPage.goToFormManagement();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test.describe('6.50 — View forms list', () => {
    test('Forms list is visible and loaded', async () => {
      await formManagementPage.assertListLoaded();
    });

    test('Forms list contains at least one form', async () => {
      const rowCount = await formManagementPage.carbonList.rows.count();
      expect(rowCount).toBeGreaterThan(0);
    });

    test('Forms list shows the seeded independent forms', async () => {
      await formManagementPage.assertFormVisible(KNOWN_FORM_EDIT);
      await formManagementPage.assertFormVisible(KNOWN_FORM_SUMMARY);
    });
  });

  test.describe('6.51 — Search / filter forms', () => {
    test.afterEach(async () => {
      await formManagementPage.carbonList.clearSearch();
      await formManagementPage.carbonList.waitForLoaded();
    });

    test('Search narrows the list to matching forms and hides non-matches', async () => {
      await formManagementPage.carbonList.search(EDIT_SEARCH_TERM);
      await formManagementPage.carbonList.waitForLoaded();

      await formManagementPage.assertFormVisible(KNOWN_FORM_EDIT);
      await formManagementPage.assertFormNotVisible(KNOWN_FORM_SUMMARY);
    });

    test('Clearing the search restores the full list', async () => {
      await formManagementPage.carbonList.search(EDIT_SEARCH_TERM);
      await formManagementPage.carbonList.waitForLoaded();
      await formManagementPage.assertFormNotVisible(KNOWN_FORM_SUMMARY);

      await formManagementPage.carbonList.clearSearch();
      await formManagementPage.carbonList.waitForLoaded();

      await formManagementPage.assertFormVisible(KNOWN_FORM_SUMMARY);
    });

    test.describe('Failure scenarios', () => {
      test('Search with no matches shows the no-results row', async () => {
        await formManagementPage.carbonList.search(NO_MATCH_SEARCH_TERM);
        await formManagementPage.carbonList.waitForLoaded();
        await formManagementPage.carbonList.assertNoResults();
      });
    });
  });
});
