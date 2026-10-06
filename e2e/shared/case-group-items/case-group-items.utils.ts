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

import {expect, Locator, Page, Response} from '@playwright/test';
import {
  AUTO_KEY_INPUT_TEST_IDS,
  CASE_DEFINITION_GROUP_ITEM_LIST_TEST_IDS,
  CASE_DEFINITION_GROUP_ITEM_MODAL_TEST_IDS,
  CASE_DEFINITION_GROUP_PATH_MAPPING_TEST_IDS,
} from '../../constants';
import {fillStable, openAndSelectOption} from '../../utils/ui.utils';
import {fillValuePathManually} from '../../utils/value-path-selector.utils';
import {GROUP_MANAGEMENT_ENDPOINT} from '../../utils/case-group.utils';

export type GroupItemResource = 'list-column' | 'search-field';

/**
 * The List columns and Search fields tabs of a case group render the same table: search, add,
 * drag-to-reorder rows, an expandable row with the per-case paths and an Edit/Delete menu.
 */
export class GroupItemList {
  constructor(
    private readonly page: Page,
    private readonly groupKey: string,
    private readonly resource: GroupItemResource
  ) {}

  get searchInput(): Locator {
    return this.page.getByTestId(CASE_DEFINITION_GROUP_ITEM_LIST_TEST_IDS.search).locator('input');
  }

  get addButton(): Locator {
    return this.page.getByTestId(CASE_DEFINITION_GROUP_ITEM_LIST_TEST_IDS.addButton);
  }

  get rows(): Locator {
    return this.page.getByTestId(CASE_DEFINITION_GROUP_ITEM_LIST_TEST_IDS.row);
  }

  /** Row whose Key cell equals `key` exactly, so `name` never matches `name-2`. */
  row(key: string): Locator {
    return this.rows.filter({has: this.page.getByRole('cell', {name: key, exact: true})});
  }

  get emptyRow(): Locator {
    return this.page.getByTestId(CASE_DEFINITION_GROUP_ITEM_LIST_TEST_IDS.emptyRow);
  }

  get expandedRow(): Locator {
    return this.page.getByTestId(CASE_DEFINITION_GROUP_ITEM_LIST_TEST_IDS.expandedRow);
  }

  get pathMappings(): Locator {
    return this.expandedRow.getByTestId(CASE_DEFINITION_GROUP_PATH_MAPPING_TEST_IDS.mapping);
  }

  /** Text of the Key column per row, in display order. */
  async keys(): Promise<string[]> {
    const count = await this.rows.count();
    const keys: string[] = [];
    for (let index = 0; index < count; index++) {
      keys.push((await this.rows.nth(index).getByRole('cell').nth(3).innerText()).trim());
    }
    return keys;
  }

  cell(key: string, columnIndex: number): Locator {
    return this.row(key).getByRole('cell').nth(columnIndex);
  }

  async toggleExpand(key: string) {
    await this.row(key).getByTestId(CASE_DEFINITION_GROUP_ITEM_LIST_TEST_IDS.expandButton).click();
  }

  expandButton(key: string): Locator {
    return this.row(key).getByTestId(CASE_DEFINITION_GROUP_ITEM_LIST_TEST_IDS.expandButton);
  }

  async openActions(key: string) {
    await this.row(key).getByTestId(CASE_DEFINITION_GROUP_ITEM_LIST_TEST_IDS.overflowMenu).click();
  }

  async openEdit(key: string) {
    await this.openActions(key);
    await this.page.getByTestId(CASE_DEFINITION_GROUP_ITEM_LIST_TEST_IDS.editOption).click();
  }

  /** Deletes a row; there is no confirmation, the whole list is saved straight away. */
  async delete(key: string): Promise<unknown[]> {
    await this.openActions(key);
    const response = await this.waitForSave(() =>
      this.page.getByTestId(CASE_DEFINITION_GROUP_ITEM_LIST_TEST_IDS.deleteOption).click()
    );
    return response.request().postDataJSON();
  }

  /** Drags the row with `sourceKey` onto the row with `targetKey` and waits for the save. */
  async drag(sourceKey: string, targetKey: string): Promise<unknown[]> {
    const handle = this.row(sourceKey).getByTestId(
      CASE_DEFINITION_GROUP_ITEM_LIST_TEST_IDS.dragHandle
    );
    const target = this.row(targetKey);
    const response = await this.waitForSave(async () => {
      const from = await handle.boundingBox();
      const to = await target.boundingBox();
      if (!from || !to) throw new Error('Drag source or target not visible');
      await this.page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
      await this.page.mouse.down();
      // cdkDrag needs a few intermediate moves before it starts dragging
      const startY = from.y + from.height / 2;
      const endY = to.y + to.height * (to.y < from.y ? 0.25 : 0.75);
      const steps = 10;
      for (let step = 1; step <= steps; step++) {
        await this.page.mouse.move(
          from.x + from.width / 2,
          startY + ((endY - startY) * step) / steps,
          {
            steps: 2,
          }
        );
      }
      await this.page.mouse.up();
    });
    return response.request().postDataJSON();
  }

