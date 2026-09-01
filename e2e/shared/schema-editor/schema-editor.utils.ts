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

import {expect, type Locator, type Page} from '@playwright/test';
import {
  CONFIRMATION_MODAL_TEST_IDS,
  SCHEMA_EDITOR_REQUIRED_PROPERTY_TEST_ID_PREFIX,
  SCHEMA_EDITOR_TEST_IDS,
} from '../../constants';

/**
 * Wrapper for `valtimo-schema-editor` (`@valtimo/components`), the JSON-schema
 * editor used on the document tabs of case and building block definitions.
 *
 * The editor embeds `vanilla-jsoneditor`, a third-party component whose controls
 * cannot carry `data-test-id` attributes. Those parts (mode switch, search,
 * parse-error panel, tree nodes) are therefore addressed by their accessible
 * name, title or the library's own class names; everything Valtimo owns — the
 * save button, the required-fields panel and its checkboxes — uses test ids.
 */
export class SchemaEditor {
  constructor(private readonly page: Page) {}

  // ─── Root ─────────────────────────────────────────────────────────

  get root(): Locator {
    return this.page.getByTestId(SCHEMA_EDITOR_TEST_IDS.editor);
  }

  get saveButton(): Locator {
    return this.page.getByTestId(SCHEMA_EDITOR_TEST_IDS.saveButton);
  }

  get manageRequiredFieldsButton(): Locator {
    return this.page.getByTestId(SCHEMA_EDITOR_TEST_IDS.manageRequiredFieldsButton);
  }

  get confirmSaveButton(): Locator {
    return this.page.getByTestId(CONFIRMATION_MODAL_TEST_IDS.confirmButton);
  }

  // ─── Tree mode (third-party markup) ───────────────────────────────

  /** Property/attribute names rendered by the tree view. */
  get keys(): Locator {
    return this.root.locator('.jse-key');
  }

  /** Values rendered by the tree view — field types and descriptions included. */
  get values(): Locator {
    return this.root.locator('.jse-value');
  }

  async keyTexts(): Promise<string[]> {
    return (await this.keys.allInnerTexts()).map(text => text.trim());
  }

  async valueTexts(): Promise<string[]> {
    return (await this.values.allInnerTexts()).map(text => text.trim());
  }

  async waitForLoaded() {
    await expect(this.root).toBeVisible();
    await expect(this.keys.first()).toBeVisible();
  }

  // ─── Mode switching ───────────────────────────────────────────────

  async switchToTextMode() {
    await this.root.getByRole('button', {name: 'text', exact: true}).click();
    await expect(this.textContent).toBeVisible();
  }

  async switchToTreeMode() {
    await this.root.getByRole('button', {name: 'tree', exact: true}).click();
    await expect(this.keys.first()).toBeVisible();
  }

  /** The CodeMirror surface of the editor's text mode. */
  get textContent(): Locator {
    return this.root.locator('.cm-content').first();
  }

  // ─── Editing ──────────────────────────────────────────────────────

  /**
   * Replace the whole document with `content` by typing it in text mode.
   *
   * Typing rather than pasting is deliberate: the editor only emits its change
   * event on real input, and a clipboard paste does not reliably reach the
   * CodeMirror instance in headless Chromium.
   */
  async replaceContent(content: unknown) {
    await this.switchToTextMode();
    await this.textContent.click();
    await this.page.keyboard.press('ControlOrMeta+a');
    await this.page.keyboard.type(typeof content === 'string' ? content : JSON.stringify(content));
  }

  /** Save and confirm. Returns nothing — await the API response in the caller. */
  async save() {
    await expect(this.saveButton).toBeEnabled();
    await this.saveButton.click();
    await expect(this.confirmSaveButton).toBeVisible();
    await this.confirmSaveButton.click();
  }

  // ─── Parse errors ─────────────────────────────────────────────────

  /** Panel the embedded editor shows when the text is not parseable JSON. */
  get parseError(): Locator {
    return this.root.locator('.jse-message.jse-error');
  }

  get autoRepairButton(): Locator {
    return this.root.getByRole('button', {name: 'Auto repair'});
  }

  // ─── Search ───────────────────────────────────────────────────────

  get searchBox(): Locator {
    return this.root.locator('.jse-search-box');
  }

  get searchInput(): Locator {
    return this.searchBox.locator('input').first();
  }

  /** Matches highlighted in the tree for the active search term. */
  get searchHighlights(): Locator {
    return this.root.locator('.jse-highlight');
  }

  async openSearch() {
    await this.root.getByTitle(/^Search/).click();
    await expect(this.searchInput).toBeVisible();
  }

  async closeSearch() {
    await this.page.keyboard.press('Escape');
    await expect(this.searchBox).toHaveCount(0);
  }

  async search(term: string) {
    await this.searchInput.fill(term);
  }

  /**
   * The editor's match counter: `"<current>/<total>"` while there are matches and
   * `"0"` when there are none.
   */
  async searchResultCount(): Promise<string> {
    return (await this.searchBox.innerText()).trim();
  }

  // ─── Required fields panel ────────────────────────────────────────

  get requiredFieldsPanel(): Locator {
    return this.page.getByTestId(SCHEMA_EDITOR_TEST_IDS.requiredFieldsPanel);
  }

  get requiredFieldsPanelCloseButton(): Locator {
    return this.page.getByTestId(SCHEMA_EDITOR_TEST_IDS.requiredFieldsPanelCloseButton);
  }

  /**
   * Checkbox of a required field, addressed by its path within the schema:
   * `requiredFieldCheckbox('applicantName')` for a root property,
   * `requiredFieldCheckbox('address', 'street')` for a nested one.
   */
  requiredFieldCheckbox(...path: string[]): Locator {
    return this.page.getByTestId(
      `${SCHEMA_EDITOR_REQUIRED_PROPERTY_TEST_ID_PREFIX}${path.join('.')}`
    );
  }

  async openRequiredFieldsPanel() {
    await this.manageRequiredFieldsButton.click();
    await expect(this.requiredFieldsPanel).toBeVisible();
  }

  async closeRequiredFieldsPanel() {
    await this.requiredFieldsPanelCloseButton.click();
  }

  /** Carbon's `cds-checkbox` only emits `checkedChange` for a click on its label. */
  async toggleRequiredField(...path: string[]) {
    await this.requiredFieldCheckbox(...path)
      .locator('label')
      .click();
  }

  async isRequiredFieldChecked(...path: string[]): Promise<boolean> {
    return this.requiredFieldCheckbox(...path)
      .locator('input')
      .isChecked();
  }

  async assertRequiredFieldChecked(...path: string[]) {
    await expect(this.requiredFieldCheckbox(...path).locator('input')).toBeChecked();
  }

  async assertRequiredFieldNotChecked(...path: string[]) {
    await expect(this.requiredFieldCheckbox(...path).locator('input')).not.toBeChecked();
  }
}
