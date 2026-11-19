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
import {CASE_DEFINITION_GROUP_SEARCH_FIELD_MODAL_TEST_IDS} from '../../constants';
import {GroupItemList, GroupItemModal} from '../../shared/case-group-items/case-group-items.utils';

export const SEARCH_FIELD_CELL = {
  name: 2,
  key: 3,
  dataType: 4,
  fieldType: 5,
  matchType: 6,
} as const;

export class GroupSearchFieldsPage {
  readonly list: GroupItemList;
  readonly modal: GroupItemModal;

  constructor(
    private readonly page: Page,
    private readonly groupKey: string
  ) {
    this.list = new GroupItemList(page, groupKey, 'search-field');
    this.modal = new GroupItemModal(page);
  }

  async goTo() {
    await this.page.goto(`/case-management/group/${this.groupKey}/search-fields`);
    await expect(this.list.addButton).toBeVisible();
  }

  async openAddModal() {
    await this.list.addButton.click();
    await this.modal.waitForOpen();
  }

  get dataTypeDropdown(): Locator {
    return this.page.getByTestId(
      CASE_DEFINITION_GROUP_SEARCH_FIELD_MODAL_TEST_IDS.dataTypeDropdown
    );
  }

  get fieldTypeDropdown(): Locator {
    return this.page.getByTestId(
      CASE_DEFINITION_GROUP_SEARCH_FIELD_MODAL_TEST_IDS.fieldTypeDropdown
    );
  }

  get matchTypeDropdown(): Locator {
    return this.page.getByTestId(
      CASE_DEFINITION_GROUP_SEARCH_FIELD_MODAL_TEST_IDS.matchTypeDropdown
    );
  }

  get dropdownDataProviderInput(): Locator {
    return this.page.getByTestId(
      CASE_DEFINITION_GROUP_SEARCH_FIELD_MODAL_TEST_IDS.dropdownDataProviderInput
    );
  }

  async selectDataType(type: string) {
    await this.modal.selectDropdownOption(this.dataTypeDropdown, type);
  }

  async selectFieldType(type: string) {
    await this.modal.selectDropdownOption(this.fieldTypeDropdown, type);
  }

  async selectMatchType(type: string) {
    await this.modal.selectDropdownOption(this.matchTypeDropdown, type);
  }

  /** Saves the modal and returns the full search field list that was sent. */
  async save(): Promise<Array<Record<string, unknown>>> {
    const response = await this.list.waitForSave(() => this.modal.saveButton.click());
    expect(response.ok()).toBeTruthy();
    await expect(this.modal.modal).toBeHidden();
    return response.request().postDataJSON();
  }
}