  waitForSave(action: () => Promise<unknown>): Promise<Response> {
    return Promise.all([
      this.page.waitForResponse(
        res =>
          res.request().method() === 'PUT' &&
          new URL(res.url()).pathname ===
            `${GROUP_MANAGEMENT_ENDPOINT}/${this.groupKey}/${this.resource}`
      ),
      action(),
    ]).then(([response]) => response);
  }
}

/** The add/edit modal shared by list columns and search fields. */
export class GroupItemModal {
  constructor(private readonly page: Page) {}

  get modal(): Locator {
    return this.page.getByTestId(CASE_DEFINITION_GROUP_ITEM_MODAL_TEST_IDS.modal);
  }

  get heading(): Locator {
    return this.modal.getByRole('heading', {level: 3});
  }

  get titleInput(): Locator {
    return this.modal.getByTestId(CASE_DEFINITION_GROUP_ITEM_MODAL_TEST_IDS.titleInput);
  }

  get keyInput(): Locator {
    return this.modal.getByTestId(AUTO_KEY_INPUT_TEST_IDS.input);
  }

  get keyEditButton(): Locator {
    return this.modal.getByTestId(AUTO_KEY_INPUT_TEST_IDS.editButton);
  }

  get pathSearch(): Locator {
    return this.modal.getByTestId(CASE_DEFINITION_GROUP_ITEM_MODAL_TEST_IDS.pathSearch);
  }

  get pathCounter(): Locator {
    return this.modal.getByTestId(CASE_DEFINITION_GROUP_ITEM_MODAL_TEST_IDS.pathCounter);
  }

  get showOnlyEmptyCheckbox(): Locator {
    return this.modal.getByTestId(CASE_DEFINITION_GROUP_ITEM_MODAL_TEST_IDS.showOnlyEmptyCheckbox);
  }

  get pathRows(): Locator {
    return this.modal.getByTestId(CASE_DEFINITION_GROUP_ITEM_MODAL_TEST_IDS.pathRow);
  }

  pathRow(caseDefinitionKey: string): Locator {
    return this.pathRows.filter({hasText: `(${caseDefinitionKey})`});
  }

  get noMatchingCaseTypes(): Locator {
    return this.modal.getByTestId(CASE_DEFINITION_GROUP_ITEM_MODAL_TEST_IDS.noMatchingCaseTypes);
  }

  get saveButton(): Locator {
    return this.modal.getByTestId(CASE_DEFINITION_GROUP_ITEM_MODAL_TEST_IDS.saveButton);
  }

  get cancelButton(): Locator {
    return this.modal.getByTestId(CASE_DEFINITION_GROUP_ITEM_MODAL_TEST_IDS.cancelButton);
  }

  get duplicateKeyError(): Locator {
    return this.modal.getByText('This key is already in use. Please change to a unique key.');
  }

  async waitForOpen() {
    await expect(this.titleInput).toBeVisible();
  }

  async fillTitle(title: string) {
    await fillStable(this.titleInput, title);
  }

  async typeKey(key: string) {
    // The pencil turns into a close button once key editing is on
    if (await this.keyEditButton.isVisible()) await this.keyEditButton.click();
    await fillStable(this.keyInput, key);
    await this.keyInput.blur();
  }

  async fillPath(caseDefinitionKey: string, path: string) {
    await fillValuePathManually(this.pathRow(caseDefinitionKey), path);
  }

  async toggleShowOnlyEmpty() {
    await this.showOnlyEmptyCheckbox.click();
  }

  /** Picks an option in one of the modal's Carbon dropdowns (test id on the `cds-dropdown`). */
  async selectDropdownOption(dropdown: Locator, option: string) {
    await openAndSelectOption(
      dropdown.getByRole('button').first(),
      this.page.getByRole('option', {name: option, exact: true})
    );
    await expect(dropdown.getByRole('button').first()).toContainText(option);
  }

  async dropdownOptions(dropdown: Locator): Promise<string[]> {
    await dropdown.getByRole('button').first().click();
    const options = this.page.getByRole('option');
    await expect(options.first()).toBeVisible();
    const names = (await options.allInnerTexts()).map(name => name.trim());
    await this.page.keyboard.press('Escape');
    return names;
  }
}
