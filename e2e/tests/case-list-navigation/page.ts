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

import {expect, Locator, Page} from '@playwright/test';
import {
  RIGHT_SIDEBAR_TEST_IDS,
  SEARCH_FIELD_TEST_ID_PREFIX,
  SEARCH_FIELDS_TEST_IDS,
} from '../../constants';
import {CarbonList} from '../../shared/carbon-list/carbon-list.utils';
import {CarbonToggle} from '../../shared/carbon-toggle/carbon-toggle.utils';
import {apiDelete, apiPost, apiPut} from '../../utils/api.utils';
import {CASE_LIST_NAVIGATION_CONFIG as CONFIG} from './case-list-navigation-config';

export class CaseListNavigationPage {
  constructor(private readonly page: Page) {}

  // ─── API helpers ─────────────────────────────────────────────────

  async createCaseViaApi(firstName: string): Promise<string> {
    const response = await apiPost<{document: {id: string}}>(CONFIG.processDocumentEndpoint, {
      processDefinitionKey: CONFIG.processDefinitionKey,
      request: {
        definition: CONFIG.caseDefinitionKey,
        caseDefinitionKey: CONFIG.caseDefinitionKey,
        caseDefinitionVersionTag: CONFIG.caseDefinitionVersionTag,
        content: {firstName, lastName: CONFIG.marker},
      },
    });
    return response.document.id;
  }

  async deleteCaseViaApi(documentId: string) {
    try {
      await apiDelete(`${CONFIG.documentEndpoint}/${documentId}`);
    } catch {
      // Already deleted
    }
  }

  async createSearchFieldViaApi() {
    await this.deleteSearchFieldViaApi();
    await apiPost(CONFIG.searchFieldEndpoint, {
      key: CONFIG.searchField.key,
      title: CONFIG.searchField.title,
      path: CONFIG.searchField.path,
      dataType: 'text',
      fieldType: 'single',
      matchType: 'like',
    });
  }

  async deleteSearchFieldViaApi() {
    try {
      await apiDelete(`${CONFIG.searchFieldEndpoint}?key=${CONFIG.searchField.key}`);
    } catch {
      // Did not exist
    }
  }

  async setOpenCasesInNewTabViaApi(openCasesInNewTab: boolean) {
    await apiPut(CONFIG.userSettingsEndpoint, {openCasesInNewTab});
  }

  // ─── Case list ───────────────────────────────────────────────────

  get caseList(): CarbonList {
    return new CarbonList(this.page);
  }

  async goToCaseList() {
    await this.page.goto(`/cases/${CONFIG.caseDefinitionKey}`);
    await this.page.waitForURL(new RegExp(`/cases/${CONFIG.caseDefinitionKey}(\\?|$)`));
    await this.caseList.waitForLoaded();
  }

  caseRow(firstName: string): Locator {
    return this.caseList.rows.filter({has: this.page.locator('td', {hasText: firstName})});
  }

  async selectAssigneeTab(tabName: string) {
    const tab = this.assigneeTab(tabName);
    await expect(async () => {
      await tab.click({timeout: 5_000});
      await expect(tab).toHaveAttribute('aria-selected', 'true', {timeout: 3_000});
    }).toPass({timeout: 25_000});
    await this.caseList.waitForLoaded();
  }

  assigneeTab(tabName: string): Locator {
    return this.page
      .locator('valtimo-case-list-tabs')
      .getByRole('tab', {name: tabName, exact: true});
  }

  get searchAccordionButton(): Locator {
    return this.page.getByTestId(SEARCH_FIELDS_TEST_IDS.accordionItem).locator('button').first();
  }

  get advancedSearchInput(): Locator {
    return this.page
      .getByTestId(`${SEARCH_FIELD_TEST_ID_PREFIX}${CONFIG.searchField.key}`)
      .locator('input');
  }

  async openSearchPanel() {
    await expect(async () => {
      if ((await this.searchAccordionButton.getAttribute('aria-expanded')) !== 'true') {
        await this.searchAccordionButton.click();
      }
      await expect(this.advancedSearchInput).toBeVisible({timeout: 3_000});
    }).toPass({timeout: 20_000});
  }

  async advancedSearch(value: string) {
    await this.openSearchPanel();
    await this.advancedSearchInput.fill(value);
    await this.page.getByTestId(SEARCH_FIELDS_TEST_IDS.searchButton).click();
    await this.caseList.waitForLoaded();
  }

  get statusSelectorTrigger(): Locator {
    return this.page.locator('valtimo-status-selector cds-dropdown .cds--list-box__field').first();
  }

