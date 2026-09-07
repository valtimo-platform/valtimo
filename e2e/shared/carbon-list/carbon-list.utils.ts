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

// ─── CarbonListRow ──────────────────────────────────────────────────

export class CarbonListRow {
  constructor(
    private readonly page: Page,
    private readonly locator: Locator
  ) {}

  // ─── Core ───────────────────────────────────────────────────────

  async click() {
    await this.locator.click();
  }

  /**
   * Locate a cell within this row by its text content. Returns a plain Locator.
   */
  cell(text: string): Locator {
    return this.locator.locator('td', {hasText: text});
  }

  /**
   * Locate a cell within this row by its title attribute. Returns a plain Locator.
   */
  cellByTitle(title: string): Locator {
    return this.locator.locator(`td[title="${title}"]`);
  }

  /**
   * Locate a cell within this row by column index (0-based). Returns a plain Locator.
   */
  cellByIndex(index: number): Locator {
    return this.locator.locator('td').nth(index);
  }

  // ─── Assertions ─────────────────────────────────────────────────

  async assertVisible() {
    await expect(this.locator).toBeVisible();
  }

  async assertNotVisible() {
    await expect(this.locator).not.toBeVisible();
  }

  // ─── Overflow Action Menu ───────────────────────────────────────

  /**
   * Open the overflow action menu on this row, then click the named action.
   * Note: menu items are rendered in a portal/overlay, so we use page-scoped getByRole.
   */
  async clickAction(actionName: string) {
    await this.openActionMenu();
    await this.page.getByRole('menu').getByRole('menuitem', {name: actionName}).click();
  }

  /**
   * Open the overflow action menu without selecting anything — for asserting which actions are
   * offered, and whether they are enabled.
   */
  async openActionMenu() {
    await this.locator.locator('.v-overflow-menu__trigger').click();
    await expect(this.page.getByRole('menu')).toBeVisible();
  }

  /** An item in this row's (already open) overflow menu. */
  actionMenuItem(actionName: string): Locator {
    return this.page.getByRole('menu').getByRole('menuitem', {name: actionName});
  }

  // ─── Selection (Checkboxes) ─────────────────────────────────────

  async select() {
    // Carbon's cds-checkbox uses (checkedChange) not native DOM change.
    // Click the visible cds-checkbox element to trigger the model update.
    await this.locator.locator('td.cds--table-column-checkbox cds-checkbox').click();
  }

  async deselect() {
    await this.locator.locator('td.cds--table-column-checkbox cds-checkbox').click();
  }

  // ─── Move Row Up/Down ───────────────────────────────────────────

  async moveUp() {
    await this.locator.getByTestId('carbonListMoveUp').click();
  }

  async moveDown() {
    await this.locator.getByTestId('carbonListMoveDown').click();
  }

  // ─── Drag and Drop ─────────────────────────────────────────────

  get dragHandle(): Locator {
    return this.locator.getByTestId('carbonListDragHandle');
  }

  // ─── Tags ───────────────────────────────────────────────────────

  get tags(): Locator {
    return this.locator.locator('cds-tag');
  }

  async assertTagCount(expectedCount: number) {
    await expect(this.tags).toHaveCount(expectedCount);
  }

  async clickExpandTags() {
    await this.locator.getByTestId('carbonListExpandTags').click();
  }

  // ─── Locked State ──────────────────────────────────────────────

  async assertLocked() {
    await expect(this.locator.locator('.locked')).toBeVisible();
  }

  async assertNotLocked() {
    await expect(this.locator.locator('.locked')).not.toBeVisible();
  }
}

// ─── CarbonList ─────────────────────────────────────────────────────

export class CarbonList {
  private readonly root: Locator;

  /**
   * @param page - Playwright Page
   * @param scope - Optional parent Locator to scope to a specific valtimo-carbon-list.
   *                If not provided, scopes to the first valtimo-carbon-list on the page.
   */
  constructor(
    private readonly page: Page,
    scope?: Locator
  ) {
    this.root = scope ? scope.locator('valtimo-carbon-list') : page.locator('valtimo-carbon-list');
  }

  // ─── Core Locators ────────────────────────────────────────────────

  get table() {
    return this.root.locator('cds-table');
  }

  get toolbar() {
    return this.root.locator('cds-table-toolbar');
  }

  get searchInput() {
    return this.root.getByTestId('carbonListSearch').locator('input');
  }

  get pagination() {
    return this.root.getByTestId('carbonListPagination');
  }

  get noResultsRow() {
    return this.root.getByTestId('carbonListNoResults');
  }

  get rows() {
    return this.table.locator('tbody tr:not([data-test-id="carbonListNoResults"])');
  }

  // ─── Row Access ───────────────────────────────────────────────────

  /**
   * Get a CarbonListRow scoped to the row containing a cell with the given text.
   *
   * Pass a string for substring matching (default) or a RegExp for exact
   * matching — useful when one row's text is a prefix of another's
   * (e.g. "Bezwaar" vs "Bezwaar ad-hoc FVM"): use `/^Bezwaar$/`.
   */
  row(cellText: string | RegExp): CarbonListRow {
    const locator = this.root.locator('tbody tr').filter({
      has: this.page.locator('td', {hasText: cellText}),
    });
    return new CarbonListRow(this.page, locator);
  }

  // ─── Wait / Readiness ─────────────────────────────────────────────

  async waitForVisible() {
    await this.root.first().waitFor({state: 'visible'});
  }

