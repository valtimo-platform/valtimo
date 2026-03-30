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
    await this.locator.getByRole('menu').locator('button').click();
    await this.page.getByRole('menuitem', {name: actionName}).click();
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
   */
  row(cellText: string): CarbonListRow {
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
   * @param sourceRow - The CarbonListRow to drag
   * @param targetRow - The CarbonListRow to drop onto
   */
  async dragRow(sourceRow: CarbonListRow, targetRow: CarbonListRow) {
    const sourceBounds = await sourceRow.dragHandle.boundingBox();
    const targetBounds = await targetRow.dragHandle.boundingBox();

    if (!sourceBounds || !targetBounds) {
      throw new Error('Could not get bounding boxes for drag source/target');
    }

    await this.page.mouse.move(
      sourceBounds.x + sourceBounds.width / 2,
      sourceBounds.y + sourceBounds.height / 2
    );
    await this.page.mouse.down();
    await this.page.mouse.move(
      targetBounds.x + targetBounds.width / 2,
      targetBounds.y + targetBounds.height / 2,
      {steps: 10}
    );
    await this.page.mouse.up();
  }

  // ─── Loading State ────────────────────────────────────────────────

  async assertLoading() {
    await expect(this.table).toHaveAttribute('skeleton', 'true');
  }

  async assertNotLoading() {
    await expect(this.table).not.toHaveAttribute('skeleton', 'true');
  }
}
