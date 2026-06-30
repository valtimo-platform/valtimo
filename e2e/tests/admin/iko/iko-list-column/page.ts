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

import {APIRequestContext, expect, Locator, Page} from '@playwright/test';
import {CarbonList, CarbonListRow} from '../../../../shared/carbon-list/carbon-list.utils';
import {settleModalReset} from '../../../../shared/modal/modal.utils';
import {
  AUTO_KEY_INPUT_TEST_IDS,
  CONFIRMATION_MODAL_TEST_IDS,
  IKO_COLUMN_MODAL_TEST_IDS,
  IKO_LIST_MANAGEMENT_TEST_IDS,
} from '../../../../constants';
import {apiDelete, apiGet} from '../../../../utils/api.utils';
import {
  COLUMN_DISPLAY_TYPES,
  COLUMN_SORT_LABELS,
  ikoListColumnConfig,
} from './iko-list-column-config';

interface ListColumnDto {
  key: string;
  title?: string;
  path: string;
  displayType: {type: string; displayTypeParameters: Record<string, unknown>};
  sortable: boolean;
  defaultSort?: 'ASC' | 'DESC';
  order: number;
}

export class IkoListColumnPage {
  constructor(
    private readonly page: Page,
    private readonly request: APIRequestContext
  ) {}

  // ─── List page ──────────────────────────────────────────────────────

  get list(): CarbonList {
    return new CarbonList(this.page);
  }

  get addColumnButton(): Locator {
    return this.list.toolbar.getByTestId(IKO_LIST_MANAGEMENT_TEST_IDS.addColumnButton);
  }

  // ─── Column modal ───────────────────────────────────────────────────

  get addModalHeading(): Locator {
    return this.page.getByRole('heading', {name: 'Add Column'});
  }

  get editModalHeading(): Locator {
    return this.page.getByRole('heading', {name: 'Edit column'});
  }

  get titleInput(): Locator {
    return this.page.getByTestId(IKO_COLUMN_MODAL_TEST_IDS.titleInput);
  }

  get keyInput(): Locator {
    return this.page.getByTestId(AUTO_KEY_INPUT_TEST_IDS.input);
  }

  get pathInput(): Locator {
    return this.page.getByTestId(IKO_COLUMN_MODAL_TEST_IDS.pathInput);
  }

  /**
   * Carbon's toggle renders two things side by side: a zero-size
   * `<button role="switch">` (the focusable / form-bound element) and a
   * `<label>` containing the visible pill. The button itself has no
   * clickable surface, so we click the appearance element instead.
   */
  get sortableToggleClickTarget(): Locator {
    return this.page
      .getByTestId(IKO_COLUMN_MODAL_TEST_IDS.sortableToggle)
      .locator('.cds--toggle__appearance');
  }

  /**
   * The role=switch button is what `toBeChecked` / `toBeDisabled` need
   * (Playwright reads `aria-checked` / `disabled` from this element).
   */
  get sortableToggleInput(): Locator {
    return this.page
      .getByTestId(IKO_COLUMN_MODAL_TEST_IDS.sortableToggle)
      .getByRole('switch');
  }

  get defaultSortComboBox(): Locator {
    return this.page
      .getByTestId(IKO_COLUMN_MODAL_TEST_IDS.defaultSortSelect)
      .locator('cds-combo-box');
  }

  get displayTypeComboBox(): Locator {
    return this.page
      .getByTestId(IKO_COLUMN_MODAL_TEST_IDS.displayTypeSelect)
      .locator('cds-combo-box');
  }

  get saveButton(): Locator {
    return this.page.getByTestId(IKO_COLUMN_MODAL_TEST_IDS.saveButton);
  }

  get cancelButton(): Locator {
    return this.page.getByTestId(IKO_COLUMN_MODAL_TEST_IDS.cancelButton);
  }

  /**
   * Best-effort dismissal of any open column modal. Safe to call in
   * `afterEach`: if no modal is open, this is a no-op.
   */
  async closeAnyOpenModal(): Promise<void> {
    for (const heading of [this.addModalHeading, this.editModalHeading]) {
      if (await heading.isVisible().catch(() => false)) {
        await this.cancelButton.click().catch(() => undefined);
        await heading.waitFor({state: 'hidden', timeout: 5_000}).catch(() => undefined);
      }
    }
  }

  // ─── Delete confirmation modal ──────────────────────────────────────

  get confirmDeleteButton(): Locator {
    return this.page.getByTestId(CONFIRMATION_MODAL_TEST_IDS.confirmButton);
  }

  // ─── Navigation ─────────────────────────────────────────────────────

  /** Navigate directly to the List tab of a given view under a given server. */
  async goToListTab(apiKey: string, viewKey: string): Promise<void> {
    await this.page.goto(`/iko-management/${apiKey}/${viewKey}/list`);
    await this.list.waitForLoaded();
  }

  // ─── Actions ────────────────────────────────────────────────────────

  async openAddModal(): Promise<void> {
    await this.addColumnButton.click();
    await expect(this.addModalHeading).toBeVisible();
    // Let a previous modal's deferred form reset fire before filling.
    await settleModalReset(this.page);
  }

