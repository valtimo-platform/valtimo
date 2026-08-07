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
  PLUGIN_ACTION_CONFIGURATION_TEST_IDS,
  PROCESS_LINK_MODAL_TEST_IDS,
  PROCESS_LINK_TYPE_BUTTON_TEST_ID_PREFIX,
  PROCESS_LINK_TYPE_CHOOSER_TEST_IDS,
  SELECT_PLUGIN_ACTION_TEST_IDS,
  SELECT_PLUGIN_ACTION_TILE_TEST_ID_PREFIX,
  SELECT_PLUGIN_CONFIGURATION_ROW_TEST_ID_PREFIX,
  SELECT_PLUGIN_CONFIGURATION_TEST_IDS,
} from '../../constants';

/**
 * Wrapper for `valtimo-process-link-modal` — the wizard that links a BPMN step to
 * a form, form flow, plugin action, building block or UI component.
 *
 * The wizard adapts to the step it was opened for: when the activity type offers
 * a single link type the chooser is skipped entirely (a service task, for
 * instance, lands straight on the plugin selection step), and the footer swaps
 * Next for Complete on the last step.
 */
export class ProcessLinkWizard {
  constructor(private readonly page: Page) {}

  // ─── Shell ────────────────────────────────────────────────────────

  get host(): Locator {
    return this.page.locator('valtimo-process-link-modal');
  }

  /** Renders `Process step: <name>`. */
  get heading(): Locator {
    return this.page.getByTestId(PROCESS_LINK_MODAL_TEST_IDS.heading);
  }

  get progressIndicator(): Locator {
    return this.page.getByTestId(PROCESS_LINK_MODAL_TEST_IDS.progressIndicator);
  }

  get cancelButton(): Locator {
    return this.page.getByTestId(PROCESS_LINK_MODAL_TEST_IDS.cancelButton);
  }

  get backButton(): Locator {
    return this.page.getByTestId(PROCESS_LINK_MODAL_TEST_IDS.backButton);
  }

  get nextButton(): Locator {
    return this.page.getByTestId(PROCESS_LINK_MODAL_TEST_IDS.nextButton);
  }

  get completeButton(): Locator {
    return this.page.getByTestId(PROCESS_LINK_MODAL_TEST_IDS.completeButton);
  }

  get unlinkButton(): Locator {
    return this.page.getByTestId(PROCESS_LINK_MODAL_TEST_IDS.unlinkButton);
  }

  async waitForOpen() {
    await expect(this.heading).toBeVisible();
  }

  async waitForClosed() {
    await expect(this.heading).not.toBeVisible();
  }

  async cancel() {
    await this.cancelButton.click();
    await this.waitForClosed();
  }

  async next() {
    await expect(this.nextButton).toBeEnabled();
    await this.nextButton.click();
  }

  async back() {
    await expect(this.backButton).toBeEnabled();
    await this.backButton.click();
  }

  async complete() {
    await expect(this.completeButton).toBeEnabled();
    await this.completeButton.click();
    await this.waitForClosed();
  }

  /** Titles of the wizard steps, as rendered by the progress indicator. */
  async stepTitles(): Promise<string[]> {
    const text = await this.progressIndicator.innerText();
    // Each step renders its state ("Current" / "Complete" / "Incomplete") above
    // its title, plus the chosen value once a step is done.
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
  }

  // ─── Choose link type step ────────────────────────────────────────

  get typeChooser(): Locator {
    return this.page.getByTestId(PROCESS_LINK_TYPE_CHOOSER_TEST_IDS.container);
  }

  /** @param processLinkType e.g. `form`, `form-flow`, `plugin`, `building-block`. */
  typeButton(processLinkType: string): Locator {
    return this.page.getByTestId(`${PROCESS_LINK_TYPE_BUTTON_TEST_ID_PREFIX}${processLinkType}`);
  }

