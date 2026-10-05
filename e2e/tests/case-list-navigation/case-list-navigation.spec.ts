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

import {BrowserContext, expect, Page, test} from '@playwright/test';
import {CASE_LIST_NAVIGATION_CONFIG as CONFIG} from './case-list-navigation-config';
import {CaseListNavigationPage} from './page';

test.describe.configure({mode: 'serial'});

test.describe('Case list navigation', () => {
  let context: BrowserContext;
  let page: Page;
  let navigationPage: CaseListNavigationPage;
  const createdCaseIds: string[] = [];
  const firstNames = Array.from(
    {length: CONFIG.caseCount},
    (_, index) => `${CONFIG.marker} ${String(index + 1).padStart(2, '0')}`
  );
  // the list sorts newest first by default, so the last case created is on the first page
  const newestFirstName = firstNames[firstNames.length - 1];
  let firstNameOnPageTwo: string;

  test.beforeAll(async ({browser, baseURL}) => {
    context = await browser.newContext({baseURL, storageState: 'playwright/.auth/uiState.json'});
    page = await context.newPage();
    navigationPage = new CaseListNavigationPage(page);

    await navigationPage.setOpenCasesInNewTabViaApi(false);
    await navigationPage.createSearchFieldViaApi();
    for (const firstName of firstNames) {
      createdCaseIds.push(await navigationPage.createCaseViaApi(firstName));
    }
  });

  test.afterAll(async () => {
    await navigationPage.setOpenCasesInNewTabViaApi(false).catch(() => undefined);
    for (const documentId of createdCaseIds) {
      await navigationPage.deleteCaseViaApi(documentId);
    }
    await navigationPage.deleteSearchFieldViaApi();
    await context.close();
  });

  test('the breadcrumb restores the filters, sorting and page of the case list', async () => {
    test.slow();
    await navigationPage.goToCaseList();

    await navigationPage.deselectStatus(CONFIG.excludedStatus);
    await navigationPage.selectAssigneeTab(CONFIG.assigneeTab);
    await navigationPage.advancedSearch(CONFIG.marker);
    await navigationPage.globalSearch(CONFIG.marker);
    await navigationPage.sortBy(CONFIG.sortColumn);
    const firstNameOnPageOne = await navigationPage.firstNameInFirstRow();
    await navigationPage.goToPage(2);
    await expect(navigationPage.caseRow(firstNameOnPageOne)).toHaveCount(0);
    firstNameOnPageTwo = await navigationPage.firstNameInFirstRow();
    const listParams = new URL(page.url()).searchParams;

    await navigationPage.openCase(firstNameOnPageTwo);
    await navigationPage.openDetailTab(CONFIG.otherDetailTab);
    await navigationPage.caseListBreadcrumb.click();
    await page.waitForURL(new RegExp(`/cases/${CONFIG.caseDefinitionKey}\\?`));
    await navigationPage.caseList.waitForLoaded();

    const restoredParams = new URL(page.url()).searchParams;
    for (const key of ['status', 'assignee', 'search', 'globalSearch', 'page', 'sortStateName']) {
      expect(restoredParams.get(key), key).toBe(listParams.get(key));
    }
    await expect(navigationPage.caseRow(firstNameOnPageTwo)).toBeVisible();
    await expect(navigationPage.caseRow(firstNameOnPageOne)).toHaveCount(0);
    await expect(navigationPage.currentPageSelect).toHaveValue('2');
    await expect(navigationPage.caseList.searchInput).toHaveValue(CONFIG.marker);
    await expect(navigationPage.assigneeTab(CONFIG.assigneeTab)).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await navigationPage.openSearchPanel();
    await expect(navigationPage.advancedSearchInput).toHaveValue(CONFIG.marker);
    expect(await navigationPage.statusSelected(CONFIG.excludedStatus)).toBe(false);
  });

  test('the case list menu item opens a clean case list', async () => {
    await navigationPage.openCase(firstNameOnPageTwo);
    await navigationPage.openCaseListMenuItem();

    const params = new URL(page.url()).searchParams;
    expect(params.get('globalSearch')).toBeNull();
    expect(params.get('search')).toBeNull();
    expect(params.get('page')).toBe('1');
    expect(params.get('sortStateName')).toBe('createdOn');
    await expect(navigationPage.caseList.searchInput).toHaveValue('');
    expect(await navigationPage.statusSelected(CONFIG.excludedStatus)).toBe(true);
  });

  test('a case opens in the same tab by default', async () => {
    await navigationPage.goToCaseList();
    await navigationPage.caseList.search(CONFIG.marker);
    await expect(navigationPage.caseRow(newestFirstName)).toBeVisible({timeout: 15_000});
    const pagesBefore = context.pages().length;

    await navigationPage.openCase(newestFirstName);

    expect(context.pages().length).toBe(pagesBefore);
  });

  test('ctrl/cmd-click and middle-click open a case in a new tab', async () => {
    for (const click of [{modifiers: ['ControlOrMeta' as const]}, {button: 'middle' as const}]) {
      await navigationPage.goToCaseList();
      await navigationPage.caseList.search(CONFIG.marker);
      const cell = navigationPage
        .caseRow(newestFirstName)
        .locator('td', {hasText: newestFirstName});
      await expect(cell).toBeVisible({timeout: 15_000});

      const [newTab] = await Promise.all([context.waitForEvent('page'), cell.click(click)]);
      await navigationPage.waitForCaseDetail(newTab);
      await newTab.close();
      await expect(page).toHaveURL(new RegExp(`/cases/${CONFIG.caseDefinitionKey}\\?`));
    }
  });

  test('with the new-tab setting on, a plain click opens a case in a new tab', async () => {
    await navigationPage.goToCaseList();
    await navigationPage.setOpenCasesInNewTab(true);

    const freshPage = await context.newPage();
    const freshNavigationPage = new CaseListNavigationPage(freshPage);
    await freshNavigationPage.goToCaseList();
    await freshNavigationPage.openSettings();
    await freshNavigationPage.openCasesInNewTabToggle.assertChecked(true);
    await freshPage.close();

    await navigationPage.caseList.search(CONFIG.marker);
    const cell = navigationPage.caseRow(newestFirstName).locator('td', {hasText: newestFirstName});
    await expect(cell).toBeVisible({timeout: 15_000});
    const [newTab] = await Promise.all([context.waitForEvent('page'), cell.click()]);
    await navigationPage.waitForCaseDetail(newTab);
    await newTab.close();
    await expect(page).toHaveURL(new RegExp(`/cases/${CONFIG.caseDefinitionKey}\\?`));

    await navigationPage.setOpenCasesInNewTab(false);
  });
});