  async openEditModal(title: string): Promise<void> {
    await this.list.row(title).clickAction('Edit');
    await expect(this.editModalHeading).toBeVisible();
    // Let a previous modal's deferred form reset fire before filling.
    await settleModalReset(this.page);
  }

  /** Click a v-select combo box and pick the option whose label matches `label`. */
  private async selectComboItem(combo: Locator, label: string): Promise<void> {
    await combo.click();
    await this.page.getByRole('listbox').getByText(label, {exact: true}).click();
  }

  async selectDisplayType(label: string): Promise<void> {
    await this.selectComboItem(this.displayTypeComboBox, label);
  }

  async selectDefaultSort(label: string): Promise<void> {
    await this.selectComboItem(this.defaultSortComboBox, label);
  }

  /** Toggle the "Sortable" switch by clicking the visible pill area. */
  async toggleSortable(): Promise<void> {
    await this.sortableToggleClickTarget.click();
  }

  async save(): Promise<void> {
    await expect(this.saveButton).toBeEnabled();
    await this.saveButton.click();
    await expect(this.addModalHeading).toBeHidden();
    await expect(this.editModalHeading).toBeHidden();
  }

  /**
   * Full happy-path creation with `Text` display type. Returns the
   * auto-generated key. The path defaults to the suite's shared example
   * value but can be overridden per call.
   */
  async createColumn(
    title: string,
    options?: {path?: string; displayTypeLabel?: string}
  ): Promise<string> {
    const path = options?.path ?? ikoListColumnConfig.path;
    const displayTypeLabel = options?.displayTypeLabel ?? COLUMN_DISPLAY_TYPES.text.label;

    await this.openAddModal();
    await this.titleInput.fill(title);
    // 15.47 — the key auto-generates from the title.
    await expect(this.keyInput).not.toHaveValue('');
    const key = await this.keyInput.inputValue();

    await this.pathInput.fill(path);
    await this.selectDisplayType(displayTypeLabel);

    await this.save();
    await this.assertColumnVisible(title);
    return key;
  }

  async editColumnTitle(oldTitle: string, newTitle: string): Promise<void> {
    await this.openEditModal(oldTitle);
    await this.titleInput.fill(newTitle);
    await this.save();
  }

  async openDeleteDialog(title: string): Promise<void> {
    await this.list.row(title).clickAction('Delete');
    await expect(this.confirmDeleteButton).toBeVisible();
  }

  async confirmDelete(): Promise<void> {
    await this.confirmDeleteButton.click();
    await expect(this.confirmDeleteButton).toBeHidden();
  }

  async deleteColumn(title: string): Promise<void> {
    await this.openDeleteDialog(title);
    await this.confirmDelete();
    await this.assertColumnNotVisible(title);
  }

  /** Drag the row identified by `sourceTitle` onto the row of `targetTitle`. */
  async reorderColumn(sourceTitle: string, targetTitle: string): Promise<void> {
    const source: CarbonListRow = this.list.row(sourceTitle);
    const target: CarbonListRow = this.list.row(targetTitle);
    await this.list.dragRow(source, target);
  }

  /** Index of the row whose body contains `title`, or -1 if not present. */
  async getColumnRowIndex(title: string): Promise<number> {
    const rows = await this.list.rows.all();
    for (let i = 0; i < rows.length; i++) {
      const text = await rows[i].innerText();
      if (text.includes(title)) return i;
    }
    return -1;
  }

  // ─── Assertions ─────────────────────────────────────────────────────

  async assertColumnVisible(title: string): Promise<void> {
    await this.list.row(title).assertVisible();
  }

  async assertColumnNotVisible(title: string): Promise<void> {
    await this.list.row(title).assertNotVisible();
  }

  async assertHeaderVisible(label: string): Promise<void> {
    await expect(this.list.table.locator('th', {hasText: label}).first()).toBeVisible();
  }

  // ─── API helpers (cleanup) ──────────────────────────────────────────

  async getColumnsViaApi(viewKey: string): Promise<ListColumnDto[]> {
    return apiGet<ListColumnDto[]>(`/api/management/v1/iko-view/${viewKey}/column`);
  }

  async deleteColumnViaApi(viewKey: string, columnKey: string): Promise<void> {
    try {
      await apiDelete(`/api/management/v1/iko-view/${viewKey}/column/${columnKey}`);
    } catch {
      // Column may already be deleted or never created.
    }
  }

  /** Delete every column under `viewKey` whose title starts with the prefix. */
  async cleanupTestColumnsViaApi(viewKey: string, titlePrefix: string): Promise<void> {
    try {
      const columns = await this.getColumnsViaApi(viewKey);
      for (const column of columns) {
        if (column.title?.startsWith(titlePrefix)) {
          await this.deleteColumnViaApi(viewKey, column.key);
        }
      }
    } catch {
      // Listing failed — nothing reliable to clean up.
    }
  }
}

/** Re-exported for the spec's `select.label` references. */
export {COLUMN_DISPLAY_TYPES, COLUMN_SORT_LABELS};
