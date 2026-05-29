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
import {CarbonList} from '../../../../shared/carbon-list/carbon-list.utils';
import {JsonEditor} from '../../../../shared/json-editor/json-editor.utils';
import {settleModalReset} from '../../../../shared/modal/modal.utils';
import {
  AUTO_KEY_INPUT_TEST_IDS,
  WIDGET_DIVIDER_MODAL_TEST_IDS,
  WIDGET_EDITOR_TEST_IDS,
  WIDGET_WIZARD_TEST_IDS,
  WIDGET_WIZARD_TYPE_TEST_IDS,
} from '../../../../constants';
import {apiDelete, apiGet, apiPost, apiPut} from '../../../../utils/api.utils';

interface BasicWidget {
  key: string;
  title?: string | null;
  type: string;
  [k: string]: unknown;
}

export class IkoWidgetPage {
  constructor(
    private readonly page: Page,
    private readonly request: APIRequestContext
  ) {}

  // ─── Widget list ────────────────────────────────────────────────────

  get list(): CarbonList {
    return new CarbonList(this.page);
  }

  get editorContainer(): Locator {
    return this.page.locator('valtimo-widget-management-editor');
  }

  get tableActionBar(): Locator {
    return this.page.getByRole('region', {name: 'Table action bar'});
  }

  get addWidgetButton(): Locator {
    return this.tableActionBar.getByTestId(WIDGET_EDITOR_TEST_IDS.addWidgetButton);
  }

  get addDividerButton(): Locator {
    return this.tableActionBar.getByTestId(WIDGET_EDITOR_TEST_IDS.addDividerButton);
  }

  // ─── Editor mode tabs (visual / JSON) ───────────────────────────────

  get visualEditorTab(): Locator {
    return this.page.getByRole('tab', {name: 'Visual editor'});
  }

  get jsonEditorTab(): Locator {
    return this.page.getByRole('tab', {name: 'JSON editor'});
  }

  // ─── Widget wizard ──────────────────────────────────────────────────

  get wizardModal(): Locator {
    return this.page.locator('valtimo-widget-management-wizard .cds--modal.is-visible');
  }

  get wizardNextButton(): Locator {
    return this.page.getByTestId(WIDGET_WIZARD_TEST_IDS.nextButton);
  }

  get wizardCancelButton(): Locator {
    return this.page.getByTestId(WIDGET_WIZARD_TEST_IDS.cancelButton);
  }

  widgetTypeTile(testId: string): Locator {
    return this.page.getByTestId(testId);
  }

  // ─── Divider modal ──────────────────────────────────────────────────

  get dividerModalHeading(): Locator {
    return this.page.getByRole('heading', {name: /divider/i}).first();
  }

  get dividerTitleInput(): Locator {
    return this.page.getByTestId(WIDGET_DIVIDER_MODAL_TEST_IDS.titleInput);
  }

  /** Auto-generated key field rendered inside the divider modal. */
  get dividerKeyInput(): Locator {
    return this.page.getByTestId(AUTO_KEY_INPUT_TEST_IDS.input);
  }

  get dividerCreateButton(): Locator {
    return this.page.getByTestId(WIDGET_DIVIDER_MODAL_TEST_IDS.createButton);
  }

  get dividerCancelButton(): Locator {
    return this.page.getByTestId(WIDGET_DIVIDER_MODAL_TEST_IDS.cancelButton);
  }

  // ─── Navigation ─────────────────────────────────────────────────────

  /**
   * Navigate directly to the widget-details page for a given widgets-type
   * tab. URL pattern: `/iko-management/:apiKey/:viewKey/tabs/widget-details/:widgetTabKey`.
   */
  async goToWidgetDetails(
    apiKey: string,
    viewKey: string,
    widgetTabKey: string,
    parentTabKey = 'tabs'
  ): Promise<void> {
    await this.page.goto(
      `/iko-management/${apiKey}/${viewKey}/${parentTabKey}/widget-details/${widgetTabKey}`
    );
    await this.editorContainer.waitFor();
  }

  // ─── Actions ────────────────────────────────────────────────────────

  async switchToJsonEditor(): Promise<void> {
    await this.jsonEditorTab.click();
  }

  async switchToVisualEditor(): Promise<void> {
    await this.visualEditorTab.click();
    await this.list.waitForLoaded();
  }

  /** Open the create-widget wizard and wait for it to be interactable. */
  async openWizard(): Promise<void> {
    await this.addWidgetButton.click();
    await expect(this.wizardModal).toBeVisible();
    // Let a previous modal's deferred form reset fire before interacting.
    await settleModalReset(this.page);
  }

  /**
   * Open the divider modal, fill the title, and create. The key auto-fills
   * from the title and the form is valid as soon as both are non-empty.
   */
  async addDivider(title: string): Promise<string> {
    await this.addDividerButton.click();
    // Let a previous modal's deferred form reset fire before filling.
    await settleModalReset(this.page);
    await this.dividerTitleInput.fill(title);
    await expect(this.dividerKeyInput).not.toHaveValue('');
    const key = await this.dividerKeyInput.inputValue();
    await expect(this.dividerCreateButton).toBeEnabled();
    await this.dividerCreateButton.click();
    await expect(this.page.locator('cds-modal[open]')).toHaveCount(0, {timeout: 10_000});
    return key;
  }

