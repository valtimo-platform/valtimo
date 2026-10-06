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
  CASE_LIST_TOOLBAR_TEST_IDS,
  CONFIRMATION_MODAL_TEST_IDS,
  QUICK_SEARCH_TEST_IDS,
  SEARCH_FIELD_TEST_ID_PREFIX,
  SEARCH_FIELDS_TEST_IDS,
  STATUS_SELECTOR_TEST_IDS,
} from '../../constants';
import {CarbonList} from '../../shared/carbon-list/carbon-list.utils';
import {fillStable} from '../../utils/ui.utils';
import {GROUP_USER_ENDPOINT} from '../../utils/case-group.utils';

export class GroupCaseListPage {
  readonly list: CarbonList;

  constructor(private readonly page: Page) {
    this.list = new CarbonList(page);
  }

  async goTo(groupKey: string) {
    await this.page.goto(`/groups/${groupKey}`);
    await this.page.waitForURL(new RegExp(`/groups/${groupKey}(\\?|$)`));
    await this.list.waitForLoaded();
  }

  get heading(): Locator {
    return this.page.getByRole('heading', {level: 2});
  }

  assigneeTab(name: string): Locator {
    return this.page.getByRole('tab', {name, exact: true});
  }

  get startCaseButton(): Locator {
    return this.page.getByTestId(CASE_LIST_TOOLBAR_TEST_IDS.startCaseButton);
  }

  get exportButton(): Locator {
    return this.page.getByTestId(CASE_LIST_TOOLBAR_TEST_IDS.exportButton);
  }

  get pageSizeSelect(): Locator {
    return this.page.getByRole('combobox', {name: 'Cases per page'});
  }

  /** Cell texts of one column (0 = selection checkbox), in display order. */
  async columnValues(columnIndex: number): Promise<string[]> {
    const count = await this.list.rows.count();
    const values: string[] = [];
    for (let index = 0; index < count; index++) {
      values.push(
        (await this.list.rows.nth(index).getByRole('cell').nth(columnIndex).innerText()).trim()
      );
    }
    return values;
  }

  columnHeader(name: string): Locator {
    return this.page.getByRole('columnheader', {name: new RegExp(`^${name}`)});
  }

  // ─── Search panel ─────────────────────────────────────────────────

  get searchPanel(): Locator {
    return this.page.getByTestId(SEARCH_FIELDS_TEST_IDS.accordionItem);
  }

  searchFieldInput(key: string): Locator {
    return this.page.getByTestId(`${SEARCH_FIELD_TEST_ID_PREFIX}${key}`).getByRole('textbox');
  }

  get searchButton(): Locator {
    return this.page.getByTestId(SEARCH_FIELDS_TEST_IDS.searchButton);
  }

  get clearSearchButton(): Locator {
    return this.page.getByTestId(SEARCH_FIELDS_TEST_IDS.clearButton);
  }

  get saveSearchButton(): Locator {
    return this.page.getByTestId(SEARCH_FIELDS_TEST_IDS.saveButton);
  }

  async openSearchPanel() {
    if (await this.searchButton.isVisible()) return;
    await this.searchPanel.getByRole('button', {name: 'Search'}).first().click();
    await expect(this.searchButton).toBeVisible();
  }

  async searchFor(fieldKey: string, value: string) {
    await this.openSearchPanel();
    await fillStable(this.searchFieldInput(fieldKey), value);
    await Promise.all([this.waitForSearch(), this.searchButton.click()]);
    await this.list.waitForLoaded();
  }

  waitForSearch() {
    return this.page.waitForResponse(
      res =>
        res.request().method() === 'POST' &&
        new URL(res.url()).pathname.startsWith(GROUP_USER_ENDPOINT) &&
        new URL(res.url()).pathname.endsWith('/search')
    );
  }

  // ─── Status filter ────────────────────────────────────────────────

  get statusDropdown(): Locator {
    return this.page.getByTestId(STATUS_SELECTOR_TEST_IDS.dropdown);
  }

  get statusOptions(): Locator {
    return this.page.getByRole('listbox').getByRole('option');
  }

  async openStatusDropdown() {
    await this.openSearchPanel();
    if (!(await this.statusOptions.first().isVisible())) {
      await this.statusDropdown.getByRole('button').first().click();
    }
    await expect(this.statusOptions.first()).toBeVisible();
  }

  async statusOptionTexts(): Promise<string[]> {
    await this.openStatusDropdown();
    return (await this.statusOptions.allInnerTexts()).map(text => text.trim()).filter(Boolean);
  }

  async closeStatusDropdown() {
    await this.page.keyboard.press('Escape');
    await expect(this.statusOptions.first()).toBeHidden();
  }

  // ─── Quick search ─────────────────────────────────────────────────

  quickSearchItem(title: string): Locator {
    return this.page.getByTestId(QUICK_SEARCH_TEST_IDS.item).filter({hasText: title});
  }

  async saveCurrentSearch(title: string) {
    await this.saveSearchButton.click();
    const modal = this.page.getByTestId(QUICK_SEARCH_TEST_IDS.modal);
    await fillStable(modal.getByTestId(QUICK_SEARCH_TEST_IDS.titleInput), title);
    await Promise.all([
      this.page.waitForResponse(
        res => res.request().method() === 'POST' && res.url().includes('/stored-quick-search')
      ),
      modal.getByTestId(QUICK_SEARCH_TEST_IDS.saveButton).click(),
    ]);
    await expect(modal.getByTestId(QUICK_SEARCH_TEST_IDS.titleInput)).toBeHidden();
  }

  async deleteQuickSearch(title: string) {
    await this.quickSearchItem(title).click({button: 'right'});
    await this.page.getByTestId(QUICK_SEARCH_TEST_IDS.deleteOption).click();
    await Promise.all([
      this.page.waitForResponse(
        res => res.request().method() === 'DELETE' && res.url().includes('/stored-quick-search/')
      ),
      this.page
        .getByTestId(CONFIRMATION_MODAL_TEST_IDS.confirmButton)
        .filter({visible: true})
        .click(),
    ]);
  }
}
