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
import {LoggingPage} from './page';

test.use({storageState: undefined});

test.describe.configure({mode: 'serial'});

/**
 * Covers the `/logging` admin page. The page is read-only: it lists log events the running
 * application produced, so there is nothing to create or clean up. The filter panel applies
 * itself on change (debounced) rather than via a submit button.
 */
test.describe('Logging', () => {
  let context;
  let page;
  let loggingPage: LoggingPage;

  test.beforeAll(async ({browser, baseURL}) => {
    context = await browser.newContext({baseURL});
    page = await context.newPage();

    loggingPage = new LoggingPage(page, context.request);

    await page.goto('/');
    await loggingPage.goToLogging();
  });

  test.afterAll(async () => {
    // Nothing to clean up — the page only reads log events.
    if (context) await context.close();
  });

  // ─── 18.1 View application logs ───────────────────────────────────

  test.describe('18.1 — View application logs', () => {
    test('Log list is visible with log entries', async () => {
      await expect(loggingPage.logList).toBeVisible();
      expect(await loggingPage.rows.count()).toBeGreaterThan(0);
    });

    test('List shows the Timestamp, Log level and Message columns', async () => {
      await loggingPage.assertColumnHeaders(['Timestamp', 'Log level', 'Message']);
    });

    test('List is paginated', async () => {
      await expect(loggingPage.pagination).toBeVisible();
    });

    test('Row count matches the page size requested from the API', async () => {
      const apiPage = await loggingPage.getLogsViaApi(10, 0);
      expect(apiPage.content.length).toBeGreaterThan(0);
      expect(await loggingPage.rows.count()).toBe(apiPage.content.length);
    });

    test('Opening a row shows the log details', async () => {
      const messages = await loggingPage.messageCells();

      // Act
      await loggingPage.openLogDetails(0);

      // Assert — the details modal shows the same entry, plus its timestamp
      await expect(loggingPage.detailsMessage).toBeVisible();
      await expect(loggingPage.detailsTimestamp).not.toHaveText('-');
      const detailMessage = (await loggingPage.detailsMessage.innerText()).trim();
      expect(detailMessage.length).toBeGreaterThan(0);
      // The list truncates long messages, so compare on a prefix
      expect(messages[0].startsWith(detailMessage.slice(0, 20))).toBeTruthy();

      await loggingPage.closeLogDetails();
    });
  });

  // ─── 18.2 Filter/search logs ──────────────────────────────────────

  test.describe('18.2 — Filter and search logs', () => {
    test('Filter by message text narrows the list', async () => {
      test.setTimeout(60_000);

      // Arrange — pick a word from an existing entry so the filter is guaranteed to match
      const messages = await loggingPage.messageCells();
      const searchTerm = messages
        .flatMap(m => m.split(/\s+/))
        .find(word => word.length > 5 && /^[A-Za-z]+$/.test(word));
      expect(searchTerm, 'no suitable search term found in the visible log messages').toBeTruthy();

      // Act
      await loggingPage.openSearchPanel();
      await loggingPage.filterByMessage(searchTerm!);

      // Assert — every remaining row matches the filter
      await loggingPage.assertAllMessagesContain(searchTerm!);
    });

    test('Clearing the filter restores the unfiltered list', async () => {
      // Act
      await loggingPage.clearSearch();

      // Assert — the message filter is empty again and rows are listed
      await expect(loggingPage.messageInput).toHaveValue('');
      expect(await loggingPage.rows.count()).toBeGreaterThan(0);
    });

    test('Filter by log level narrows the list to that level and above', async () => {
      test.setTimeout(60_000);

      // Arrange — WARN sits in the middle of the severity scale, so filtering on it has to drop
      // something (INFO/DEBUG/TRACE) while keeping ERROR
      const unfiltered = await loggingPage.getLogsViaApi(1, 0);

      // Act
      await loggingPage.selectLevel('WARN');

      // Assert — the dropdown is a *minimum* level, so WARN and ERROR both belong in the result
      await loggingPage.assertAllLevelsAreAtLeast('WARN');

      const filtered = await loggingPage.getLogsViaApi(1, 0, {level: 'WARN'});
      expect(filtered.totalElements).toBeLessThan(unfiltered.totalElements);

      await loggingPage.clearSearch();
    });
  });

  // ─── Failure scenarios ────────────────────────────────────────────

  test.describe('Failure scenarios', () => {
    test('A filter that matches nothing shows the no-results state', async () => {
      test.setTimeout(60_000);

      // Act — a message no log line can contain
      await loggingPage.filterByMessage('zzz-no-log-line-matches-this-zzz');

      // Assert — no data rows are left and the empty-state row takes their place
      await expect(loggingPage.rows).toHaveCount(0);
      await expect(loggingPage.noResultsRow).toBeVisible();

      await loggingPage.clearSearch();
      expect(await loggingPage.rows.count()).toBeGreaterThan(0);
    });
  });
});