  /** Best-effort dismissal of any open wizard / divider modal. */
  async closeAnyOpenModal(): Promise<void> {
    for (const cancel of [this.wizardCancelButton, this.dividerCancelButton]) {
      if (await cancel.isVisible().catch(() => false)) {
        await cancel.click().catch(() => undefined);
        await this.page
          .locator('cds-modal[open]')
          .waitFor({state: 'hidden', timeout: 5_000})
          .catch(() => undefined);
      }
    }
  }

  // ─── Widget management via the JSON editor ──────────────────────────

  /**
   * Append a widget to the configuration via the visual JSON editor. Mirrors
   * the case-details widgets test's approach so the divider/widget-divider
   * code path is exercised end-to-end through the UI.
   */
  async addWidgetViaJsonEditor(
    viewKey: string,
    tabKey: string,
    widget: BasicWidget
  ): Promise<void> {
    const existing = await this.getWidgetsViaApi(viewKey, tabKey);
    const updated = [...existing, widget];
    await this.switchToJsonEditor();
    const editor = new JsonEditor(this.page);
    await editor.saveChanges(updated);
    await this.switchToVisualEditor();
  }

  async removeWidgetViaJsonEditor(
    viewKey: string,
    tabKey: string,
    widgetKey: string
  ): Promise<void> {
    const existing = await this.getWidgetsViaApi(viewKey, tabKey);
    const updated = existing.filter(w => w.key !== widgetKey);
    await this.switchToJsonEditor();
    const editor = new JsonEditor(this.page);
    await editor.saveChanges(updated);
    await this.switchToVisualEditor();
  }

  /**
   * Edit an existing widget through the JSON editor by applying a partial
   * patch (e.g. a new title) to the entry matching `widgetKey`, leaving every
   * other widget untouched.
   */
  async editWidgetViaJsonEditor(
    viewKey: string,
    tabKey: string,
    widgetKey: string,
    patch: Partial<BasicWidget>
  ): Promise<void> {
    const existing = await this.getWidgetsViaApi(viewKey, tabKey);
    const updated = existing.map(w => (w.key === widgetKey ? {...w, ...patch} : w));
    await this.switchToJsonEditor();
    const editor = new JsonEditor(this.page);
    await editor.saveChanges(updated);
    await this.switchToVisualEditor();
  }

  // ─── Assertions ─────────────────────────────────────────────────────

  async assertWidgetVisible(title: string): Promise<void> {
    await this.list.row(title).assertVisible();
  }

  async assertWidgetNotVisible(title: string): Promise<void> {
    await this.list.row(title).assertNotVisible();
  }

  async assertHeaderVisible(label: string): Promise<void> {
    await expect(this.list.table.locator('th', {hasText: label}).first()).toBeVisible();
  }

  async assertWidgetTypeTag(title: string, expectedType: string): Promise<void> {
    const row = this.list.row(title);
    await expect(row.tags.first()).toHaveText(expectedType);
  }

  // ─── API helpers (setup / cleanup) ──────────────────────────────────

  async getWidgetsViaApi(viewKey: string, tabKey: string): Promise<BasicWidget[]> {
    return apiGet<BasicWidget[]>(
      `/api/management/v1/iko-view/${viewKey}/tab/${tabKey}/widget`
    );
  }

  async createWidgetViaApi(
    viewKey: string,
    tabKey: string,
    widget: BasicWidget
  ): Promise<void> {
    await apiPost(
      `/api/management/v1/iko-view/${viewKey}/tab/${tabKey}/widget/${widget.key}`,
      widget
    );
  }

  async deleteWidgetViaApi(viewKey: string, tabKey: string, widgetKey: string): Promise<void> {
    try {
      await apiDelete(`/api/management/v1/iko-view/${viewKey}/tab/${tabKey}/widget/${widgetKey}`);
    } catch {
      // Widget may already be deleted or never created.
    }
  }

  /** Replace the widget configuration with the given list (also used to clear). */
  async replaceWidgetsViaApi(
    viewKey: string,
    tabKey: string,
    widgets: BasicWidget[]
  ): Promise<void> {
    try {
      await apiPut(
        `/api/management/v1/iko-view/${viewKey}/tab/${tabKey}/widget`,
        widgets
      );
    } catch {
      // Endpoint may be unavailable on older builds — best-effort.
    }
  }

  /** Delete every widget under `tabKey` whose title starts with one of the prefixes. */
  async cleanupTestWidgetsViaApi(
    viewKey: string,
    tabKey: string,
    titlePrefixes: string[]
  ): Promise<void> {
    try {
      const widgets = await this.getWidgetsViaApi(viewKey, tabKey);
      for (const widget of widgets) {
        if (titlePrefixes.some(p => (widget.title ?? '').startsWith(p))) {
          await this.deleteWidgetViaApi(viewKey, tabKey, widget.key);
        }
      }
    } catch {
      // Listing failed — nothing reliable to clean up.
    }
  }
}
