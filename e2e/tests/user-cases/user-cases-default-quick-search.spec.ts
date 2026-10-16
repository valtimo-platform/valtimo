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
import {
  CASE_DEFINITION_KEY,
  CASE_DEFINITION_TITLE,
  DefaultQuickSearchPage,
  defaultQuickSearchApi,
  OTHER_CASE_DEFINITION_KEY,
  OTHER_CASE_DEFINITION_TITLE,
  QuickSearch,
} from './user-cases-default-quick-search';

test.use({storageState: 'playwright/.auth/uiState.json'});

test.describe('Cases (User) — default quick search', () => {
  let quickSearchPage: DefaultQuickSearchPage;
  let previousDefaults: {[caseDefinitionKey: string]: string};
  let otherDefaults: {[caseDefinitionKey: string]: string};
  let newCases: QuickSearch;
  let casesWithoutStatus: QuickSearch;
  let documentId: string;

  test.beforeAll(async () => {
    previousDefaults = await defaultQuickSearchApi.defaultQuickSearchesViaApi();
    otherDefaults = {...previousDefaults};
    delete otherDefaults[CASE_DEFINITION_KEY];

    newCases = await defaultQuickSearchApi.createQuickSearchViaApi(['nieuw']);
    casesWithoutStatus = await defaultQuickSearchApi.createQuickSearchViaApi([
      'CASES_WITHOUT_STATUS_KEY',
    ]);
    documentId = await defaultQuickSearchApi.createCaseViaApi();
  });

  test.beforeEach(async ({page}) => {
    test.slow();
    await defaultQuickSearchApi.setDefaultQuickSearchesViaApi(otherDefaults);
    quickSearchPage = new DefaultQuickSearchPage(page);
  });

  test.afterAll(async () => {
    await defaultQuickSearchApi.deleteQuickSearchViaApi(newCases);
    await defaultQuickSearchApi.deleteQuickSearchViaApi(casesWithoutStatus);
    await defaultQuickSearchApi.deleteCaseViaApi(documentId);
    await defaultQuickSearchApi.setDefaultQuickSearchesViaApi(previousDefaults);
  });

  test('a quick search set as default is marked and opens the case list, also from the menu', async ({
    page,
  }) => {
    await page.goto(`/cases/${CASE_DEFINITION_KEY}`);
    await quickSearchPage.caseList.waitForLoaded();
    await expect(quickSearchPage.defaultIcon(newCases)).toHaveCount(0);

    await quickSearchPage.chooseFromQuickSearchMenu(newCases, 'setAsDefaultOption');

    await expect(quickSearchPage.defaultIcon(newCases)).toBeVisible();
    await expect(quickSearchPage.defaultIcon(casesWithoutStatus)).toHaveCount(0);

    await page.goto(`/cases/${CASE_DEFINITION_KEY}`);
    await quickSearchPage.caseList.waitForLoaded();
    await quickSearchPage.expectStatusFilter(newCases.statuses);

    await quickSearchPage.openCaseListFromMenu(
      OTHER_CASE_DEFINITION_TITLE,
      OTHER_CASE_DEFINITION_KEY
    );
    await expect
      .poll(() => quickSearchPage.statusFilterInAddress())
      .toEqual(
        expect.arrayContaining([
          'aanvraag-ontvangen',
          'in-behandeling',
          'informatieverzoek-uitgezet',
        ])
      );

    await quickSearchPage.openCaseListFromMenu(CASE_DEFINITION_TITLE, CASE_DEFINITION_KEY);
    await quickSearchPage.expectStatusFilter(newCases.statuses);

    await page.goBack();
    await page.waitForURL(new RegExp(`/cases/${OTHER_CASE_DEFINITION_KEY}\\?`));
  });

  test('the active filter is kept when returning from a case', async ({page}) => {
    await page.goto(`/cases/${CASE_DEFINITION_KEY}`);
    await quickSearchPage.caseList.waitForLoaded();
    await quickSearchPage.applyQuickSearch(casesWithoutStatus);

    await quickSearchPage.openFirstCase();
    await quickSearchPage.switchToSecondCaseTab();
    await quickSearchPage.returnThroughBreadcrumb();
    await quickSearchPage.expectStatusFilter(casesWithoutStatus.statuses);

    await quickSearchPage.openFirstCase();
    await quickSearchPage.returnThroughBrowserBack();
    await quickSearchPage.expectStatusFilter(casesWithoutStatus.statuses);

    await quickSearchPage.applyQuickSearch(newCases);
    await quickSearchPage.openCaseThroughBrowserForward();
    await quickSearchPage.returnThroughBreadcrumb();
    await quickSearchPage.expectStatusFilter(newCases.statuses);
  });

  test('without a default the case list opens with all statuses again', async ({page}) => {
    await defaultQuickSearchApi.setDefaultQuickSearchesViaApi({
      ...otherDefaults,
      [CASE_DEFINITION_KEY]: newCases.title,
    });
    await page.goto(`/cases/${CASE_DEFINITION_KEY}`);
    await quickSearchPage.caseList.waitForLoaded();
    await expect(quickSearchPage.defaultIcon(newCases)).toBeVisible();

    await quickSearchPage.chooseFromQuickSearchMenu(newCases, 'removeAsDefaultOption');
    await expect(quickSearchPage.defaultIcon(newCases)).toHaveCount(0);

    await page.goto(`/cases/${CASE_DEFINITION_KEY}`);
    await quickSearchPage.caseList.waitForLoaded();

    await expect
      .poll(() => quickSearchPage.statusFilterInAddress())
      .toEqual(expect.arrayContaining(['nieuw', 'in-behandeling', 'afgehandeld']));
  });
});