  /** The link types this step offers, as `processLinkType` ids. */
  async offeredLinkTypes(): Promise<string[]> {
    return this.page
      .locator(`[data-test-id^="${PROCESS_LINK_TYPE_BUTTON_TEST_ID_PREFIX}"]`)
      .evaluateAll((buttons, prefix) =>
        buttons.map(button => (button.getAttribute('data-test-id') ?? '').replace(prefix, '')),
      PROCESS_LINK_TYPE_BUTTON_TEST_ID_PREFIX);
  }

  async chooseLinkType(processLinkType: string) {
    const button = this.typeButton(processLinkType);
    await expect(button).toBeEnabled();
    await button.click();
  }

  // ─── Select plugin step ───────────────────────────────────────────

  get pluginStep(): Locator {
    return this.page.getByTestId(SELECT_PLUGIN_CONFIGURATION_TEST_IDS.container);
  }

  get pluginList(): Locator {
    return this.page.getByTestId(SELECT_PLUGIN_CONFIGURATION_TEST_IDS.list);
  }

  get pluginRows(): Locator {
    return this.page.locator(`[data-test-id^="${SELECT_PLUGIN_CONFIGURATION_ROW_TEST_ID_PREFIX}"]`);
  }

  /**
   * @param id plugin *definition* key in a building block, plugin *configuration*
   * id in a case — the step lists definitions in the one and configurations in
   * the other.
   */
  pluginRow(id: string): Locator {
    return this.page.getByTestId(`${SELECT_PLUGIN_CONFIGURATION_ROW_TEST_ID_PREFIX}${id}`);
  }

  /** The ids offered by the plugin selection step. */
  async offeredPluginIds(): Promise<string[]> {
    return this.pluginRows.evaluateAll((rows, prefix) =>
      rows.map(row => (row.getAttribute('data-test-id') ?? '').replace(prefix, '')),
    SELECT_PLUGIN_CONFIGURATION_ROW_TEST_ID_PREFIX);
  }

  async selectPlugin(id: string) {
    const row = this.pluginRow(id);
    await expect(row).toBeVisible();
    await row.click();
  }

  // ─── Choose action step ───────────────────────────────────────────

  get actionStep(): Locator {
    return this.page.getByTestId(SELECT_PLUGIN_ACTION_TEST_IDS.container);
  }

  get noActionsMessage(): Locator {
    return this.page.getByTestId(SELECT_PLUGIN_ACTION_TEST_IDS.noActionsMessage);
  }

  get actionTiles(): Locator {
    return this.page.locator(`[data-test-id^="${SELECT_PLUGIN_ACTION_TILE_TEST_ID_PREFIX}"]`);
  }

  actionTile(actionKey: string): Locator {
    return this.page.getByTestId(`${SELECT_PLUGIN_ACTION_TILE_TEST_ID_PREFIX}${actionKey}`);
  }

  /** The action keys the step offers. */
  async offeredActionKeys(): Promise<string[]> {
    return this.actionTiles.evaluateAll((tiles, prefix) =>
      tiles.map(tile => (tile.getAttribute('data-test-id') ?? '').replace(prefix, '')),
    SELECT_PLUGIN_ACTION_TILE_TEST_ID_PREFIX);
  }

  async selectAction(actionKey: string) {
    const tile = this.actionTile(actionKey);
    await expect(tile).toBeVisible();
    await tile.click();
  }

  // ─── Configure action step ────────────────────────────────────────

  get actionConfigurationStep(): Locator {
    return this.page.getByTestId(PLUGIN_ACTION_CONFIGURATION_TEST_IDS.container);
  }

  /**
   * Advance a plugin link from the plugin selection step to the configuration
   * step: pick the plugin, then the action.
   */
  async advanceToActionConfiguration(pluginId: string, actionKey: string) {
    await this.selectPlugin(pluginId);
    await this.next();
    await expect(this.actionStep).toBeVisible();

    await this.selectAction(actionKey);
    await this.next();
    await expect(this.completeButton).toBeVisible();
  }
}
