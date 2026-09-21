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

/** Severity order, mirroring `LoggingEventSpecificationHelper.LOG_LEVELS` in the backend. */
export const LOG_LEVELS = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR'];

/** Mirrors `LoggingEventSearchRequest` in `@valtimo/logging`. */
export interface LogEventSearchRequest {
  afterTimestamp?: string;
  beforeTimestamp?: string;
  level?: string;
  likeFormattedMessage?: string;
  properties?: Array<{key: string; value: string}>;
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

  /**
   * Data rows only. The empty state is rendered as a `<tr data-test-id="carbonListNoResults">`
   * inside the same `tbody`, so a plain `tbody tr` locator counts it as a row and never reaches
   * zero — `CarbonList.rows` filters it out.
   */
  get rows() {
    return this.list.rows;
  }

  get noResultsRow() {
    return this.list.noResultsRow;
  }

  get pagination() {
    return this.list.pagination;
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
    await Promise.all([
      this.waitForLogQuery(),
      this.page.getByRole('option', {name: level, exact: true}).click(),
    ]);
    // Confirm the dropdown really took the value before anything asserts on the filtered list
    await expect(this.levelDropdown).toContainText(level);
    await this.list.waitForLoaded();
  }

  /**
   * Clears the search panel. Like the other filter controls, clearing re-queries asynchronously,
   * so waiting only on the skeleton would leave the previous (possibly empty) result set on
   * screen. If the panel was already clean no request is fired, hence the tolerated timeout.
   */
  async clearSearch() {
    await Promise.all([this.waitForLogQuery(), this.clearSearchButton.click()]);
    await this.list.waitForLoaded();
  }

  /** Resolves on the next successful logging query, or after the timeout if none is fired. */
  private async waitForLogQuery(timeout = 15_000) {
    return this.page
      .waitForResponse(res => res.url().includes('/api/management/v1/logging') && res.ok(), {
        timeout,
      })
      .catch(() => undefined);
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
    const headers = (await this.page.locator('valtimo-carbon-list thead th').allInnerTexts()).map(
      h => h.trim()
    );
    for (const header of expected) expect(headers).toContain(header);
  }

  // The filter panel re-queries asynchronously and the table re-renders after the response has
  // already landed, so both assertions below poll instead of reading a single snapshot of the DOM.

  /** Every visible message cell contains `text` (case-insensitive). */
  async assertAllMessagesContain(text: string) {
    await expect
      .poll(
        async () => {
          const messages = await this.messageCells();
          const needle = text.toLowerCase();
          return messages.length > 0 && messages.every(m => m.toLowerCase().includes(needle));
        },
        {
          timeout: 15_000,
          message: `expected every visible log message to contain "${text}"`,
        }
      )
      .toBe(true);
  }

  /**
   * Every visible row is logged at `level` **or more severe**. The level dropdown is a minimum,
   * not an exact match: the backend filters with `byMinimumLevel`, which keeps every level from
   * the selected one upwards (see `LoggingEventSpecificationHelper.LOG_LEVELS`). Selecting WARN
   * therefore legitimately still lists ERROR rows.
   */
  async assertAllLevelsAreAtLeast(level: string) {
    const minimum = LOG_LEVELS.indexOf(level);
    expect(minimum, `unknown log level ${level}`).toBeGreaterThanOrEqual(0);

    await expect
      .poll(
        async () => {
          const levels = await this.levelCells();
          return levels.length > 0 && levels.every(value => LOG_LEVELS.indexOf(value) >= minimum);
        },
        {
          timeout: 15_000,
          message: `expected every visible log row to be logged at ${level} or more severe`,
        }
      )
      .toBe(true);
  }

  // Both readers take the whole column in one call. Counting the rows and then indexing into
  // them row by row races with the table re-rendering after a filter change: the row that was
  // counted can be detached by the time it is read.

  /** Text of the message column (third column) for every visible row. */
  async messageCells(): Promise<string[]> {
    return this.columnCells(3);
  }

  /** Text of the log level column (second column) for every visible row. */
  async levelCells(): Promise<string[]> {
    return this.columnCells(2);
  }

  private async columnCells(nthChild: number): Promise<string[]> {
    const cells = await this.rows.locator(`td:nth-child(${nthChild})`).allInnerTexts();
    return cells.map(cell => cell.trim());
  }

  // ─── API ──────────────────────────────────────────────────────────

  /**
   * The logging endpoint is a POST — the search criteria travel in the body while paging stays in
   * the query string. Only POST is granted to ADMIN (see `LoggingHttpSecurityConfigurer`), so a
   * GET on the same path returns 403.
   */
  async getLogsViaApi(size = 10, page = 0, search: LogEventSearchRequest = {}) {
    return ApiUtils.apiPost<LogEventPage>(
      `/api/management/v1/logging?size=${size}&page=${page}`,
      search
    );
  }
}
