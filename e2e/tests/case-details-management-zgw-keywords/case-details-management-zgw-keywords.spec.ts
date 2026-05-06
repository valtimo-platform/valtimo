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
import {ensureDraftVersionSelected} from '../../utils/version.utils';
import {CaseDetailsManagementZgwKeywordsPage} from './page';

test.use({storageState: undefined});

const CASE_KEY = 'bezwaar';

const SEED_KEYWORD_A = 'e2e-keyword-alpha';
const SEED_KEYWORD_B = 'e2e-keyword-bravo';
const NEW_KEYWORD = 'e2e-keyword-charlie';
const OVER_LIMIT_VALUE = 'x'.repeat(51);

test.describe('Case details management — ZGW Keywords (6S)', () => {
  let context;
  let page;
  let request;
  let testPage: CaseDetailsManagementZgwKeywordsPage;
  const createdKeywords: string[] = [];

  test.beforeAll(async ({browser, baseURL}) => {
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    request = context.request;
    testPage = new CaseDetailsManagementZgwKeywordsPage(page, request);

    // Remove any residue from a previous run
    for (const v of [SEED_KEYWORD_A, SEED_KEYWORD_B, NEW_KEYWORD]) {
      await testPage.deleteKeywordViaApi(CASE_KEY, v);
    }

    await page.goto('/');
    await testPage.goToCaseManagementForCase(CASE_KEY);
    await ensureDraftVersionSelected(page);
    await testPage.openKeywordsTab();
  });

  test.afterAll(async () => {
    for (const v of [...createdKeywords, SEED_KEYWORD_A, SEED_KEYWORD_B, NEW_KEYWORD]) {
      await testPage.deleteKeywordViaApi(CASE_KEY, v);
    }
    await context.close();
  });

  test('6.109 — View keywords: seeded entries appear in the list', async () => {
    // Seed via API so the view test is independent of the add test
    await testPage.createKeywordViaApi(CASE_KEY, SEED_KEYWORD_A);
    createdKeywords.push(SEED_KEYWORD_A);

    // Reload so the carbon list picks up the new data
    await page.reload();
    await ensureDraftVersionSelected(page);
    await testPage.openKeywordsTab();

    await testPage.assertKeywordVisible(SEED_KEYWORD_A);

    const fromApi = await testPage.getKeywords(CASE_KEY);
    expect(fromApi.map(k => k.value)).toContain(SEED_KEYWORD_A);
  });

  test('6.110 — Add a keyword via the modal and verify it appears in the list', async () => {
    await testPage.addKeywordViaUi(NEW_KEYWORD);
    createdKeywords.push(NEW_KEYWORD);

    await testPage.assertKeywordVisible(NEW_KEYWORD);

    const fromApi = await testPage.getKeywords(CASE_KEY);
    expect(fromApi.map(k => k.value)).toContain(NEW_KEYWORD);
  });

  test('6.111 — Search keywords filters the list to the matching row', async () => {
    // Ensure both a matching and a non-matching keyword exist
    if (!(await testPage.getKeywords(CASE_KEY)).some(k => k.value === SEED_KEYWORD_B)) {
      await testPage.createKeywordViaApi(CASE_KEY, SEED_KEYWORD_B);
      createdKeywords.push(SEED_KEYWORD_B);
      await page.reload();
      await ensureDraftVersionSelected(page);
      await testPage.openKeywordsTab();
    }

    await testPage.search(SEED_KEYWORD_B);
    await testPage.assertKeywordVisible(SEED_KEYWORD_B);
    await testPage.assertKeywordNotVisible(SEED_KEYWORD_A);

    // Clear the search and both rows should be visible again
    await testPage.clearSearch();
    await testPage.assertKeywordVisible(SEED_KEYWORD_A);
    await testPage.assertKeywordVisible(SEED_KEYWORD_B);
  });

  test.describe('Failure scenarios', () => {
    test('Submit is disabled when the value is empty (pristine form)', async () => {
      await testPage.openAddModal();
      await testPage.assertModalSubmitDisabled();
      await testPage.cancelModal();
    });

    test('Submit is disabled when the value exceeds the 50-char limit', async () => {
      await testPage.openAddModal();
      await testPage.fillModalValue(OVER_LIMIT_VALUE);
      await testPage.assertModalSubmitDisabled();
      await testPage.cancelModal();
    });
  });
});
