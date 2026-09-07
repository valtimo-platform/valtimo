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

import {expect, Page} from '@playwright/test';
import {
  ARBITRARY_AMOUNT_VALUE_TEST_IDS,
  CONFIRMATION_MODAL_TEST_IDS,
  MULTI_INPUT_TEST_IDS,
  TRANSLATION_MANAGEMENT_TEST_IDS,
} from '../../constants';
import * as ApiUtils from '../../utils/api.utils';

/** One `{languageKey, content}` entry as returned by `/api/v1/localization`. */
export interface Localization {
  languageKey: string;
  content: Record<string, unknown>;
}

/** Column order of the translations table: key first, then one column per language. */
export const KEY_COLUMN = 0;
export const EN_COLUMN = 1;
export const NL_COLUMN = 2;

export class TranslationManagementPage {
  constructor(private readonly page: Page) {}

  // ─── Navigation ───────────────────────────────────────────────────

  async goToTranslationManagement() {
    await this.page.goto('/translation-management');
    await this.rows.first().waitFor({state: 'visible', timeout: 60_000});
  }

  /** Re-reads the page from scratch — used to prove that a save actually persisted. */
  async reload() {
    await this.page.reload();
    await this.rows.first().waitFor({state: 'visible', timeout: 60_000});
  }

  // ─── Table ────────────────────────────────────────────────────────
  //
  // The table is a `valtimo-carbon-multi-input` of type `arbitraryAmount`: every row is a set of
  // plain text inputs (key + one per language) plus a delete button. There is no `<table>`, so
  // rows are addressed by index through their cells' test IDs.

  get rows() {
    return this.page.locator('.v-multi-input__row');
  }

  get addRowButton() {
    return this.page.getByTestId(MULTI_INPUT_TEST_IDS.addButton);
  }

  get saveButton() {
    return this.page.getByTestId(TRANSLATION_MANAGEMENT_TEST_IDS.saveButton);
  }

  /**
   * Column titles. The multi-input renders its `cds-label`s on the first row only, so this
   * doubles as the header row.
   */
  get columnTitles() {
    return this.page.locator('cds-label');
  }

  cell(row: number, column: number) {
    return this.page.getByTestId(ARBITRARY_AMOUNT_VALUE_TEST_IDS.inputAt(row, column));
  }

  deleteRowButton(row: number) {
    return this.page.getByTestId(MULTI_INPUT_TEST_IDS.deleteButtonAt(row));
  }

  async rowCount() {
    return this.rows.count();
  }

  /**
   * Index of the row holding `key`. The backend stores translations in a JSON object, so row
   * order follows the object's key order rather than insertion order — never assume an index.
   */
  async rowIndexForKey(key: string): Promise<number> {
    const total = await this.rowCount();
    for (let row = 0; row < total; row++) {
      if ((await this.cell(row, KEY_COLUMN).inputValue()) === key) return row;
    }
    return -1;
  }

  async keys(): Promise<string[]> {
    const total = await this.rowCount();
    const keys: string[] = [];
    for (let row = 0; row < total; row++) keys.push(await this.cell(row, KEY_COLUMN).inputValue());
    return keys;
  }

  // ─── Editing ──────────────────────────────────────────────────────

  /** Appends a row and returns its index. New rows are always appended last. */
  async addRow(): Promise<number> {
    const before = await this.rowCount();
    await this.addRowButton.click();
    await expect(this.rows).toHaveCount(before + 1);
    return before;
  }

  /**
   * Fills a whole row. The multi-input only treats a row as valid once *every* cell is filled,
   * so a partially filled row leaves Save disabled.
   */
  async fillRow(row: number, values: string[]) {
    for (let column = 0; column < values.length; column++) {
      await this.cell(row, column).fill(values[column]);
    }
    // The Save button reacts to the value stream; give it the tick it needs to settle.
    await expect(this.cell(row, KEY_COLUMN)).toHaveValue(values[KEY_COLUMN]);
  }

  async deleteRow(row: number) {
    const before = await this.rowCount();
    await this.deleteRowButton(row).click();
    await expect(this.rows).toHaveCount(before - 1);
  }

