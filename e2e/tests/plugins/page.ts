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

import {APIRequestContext, expect, Page} from '@playwright/test';
import {PluginFieldMap, pluginTestConfiguration, pluginTypes} from './plugin-config';
import {STEPPER_FOOTER_STEP_TEST_IDS, PLUGIN_CATALOG_TEST_IDS} from '../../constants';
import {CarbonList} from '../../shared/carbon-list/carbon-list.utils';

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
  async goToPluginManagement() {
    console.log('Navigate to Plugin management...');
    await this.page.getByRole('button', {name: 'Admin'}).click();
    await this.page.getByRole('link', {name: 'Plugins'}).click();
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

  get catalogGrid() {
    return this.page.getByTestId(PLUGIN_CATALOG_TEST_IDS.tileGrid);
  }

  get catalogTiles() {
    return this.page.locator('cds-selection-tile');
  }

  async assertCatalogTilesHaveLogos(): Promise<void> {
    const tiles = this.catalogTiles;
    const count = await tiles.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const tile = tiles.nth(i);
      const logo = tile.getByTestId(PLUGIN_CATALOG_TEST_IDS.tileLogo);
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
      const title = tile.getByTestId(PLUGIN_CATALOG_TEST_IDS.tileTitle);
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
      const description = tile.getByTestId(PLUGIN_CATALOG_TEST_IDS.tileDescription);
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
}
