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
import {
  PluginFieldMap,
  pluginDetailTestData,
  pluginTestConfiguration,
  pluginTypes,
} from './plugin-config';
import {
  DEFAULT_PLUGIN_CONFIGURATION_TEST_IDS,
  PLUGIN_CATALOG_TEST_IDS,
  PLUGIN_EDIT_MODAL_TEST_IDS,
  STEPPER_FOOTER_STEP_TEST_IDS,
} from '../../constants';
import {CarbonList} from '../../shared/carbon-list/carbon-list.utils';
import * as ApiUtils from '../../utils/api.utils';

export interface PluginConfigurationResponse {
  id: string;
  title: string;
  properties: Record<string, string>;
  pluginDefinition: {key: string; title: string; description: string};
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class PluginPage {
  constructor(private readonly page: Page, private readonly request: APIRequestContext) {}

  // UI Elements
  get configureButton() {
    return this.page.getByRole('button', {name: 'Configure plugin'});
  }

  get enterDataButton() {
    return this.page.getByRole('button', {name: 'Enter data'});
  }

  get saveButton() {
    return this.page.getByRole('button', {name: 'Save configuration'});
  }

  // Navigation
  // Navigate directly to the plugins route — avoids relying on the Admin menu,
  // which is flaky under the shared beforeAll context.
  async goToPluginManagement() {
    console.log('Navigate to Plugin management...');
    await this.page.goto('/plugins');
    await this.page.waitForSelector('valtimo-carbon-list');
  }

  // Wizard
  async openWizard() {
    await this.configureButton.click();
    await this.verifyStepperStep1();
  }

  async selectPluginType(type: string) {
    const tile = this.page.locator('cds-selection-tile', {
      hasText: new RegExp(type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
    });

    await tile.first().click();
    await this.enterDataButton.click();
    await this.verifyStepperStep2();
  }

  // Stepper checks
  async verifyStepperStep1() {
    const stepper = this.page.locator('.stepper-header');
    await expect(stepper).toBeVisible();

    const step1 = stepper.locator('.stepper-header__step').first();
    await expect(step1).toHaveClass(/stepper-header__step--active/);
    await expect(step1.locator('.stepper-header__step-number')).toHaveText('1');
    await expect(step1.locator('.stepper-header__step-title')).toHaveText('Choose your plugin');

    const step2 = stepper.locator('.stepper-header__step').nth(1);
    await expect(step2).not.toHaveClass(/stepper-header__step--active/);

    await expect(this.enterDataButton).toBeDisabled();
  }

  async verifyStepperStep2() {
    const stepper = this.page.locator('.stepper-header');
    await expect(stepper).toBeVisible();

    const step1 = stepper.locator('.stepper-header__step').first();
    await expect(step1).toHaveClass(/stepper-header__step--active/);

    const step2 = stepper.locator('.stepper-header__step').nth(1);
    await expect(step2).toHaveClass(/stepper-header__step--active/);

    await expect(this.saveButton).toBeDisabled();
  }

  // Plugin form
  async fillPluginForm(type: string) {
    const dialog = this.page.getByRole('dialog');
    const fields: PluginFieldMap[] = pluginTestConfiguration[type].fieldMap;
    for (const field of fields) {
      const inputWrapper = dialog.getByTestId(field.testId);
      switch (field.type) {
        case 'input':
          await inputWrapper.locator('input').fill(field.value);
          break;
        case 'select':
          await inputWrapper.locator('cds-combo-box').click();
          await inputWrapper.getByRole('option').getByText(field.value).click();
          break;
      }
    }

    if (type === 'Verzoek') {
      await this.fillVerzoekExtra();
    }
  }

  async fillIncorrectRsinValue(testId: string) {
    await this.page.getByTestId(testId).locator('input').fill('1');
  }

  async saveConfiguration() {
    await expect(this.saveButton).toBeEnabled();
    await Promise.all([
      this.page.waitForResponse(
        res =>
          res.url().includes('/api/v1/plugin/configuration') &&
          (res.request().method() === 'POST' || res.request().method() === 'PUT')
      ),
      this.saveButton.click(),
    ]);
  }

  async expectInvalidRSINError() {
    const [response500] = await Promise.all([
      this.page.waitForResponse(
        res =>
          res.url().includes('/api/v1/plugin/configuration') &&
          res.status() === 500 &&
          res.request().method() === 'POST'
      ),
      this.saveButton.click(),
    ]);

    expect(response500.status()).toBe(500);

    try {
      const errorToast = this.page
        .locator('.cds--toast-notification__details')
        .first();

      await expect(errorToast).toBeVisible({timeout: 10_000});
    } finally {
      // Always close the wizard, even if the assertion fails
      await this.page.getByTestId(STEPPER_FOOTER_STEP_TEST_IDS.cancelButton).click();
    }
  }

  async expectSameIdError() {
    const [response500] = await Promise.all([
      this.page.waitForResponse(
        res =>
          res.url().includes('/api/v1/plugin/configuration') &&
          res.status() === 500 &&
          res.request().method() === 'POST'
      ),
      this.saveButton.click(),
    ]);

    expect(response500.status()).toBe(500);

    try {
      const errorToast = this.page
        .locator('.cds--toast-notification__details')
        .first();

      await expect(errorToast).toBeVisible({timeout: 10_000});
    } finally {
      // Always close the wizard, even if the assertion fails
      await this.page.getByTestId(STEPPER_FOOTER_STEP_TEST_IDS.cancelButton).click();
    }
  }

  async duplicateConfigurationName(configurationName: string, configurationIdTestId: string) {
    await this.page
      .locator(`tr:has(td:has-text("${configurationName}"))`)
      .first()
      .locator('.v-overflow-menu__trigger')
      .click();
    await this.page.getByRole('menu').getByRole('menuitem', {name: 'Duplicate'}).click();

    const input = this.page.getByTestId(configurationIdTestId).locator('input');
    const val = await input.inputValue();
    await input.fill(`${val} - Test Duplicated`);
    await this.saveConfiguration();
    await this.page.waitForResponse(
      res => res.url().includes('/api/v1/plugin/configuration') && res.request().method() === 'GET'
    );
  }

  async editPluginRowClick(
    pluginIdentifier: string,
    configurationNameTestId: string,
    newConfigurationName: string
  ): Promise<void> {
    await this.page.locator(`tr:has(td:has-text("${pluginIdentifier}"))`).first().click();
    await this.editPluginName(configurationNameTestId, newConfigurationName);
  }

  async editPluginMenuClick(
    pluginIdentifier: string,
    configurationNameTestId: string,
    newConfigurationName: string
  ): Promise<void> {
    await this.page
      .locator(`tr:has(td:has-text("${pluginIdentifier}"))`)
      .first()
      .locator('.v-overflow-menu__trigger')
      .click();
    await this.page.getByRole('menu').getByRole('menuitem', {name: 'Edit'}).click();
    await this.editPluginName(configurationNameTestId, newConfigurationName);
  }

  async editPluginName(
    configurationNameTestId: string,
    newConfigurationName: string
  ): Promise<void> {
    await this.page
      .getByTestId(configurationNameTestId)
      .locator('input')
      .fill(newConfigurationName);
    await this.saveConfiguration();
  }

  async deletePlugin(pluginIdentifier: string): Promise<void> {
    await this.page
      .locator(`tr:has(td:has-text("${pluginIdentifier}"))`)
      .first()
      .locator('.v-overflow-menu__trigger')
      .click();
    await this.page.getByRole('menu').getByRole('menuitem', {name: 'Delete'}).click();
    await this.page.waitForResponse(
      res => res.url().includes('/api/v1/plugin/configuration') && res.request().method() === 'GET'
    );
  }

  async deleteZakenApiExpectingError(): Promise<void> {
    const pluginIdentifier = 'zakenapi';

    await this.page
      .locator(`tr:has(td:has-text("${pluginIdentifier}"))`)
      .first()
      .locator('.v-overflow-menu__trigger')
      .click();

    const [response] = await Promise.all([
      this.page.waitForResponse(
        res =>
          res.url().includes('/api/v1/plugin/configuration') &&
          res.request().method() === 'DELETE' &&
          res.status() === 500
      ),
      this.page.getByRole('menuitem', {name: 'Delete'}).click(),
    ]);

    expect(response.status()).toBe(500);

    const errorToast = this.page.locator('.cds--toast-notification__details');

    await expect(errorToast).toContainText(
      "Failed to update CaseDefinition bezwaar:1.0.0. This case definition is final and therefore can't be updated."
    );
  }

  async assertPluginExists(pluginIdentifier: string): Promise<void> {
    await expect(this.page.getByText(pluginIdentifier).first()).toBeVisible();
  }

  // ─── Plugin Overview Table Assertions (9.3, 9.4) ──────────────────

  get carbonList(): CarbonList {
    return new CarbonList(this.page);
  }

  async assertRowHasPluginName(configName: string, expectedPluginName: string): Promise<void> {
    const row = this.carbonList.row(configName);
    await row.assertVisible();
    const pluginNameCell = row.cellByIndex(1);
    await expect(pluginNameCell).toHaveText(expectedPluginName);
  }

  async assertRowHasIdentifier(configName: string, expectedIdentifier: string): Promise<void> {
    const row = this.carbonList.row(configName);
    await row.assertVisible();
    const identifierCell = row.cellByIndex(2);
    await expect(identifierCell).toContainText(expectedIdentifier);
  }

  // ─── Plugin Catalog Assertions (9.7) ──────────────────────────────

  get catalogTiles() {
    return this.page.locator('cds-selection-tile');
  }

  async assertCatalogTilesHaveLogos(): Promise<void> {
    const tiles = this.catalogTiles;
    const count = await tiles.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const tile = tiles.nth(i);
      const logo = tile.locator('img.plugin-definition-logo');
      await expect(logo).toBeVisible();
      const src = await logo.getAttribute('src');
      expect(src).toBeTruthy();
    }
  }

  async assertCatalogTilesHaveTitles(): Promise<void> {
    const tiles = this.catalogTiles;
    const count = await tiles.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const tile = tiles.nth(i);
      const title = tile.locator('h5');
      await expect(title).toBeVisible();
      const text = await title.textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    }
  }