  async waitForLoaded() {
    await this.root.first().waitFor({state: 'visible'});
    // Wait for skeleton to disappear (if loading)
    await expect(this.table).not.toHaveAttribute('skeleton', 'true', {timeout: 30000});
  }

  // ─── List-Level Assertions ────────────────────────────────────────

  async assertRowCount(expectedCount: number) {
    await expect(this.rows).toHaveCount(expectedCount);
  }

  async assertNoResults() {
    await expect(this.noResultsRow).toBeVisible();
  }

  // ─── Search ───────────────────────────────────────────────────────

  async search(text: string) {
    await this.searchInput.fill(text);
  }

  async clearSearch() {
    await this.searchInput.clear();
  }

  // ─── Pagination ───────────────────────────────────────────────────

  async goToNextPage() {
    await this.pagination.locator('button[aria-label="Next page"]').click();
  }

  async goToPreviousPage() {
    await this.pagination.locator('button[aria-label="Previous page"]').click();
  }

  async setPageSize(size: number) {
    const select = this.pagination.locator('select').first();
    await select.selectOption(String(size));
  }

  async assertCurrentPage(page: number) {
    const pageInput = this.pagination.locator('select').last();
    await expect(pageInput).toHaveValue(String(page));
  }

  // ─── Sorting ──────────────────────────────────────────────────────

  /**
   * Click a column header to toggle sorting.
   * @param columnName - The visible text of the column header.
   */
  async sortByColumn(columnName: string) {
    await this.table.locator('th button', {hasText: columnName}).click();
  }

  /**
   * Assert that a column header shows a specific sort direction.
   * Carbon uses aria-sort on <th> elements.
   */
  async assertColumnSorted(columnName: string, direction: 'ascending' | 'descending' | 'none') {
    const header = this.table.locator(`th:has(button:has-text("${columnName}"))`);
    await expect(header).toHaveAttribute('aria-sort', direction);
  }

  // ─── Row Selection (Bulk) ─────────────────────────────────────────

  async selectAllRows() {
    await this.table.locator('thead input[type="checkbox"]').check();
  }

  async deselectAllRows() {
    await this.table.locator('thead input[type="checkbox"]').uncheck();
  }

  // ─── Drag and Drop ────────────────────────────────────────────────

  /**
   * Drag a row from one position to another using mouse events.
   *
   * The carbon-list drag-and-drop service (carbon-list-drag-and-drop.service.ts)
   * reorders rows live while dragging. On every `document` mousemove it:
   *   1. derives the direction from the Y delta vs. the previous event, and
   *   2. finds the row under the cursor via `document.querySelectorAll(':hover')`.
   * A swap then runs `insertBefore(...)` and is throttled behind a double
   * `requestAnimationFrame` (see `continueSwap`). If the mouse is moved in one
   * fast Playwright hop the intermediate `:hover` states and animation frames
   * never settle, so no swap is registered. We therefore move in small discrete
   * hops with short waits so each `:hover` update and rAF-gated swap can apply.
   *
   * @param sourceRow - The CarbonListRow to drag
   * @param targetRow - The CarbonListRow to drop onto
   */
  async dragRow(sourceRow: CarbonListRow, targetRow: CarbonListRow) {
    const sourceBounds = await sourceRow.dragHandle.boundingBox();
    const targetBounds = await targetRow.dragHandle.boundingBox();

    if (!sourceBounds || !targetBounds) {
      throw new Error('Could not get bounding boxes for drag source/target');
    }

    const sourceX = sourceBounds.x + sourceBounds.width / 2;
    const sourceY = sourceBounds.y + sourceBounds.height / 2;
    const targetY = targetBounds.y + targetBounds.height / 2;
    const movingUp = targetY < sourceY;

    // Use the locator's hover() (not mouse.move) to position over the drag
    // handle: it applies actionability checks and scrolls into view, which
    // reliably delivers the mousedown that starts the drag. A raw mouse.move to
    // computed coordinates does not consistently trigger the handler.
    await sourceRow.dragHandle.hover();
    await this.page.mouse.down();

    // Pause to let the drag-start event initialize and the drag class apply.
    await this.page.waitForTimeout(150);

    // Small initial nudge in the direction of travel to trigger drag recognition
    // and set the correct move direction on the first real move.
    await this.page.mouse.move(sourceX, sourceY + (movingUp ? -3 : 3));
    await this.page.waitForTimeout(50);

    // Incremental hops toward the target. Each hop is followed by a short wait so
    // the browser updates `:hover` and the rAF-gated swap can run before the next.
    const hops = 15;
    for (let i = 1; i <= hops; i++) {
      const y = sourceY + ((targetY - sourceY) * i) / hops;
      await this.page.mouse.move(sourceX, y);
      await this.page.waitForTimeout(30);
    }

    // Settle directly over the target, then a tiny extra move (keeping direction)
    // to guarantee a final `:hover` + swap on the target row.
    await this.page.mouse.move(sourceX, targetY);
    await this.page.waitForTimeout(80);
    await this.page.mouse.move(sourceX, targetY + (movingUp ? -2 : 2));
    await this.page.waitForTimeout(80);

    await this.page.mouse.up();

    // Wait for the UI to process the reorder and persist.
    await this.page.waitForTimeout(400);
  }

  // ─── Loading State ────────────────────────────────────────────────

  async assertLoading() {
    await expect(this.table).toHaveAttribute('skeleton', 'true');
  }

  async assertNotLoading() {
    await expect(this.table).not.toHaveAttribute('skeleton', 'true');
  }
}