  // ─── Confirmation modal ───────────────────────────────────────────
  //
  // Saving always goes through a confirmation modal offering three outcomes: cancel, save, or
  // save and reload the application.

  get modalHeading() {
    return this.page.getByTestId(CONFIRMATION_MODAL_TEST_IDS.heading);
  }

  get modalContent() {
    return this.page.getByTestId(CONFIRMATION_MODAL_TEST_IDS.content);
  }

  /** "Cancel" — dismisses without saving. */
  get modalCancelButton() {
    return this.page.getByTestId(CONFIRMATION_MODAL_TEST_IDS.closeButton);
  }

  /** "Save" — persists without reloading the application. */
  get modalSaveButton() {
    return this.page.getByTestId(CONFIRMATION_MODAL_TEST_IDS.optionalButton);
  }

  /** "Save and reload" — persists and then reloads the window. */
  get modalSaveAndReloadButton() {
    return this.page.getByTestId(CONFIRMATION_MODAL_TEST_IDS.confirmButton);
  }

  async openSaveModal() {
    await expect(this.saveButton).toBeEnabled();
    await this.saveButton.click();
    await expect(this.modalHeading).toBeVisible();
  }

  async cancelSave() {
    await this.modalCancelButton.click();
    await expect(this.modalHeading).toBeHidden();
  }

  /** Confirms with "Save" and waits for the update request to land. */
  async confirmSave() {
    await Promise.all([this.waitForUpdate(), this.modalSaveButton.click()]);
    await expect(this.modalHeading).toBeHidden();
  }

  /**
   * Confirms with "Save and reload". The component calls `location.reload()` right after the
   * request resolves, so wait for the response first and then for the page to come back.
   */
  async confirmSaveAndReload() {
    await Promise.all([this.waitForUpdate(), this.modalSaveAndReloadButton.click()]);
    await this.rows.first().waitFor({state: 'visible', timeout: 60_000});
  }

  private waitForUpdate() {
    return this.page.waitForResponse(
      res =>
        res.url().includes('/api/management/v1/localization') &&
        res.request().method() === 'PUT' &&
        res.ok(),
      {timeout: 30_000}
    );
  }

  // ─── API ──────────────────────────────────────────────────────────

  async getLocalizationsViaApi(): Promise<Localization[]> {
    return ApiUtils.apiGet<Localization[]>('/api/v1/localization');
  }

  async setLocalizationsViaApi(localizations: Localization[]) {
    await ApiUtils.apiPut('/api/management/v1/localization', localizations);
  }

  /** Translations for `languageKey`, flattened back to dotted keys as the UI shows them. */
  async translationsViaApi(languageKey: string): Promise<Record<string, string>> {
    const localizations = await this.getLocalizationsViaApi();
    const content = localizations.find(l => l.languageKey === languageKey)?.content ?? {};
    return flatten(content);
  }

  /**
   * The stored translation for a single key, or `undefined` when it is absent. Prefer this over
   * asserting on the whole map: translation keys contain dots, which `toHaveProperty` would read
   * as a nested path rather than as one literal key.
   */
  async translationViaApi(languageKey: string, key: string): Promise<string | undefined> {
    return (await this.translationsViaApi(languageKey))[key];
  }

  /**
   * Restores the localizations captured before the suite ran. There is no delete endpoint — the
   * update is an upsert per language key — so restoring means writing the original content back
   * over every language the suite touched.
   */
  async restoreLocalizationsViaApi(original: Localization[], languageKeys: string[]) {
    try {
      await this.setLocalizationsViaApi(
        languageKeys.map(languageKey => ({
          languageKey,
          content: original.find(l => l.languageKey === languageKey)?.content ?? {},
        }))
      );
    } catch {
      // Best effort — a failed restore must not mask a test failure.
    }
  }
}

/** `{a: {b: 'c'}}` → `{'a.b': 'c'}`, matching how the UI flattens nested translations. */
function flatten(object: Record<string, unknown>, prefix = ''): Record<string, string> {
  return Object.entries(object).reduce((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'object' && value !== null
      ? {...acc, ...flatten(value as Record<string, unknown>, path)}
      : {...acc, [path]: value as string};
  }, {});
}