  async assertCatalogTilesHaveDescriptions(): Promise<void> {
    const tiles = this.catalogTiles;
    const count = await tiles.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const tile = tiles.nth(i);
      const description = tile.locator('p');
      await expect(description).toBeVisible();
      const text = await description.textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    }
  }

  async closeWizard(): Promise<void> {
    await this.page.getByTestId(STEPPER_FOOTER_STEP_TEST_IDS.cancelButton).click();
  }

  async assertPluginDeleted(pluginType: string): Promise<void> {
    const plugin = this.page.locator(
      `tr:has(td:has-text("${pluginTestConfiguration[pluginType].pluginIdentifier}"))`
    );
    await expect(plugin).not.toBeVisible();
  }

  async deleteAllTestPlugins(): Promise<void> {
    // Close any open modal that might block interactions
    const modal = this.page.locator('.cds--modal.is-visible');
    if (await modal.isVisible({timeout: 500}).catch(() => false)) {
      const closeButton = modal.locator('button.cds--modal-close');
      if (await closeButton.isVisible({timeout: 500}).catch(() => false)) {
        await closeButton.click();
        await expect(modal).not.toBeVisible();
      }
    }

    for (const type of pluginTypes) {
      if (type === 'Besluiten API') continue;

      const rows = this.page.locator(
        `tr:has(td:has-text("${pluginTestConfiguration[type].pluginIdentifier}"))`
      );
      while ((await rows.count()) > 0) {
        await this.deletePlugin(pluginTestConfiguration[type].pluginIdentifier);
      }
    }
  }

  private async fillVerzoekExtra() {
    await this.page.getByRole('button', {name: 'Add verzoek type'}).click();

    // TODO: fill subform
  }

  // ─── Configuration Details (9.12, 9.17, 9.19, 9.21, 9.23–9.25) ────
  //
  // Both the add wizard and the edit modal render the same plugin configuration form, so all
  // field locators are scoped to whichever modal is currently visible.

  get visibleModal(): Locator {
    return this.page.locator('.cds--modal.is-visible');
  }

  get configurationIdInput(): Locator {
    return this.visibleModal
      .getByTestId(DEFAULT_PLUGIN_CONFIGURATION_TEST_IDS.configurationId)
      .locator('input');
  }

  get editModalSaveButton(): Locator {
    return this.visibleModal.getByTestId(PLUGIN_EDIT_MODAL_TEST_IDS.saveButton);
  }

  get cancelWizardButton(): Locator {
    return this.visibleModal.getByTestId(STEPPER_FOOTER_STEP_TEST_IDS.cancelButton);
  }

  /**
   * Selects a catalog tile by its exact title. `selectPluginType` matches anywhere in the tile
   * (title *and* description), so it picks the wrong tile for short names such as "OpenZaak",
   * which also appears in other plugins' descriptions.
   */
  async selectPluginTypeByTitle(title: string): Promise<void> {
    const tile = this.catalogTiles.filter({
      has: this.page.getByTestId(PLUGIN_CATALOG_TEST_IDS.tileTitle).filter({
        hasText: new RegExp(`^\\s*${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`),
      }),
    });
    await tile.first().click();
    await this.enterDataButton.click();
    await this.verifyStepperStep2();
  }

  /** Returns the labels currently offered by an authentication (or any other) v-select. */
  async getSelectOptionLabels(testId: string): Promise<string[]> {
    const select = this.visibleModal.getByTestId(testId);
    await select.locator('cds-combo-box').click();
    const options = select.getByRole('option');
    await expect(options.first()).toBeVisible();
    const labels = await options.allInnerTexts();
    await this.page.keyboard.press('Escape');
    return labels.map(label => label.trim());
  }

  async selectSelectOption(testId: string, optionLabel: string): Promise<void> {
    const select = this.visibleModal.getByTestId(testId);
    await select.locator('cds-combo-box').click();
    await select.getByRole('option').getByText(optionLabel, {exact: true}).click();
    await expect(select.locator('input')).toHaveValue(optionLabel);
  }

  async fillModalInput(testId: string, value: string): Promise<void> {
    const input = this.visibleModal.getByTestId(testId).locator('input');
    await input.fill(value);
    await expect(input).toHaveValue(value);
  }

  /**
   * Creates a second OpenZaak authentication configuration so that authentication dropdowns
   * offer more than the single seeded option.
   */
  async createOpenZaakAuthConfiguration(
    titleTestId: string,
    clientIdTestId: string,
    clientSecretTestId: string
  ): Promise<void> {
    await this.openWizard();
    await this.selectPluginTypeByTitle('OpenZaak');
    await this.fillModalInput(titleTestId, pluginDetailTestData.altAuthTitle);
    await this.fillModalInput(clientIdTestId, pluginDetailTestData.clientId);
    await this.fillModalInput(clientSecretTestId, pluginDetailTestData.clientSecret);
    await this.saveConfiguration();
  }

  /** Opens the edit modal for an existing configuration by clicking its row. */
  async openEditModal(configurationTitle: string): Promise<void> {
    await this.page.locator(`tr:has(td:has-text("${configurationTitle}"))`).first().click();
    await expect(this.configurationIdInput).toBeVisible();
  }

  /** Dismisses the edit modal via its header close button, discarding any changes. */
  async closeEditModal(): Promise<void> {
    await this.visibleModal.locator('button.cds--modal-close').click();
    await expect(this.visibleModal).toHaveCount(0);
  }

  /**
   * Clicks save in the edit modal expecting the backend to reject the update, and asserts the
   * modal stays open (the save did not go through).
   *
   * Note: unlike the create path, the update path shows no error toast — the only user-visible
   * signal is that the modal does not close. The assertion therefore does not look for one.
   */
  async expectEditSaveError(): Promise<void> {
    await expect(this.editModalSaveButton).toBeEnabled();
    const [response] = await Promise.all([
      this.page.waitForResponse(
        res =>
          res.url().includes('/api/v1/plugin/configuration') &&
          res.request().method() === 'PUT' &&
          !res.ok()
      ),
      this.editModalSaveButton.click(),
    ]);
    expect(response.status()).toBe(500);
    await expect(this.visibleModal).toHaveCount(1);
  }

  async saveEditModal(): Promise<void> {
    await expect(this.editModalSaveButton).toBeEnabled();
    await Promise.all([
      this.page.waitForResponse(
        res =>
          res.url().includes('/api/v1/plugin/configuration') &&
          res.request().method() === 'PUT' &&
          res.ok()
      ),
      this.editModalSaveButton.click(),
    ]);
    await expect(this.visibleModal).toHaveCount(0);
  }

  // ─── Configuration Detail Assertions ──────────────────────────────

  async assertConfigurationIdIsGeneratedUuid(configurationTitle: string): Promise<string> {
    const configuration = await this.getConfigurationByTitle(configurationTitle);
    expect(configuration, `no plugin configuration titled "${configurationTitle}"`).toBeTruthy();
    expect(configuration!.id).toMatch(UUID_PATTERN);
    return configuration!.id;
  }

  async assertConfigurationIdDisplayed(expectedId: string): Promise<void> {
    await expect(this.configurationIdInput).toHaveValue(expectedId);
    expect(expectedId).toMatch(UUID_PATTERN);
  }

  async assertConfigurationProperty(
    configurationTitle: string,
    property: string,
    expectedValue: string
  ): Promise<void> {
    // The list refreshes after a save, so poll until the API reflects the new value.
    await expect
      .poll(
        async () => (await this.getConfigurationByTitle(configurationTitle))?.properties[property],
        {message: `plugin configuration property "${property}" never became "${expectedValue}"`}
      )
      .toBe(expectedValue);
  }

  async assertConfigurationCount(expectedCount: number): Promise<void> {
    const configurations = await this.getAllConfigurations();
    expect(configurations.length).toBe(expectedCount);
  }

  // ─── Configuration Detail API Helpers ─────────────────────────────

  async getAllConfigurations(): Promise<PluginConfigurationResponse[]> {
    return ApiUtils.apiGet<PluginConfigurationResponse[]>('/api/v1/plugin/configuration');
  }

  async getConfigurationByTitle(title: string): Promise<PluginConfigurationResponse | undefined> {
    const configurations = await this.getAllConfigurations();
    return configurations.find(configuration => configuration.title === title);
  }

  /**
   * Deletes every configuration with one of the given titles. Safe to call repeatedly.
   * Titles are processed in the order given, so dependants (e.g. an API configuration) must be
   * listed before the authentication configuration they reference.
   */
  async deleteConfigurationsByTitleViaApi(titles: string[]): Promise<void> {
    try {
      const configurations = await this.getAllConfigurations();
      for (const title of titles) {
        for (const configuration of configurations.filter(({title: t}) => t === title)) {
          try {
            await ApiUtils.apiDelete(`/api/v1/plugin/configuration/${configuration.id}`);
          } catch {
            // configuration may already be gone, or is still referenced by another config
          }
        }
      }
    } catch {
      // the API may be unavailable during teardown
    }
  }
}
