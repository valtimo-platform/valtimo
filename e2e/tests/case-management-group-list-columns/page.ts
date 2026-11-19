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
import {CASE_DEFINITION_GROUP_COLUMN_MODAL_TEST_IDS} from '../../constants';
import {GroupItemList, GroupItemModal} from '../../shared/case-group-items/case-group-items.utils';

export const COLUMN_CELL = {name: 2, key: 3, displayType: 4, sortable: 5} as const;

export class GroupListColumnsPage {
  readonly list: GroupItemList;
  readonly modal: GroupItemModal;

  constructor(
    private readonly page: Page,
    private readonly groupKey: string
  ) {
    this.list = new GroupItemList(page, groupKey, 'list-column');
    this.modal = new GroupItemModal(page);
  }

  async goTo() {
    await this.page.goto(`/case-management/group/${this.groupKey}/list-columns`);
    await expect(this.list.addButton).toBeVisible();
  }

  async openAddModal() {
    await this.list.addButton.click();
    await this.modal.waitForOpen();
  }

  // ─── Column-specific modal fields ─────────────────────────────────

  get displayTypeDropdown(): Locator {
    return this.page.getByTestId(CASE_DEFINITION_GROUP_COLUMN_MODAL_TEST_IDS.displayTypeDropdown);
  }

  get dateFormatInput(): Locator {
    return this.page.getByTestId(CASE_DEFINITION_GROUP_COLUMN_MODAL_TEST_IDS.dateFormatInput);
  }

  get tagAmountInput(): Locator {
    return this.page.getByTestId(CASE_DEFINITION_GROUP_COLUMN_MODAL_TEST_IDS.tagAmountInput);
  }

  get enumInput(): Locator {
    return this.page.getByTestId(CASE_DEFINITION_GROUP_COLUMN_MODAL_TEST_IDS.enumInput);
  }

  get sortableCheckbox(): Locator {
    return this.page.getByTestId(CASE_DEFINITION_GROUP_COLUMN_MODAL_TEST_IDS.sortableCheckbox);
  }

  get sortableInput(): Locator {
    return this.sortableCheckbox.getByRole('checkbox');
  }

  get sortableHint(): Locator {
    return this.page.getByTestId(CASE_DEFINITION_GROUP_COLUMN_MODAL_TEST_IDS.sortableHint);
  }

  get defaultSortDropdown(): Locator {
    return this.page.getByTestId(CASE_DEFINITION_GROUP_COLUMN_MODAL_TEST_IDS.defaultSortDropdown);
  }

  get defaultSortButton(): Locator {
    return this.defaultSortDropdown.getByRole('button').first();
  }

  async selectDisplayType(type: string) {
    await this.modal.selectDropdownOption(this.displayTypeDropdown, type);
  }

  async checkSortable() {
    await expect(this.sortableInput).toBeEnabled();
    if (!(await this.sortableInput.isChecked())) await this.sortableCheckbox.click();
    await expect(this.sortableInput).toBeChecked();
  }

  async selectDefaultSort(direction: 'Ascending' | 'Descending') {
    await this.modal.selectDropdownOption(this.defaultSortDropdown, direction);
  }

  /** Saves the modal and returns the full column list that was sent. */
  async save(): Promise<Array<Record<string, unknown>>> {
    const response = await this.list.waitForSave(() => this.modal.saveButton.click());
    expect(response.ok()).toBeTruthy();
    await expect(this.modal.modal).toBeHidden();
    return response.request().postDataJSON();
  }
}
