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

import {APIRequestContext, expect, Page} from '@playwright/test';
import {CarbonList} from '../../shared/carbon-list/carbon-list.utils';
import {LOG_DETAILS_TEST_IDS, LOG_SEARCH_TEST_IDS, LOGGING_LIST_TEST_IDS} from '../../constants';
import * as ApiUtils from '../../utils/api.utils';

export interface LogEventPage {
  content: Array<{formattedMessage: string; level: string; timestamp: string}>;
  totalElements: number;
}

export class LoggingPage {
  constructor(
    private readonly page: Page,
    private readonly request: APIRequestContext
  ) {}

  // ─── Navigation ───────────────────────────────────────────────────

  async goToLogging() {
    await this.page.goto('/logging');
    await this.page.waitForSelector('valtimo-carbon-list');
    await this.list.waitForLoaded();
  }

  // ─── List ─────────────────────────────────────────────────────────

  get list() {
    return new CarbonList(this.page);
  }

  get logList() {
    return this.page.locator('valtimo-carbon-list');
  }

  get rows() {
    return this.page.locator('valtimo-carbon-list tbody tr');
  }

  get pagination() {
    return this.page.getByTestId('carbonListPagination');
  }

  // ─── Search panel ─────────────────────────────────────────────────
  //
  // The search panel lives behind a funnel button in the table toolbar and applies itself on
  // change (debounced 500ms) — there is no submit button.

  get filterButton() {
    return this.page.getByTestId(LOGGING_LIST_TEST_IDS.filterButton);
  }

  get searchPanel() {
    return this.page.locator('valtimo-log-search');
  }

  get messageInput() {
    return this.page.getByTestId(LOG_SEARCH_TEST_IDS.messageInput);
  }

  get levelDropdown() {
    return this.page.getByTestId(LOG_SEARCH_TEST_IDS.levelDropdown);
  }

  get propertyKeyInput() {
    return this.page.getByTestId(LOG_SEARCH_TEST_IDS.propertyKeyInput).first();
  }

  get propertyValueInput() {
    return this.page.getByTestId(LOG_SEARCH_TEST_IDS.propertyValueInput).first();
  }

  get addPropertyButton() {
    return this.page.getByTestId(LOG_SEARCH_TEST_IDS.addPropertyButton);
  }

  get clearSearchButton() {
    return this.page.getByTestId(LOG_SEARCH_TEST_IDS.clearButton);
  }

  async openSearchPanel() {
    await this.filterButton.click();
    await expect(this.messageInput).toBeVisible();
  }

  /**
   * Types into the message filter and waits for the resulting request. The panel debounces for
   * 500ms and then re-queries, so waiting on the response is more reliable than a fixed delay.
   */
  async filterByMessage(text: string) {
    await Promise.all([
      this.page.waitForResponse(
        res => res.url().includes('/api/management/v1/logging') && res.ok(),
        {timeout: 15_000}
      ),
      this.messageInput.fill(text),
    ]);
    await this.list.waitForLoaded();
  }

  async selectLevel(level: string) {
    await this.levelDropdown.click();
    await this.page.getByRole('option', {name: level, exact: true}).click();
    await this.list.waitForLoaded();
  }

  async clearSearch() {
    await this.clearSearchButton.click();
    await this.list.waitForLoaded();
  }

  // ─── Details modal ────────────────────────────────────────────────

  get detailsModal() {
    return this.page.locator('.cds--modal.is-visible');
  }

  get detailsMessage() {
    return this.page.getByTestId(LOG_DETAILS_TEST_IDS.message);
  }

  get detailsTimestamp() {
    return this.page.getByTestId(LOG_DETAILS_TEST_IDS.timestamp);
  }

  async openLogDetails(rowIndex = 0) {
    await this.rows.nth(rowIndex).click();
    await expect(this.detailsMessage).toBeVisible();
  }

  async closeLogDetails() {
    await this.detailsModal.locator('button.cds--modal-close').click();
    await expect(this.detailsModal).toHaveCount(0);
  }

  // ─── Assertions ───────────────────────────────────────────────────

  async assertColumnHeaders(expected: string[]) {
    const headers = (await this.page.locator('valtimo-carbon-list thead th').allInnerTexts()).map(h =>
      h.trim()
    );
    for (const header of expected) expect(headers).toContain(header);
  }

  /** Every visible message cell contains `text` (case-insensitive). */
  async assertAllMessagesContain(text: string) {
    const messages = await this.messageCells();
    expect(messages.length).toBeGreaterThan(0);
    for (const message of messages) {
      expect(message.toLowerCase()).toContain(text.toLowerCase());
    }
  }

  async assertAllLevelsAre(level: string) {
    const levels = (await this.page.locator('valtimo-carbon-list tbody tr td').nth(1).allInnerTexts())
      .map(l => l.trim())
      .filter(Boolean);
    for (const value of levels) expect(value).toBe(level);
  }

  /** Text of the message column (third column) for every visible row. */
  async messageCells(): Promise<string[]> {
    const count = await this.rows.count();
    const messages: string[] = [];
    for (let i = 0; i < count; i++) {
      messages.push((await this.rows.nth(i).locator('td').nth(2).innerText()).trim());
    }
    return messages;
  }

  async levelCells(): Promise<string[]> {
    const count = await this.rows.count();
    const levels: string[] = [];
    for (let i = 0; i < count; i++) {
      levels.push((await this.rows.nth(i).locator('td').nth(1).innerText()).trim());
    }
    return levels;
  }

  // ─── API ──────────────────────────────────────────────────────────

  async getLogsViaApi(size = 10, page = 0): Promise<LogEventPage> {
    return ApiUtils.apiGet<LogEventPage>(`/api/management/v1/logging?size=${size}&page=${page}`);
  }
}