  statusOption(name: string): Locator {
    return this.page.getByRole('listbox').getByRole('option', {name});
  }

  async deselectStatus(name: string) {
    await this.openSearchPanel();
    await this.statusSelectorTrigger.click();
    await expect(this.statusOption(name)).toHaveAttribute('aria-selected', 'true');
    await this.statusOption(name).click();
    await expect(this.statusOption(name)).toHaveAttribute('aria-selected', 'false');
    await this.page.keyboard.press('Escape');
    await this.caseList.waitForLoaded();
  }

  async statusSelected(name: string): Promise<boolean> {
    await this.openSearchPanel();
    await this.statusSelectorTrigger.click();
    const selected = (await this.statusOption(name).getAttribute('aria-selected')) === 'true';
    await this.page.keyboard.press('Escape');
    return selected;
  }

  async globalSearch(value: string) {
    await this.caseList.search(value);
    await expect(this.page).toHaveURL(new RegExp(`globalSearch=${value}`), {timeout: 15_000});
    await this.caseList.waitForLoaded();
  }

  async sortBy(columnName: string) {
    await this.caseList.table
      .locator('thead th')
      .filter({hasText: columnName})
      .locator('button')
      .click();
    await expect(this.page).toHaveURL(/sortStateName=firstName/);
    await this.caseList.waitForLoaded();
  }

  get currentPageSelect(): Locator {
    return this.caseList.pagination.locator('select').last();
  }

  async goToPage(pageNumber: number) {
    await this.currentPageSelect.selectOption(String(pageNumber));
    await expect(this.page).toHaveURL(new RegExp(`[?&]page=${pageNumber}(&|$)`));
    await this.caseList.waitForLoaded();
  }

  async firstNameInFirstRow(): Promise<string> {
    const cell = this.caseList.rows.first().locator('td', {hasText: CONFIG.marker}).first();
    return (await cell.innerText()).trim();
  }

  // ─── Case detail ─────────────────────────────────────────────────

  async openCase(firstName: string) {
    await this.caseRow(firstName).locator('td', {hasText: firstName}).click();
    await this.waitForCaseDetail();
  }

  async waitForCaseDetail(page: Page = this.page) {
    await page.waitForURL(new RegExp(`/cases/${CONFIG.caseDefinitionKey}/document/`));
    await expect(page.locator('cds-tabs.case-detail-tabs')).toBeVisible({timeout: 30_000});
  }

  async openDetailTab(name: string) {
    await this.page.locator('cds-tabs.case-detail-tabs').getByRole('tab', {name}).click();
    await expect(this.page).toHaveURL(new RegExp(`/document/[^/]+/${name.toLowerCase()}`));
  }

  get caseListBreadcrumb(): Locator {
    return this.page
      .locator('valtimo-breadcrumb-navigation')
      .getByRole('link', {name: CONFIG.caseDefinitionTitle, exact: true});
  }

  async openCaseListMenuItem() {
    const nav = this.page.getByRole('navigation', {name: 'Side navigation'});
    // the menu item shows the number of open cases after the title
    const menuItem = nav.getByRole('link', {
      name: new RegExp(`^${CONFIG.caseDefinitionTitle}( \\d+)?$`),
    });
    if (!(await menuItem.isVisible()))
      await nav.getByRole('button', {name: 'Cases', exact: true}).click();
    await menuItem.click();
    await this.page.waitForURL(new RegExp(`/cases/${CONFIG.caseDefinitionKey}(\\?|$)`));
    await this.caseList.waitForLoaded();
  }

  // ─── Profile settings ────────────────────────────────────────────

  get openCasesInNewTabToggle(): CarbonToggle {
    return new CarbonToggle(this.page.getByTestId(RIGHT_SIDEBAR_TEST_IDS.openCasesInNewTabToggle));
  }

  async openSettings() {
    await this.page
      .getByRole('tab', {name: 'Settings'})
      .evaluate(el => (el as HTMLElement).click());
    await expect(
      this.page.getByTestId(RIGHT_SIDEBAR_TEST_IDS.openCasesInNewTabToggle)
    ).toBeAttached();
  }

  async setOpenCasesInNewTab(openCasesInNewTab: boolean) {
    await this.openSettings();
    const saved = this.page.waitForResponse(
      response =>
        response.url().endsWith(CONFIG.userSettingsEndpoint) &&
        response.request().method() === 'PUT'
    );
    await this.openCasesInNewTabToggle.switchControl.evaluate(el => (el as HTMLElement).click());
    await this.openCasesInNewTabToggle.assertChecked(openCasesInNewTab);
    await saved;
  }
}
