import {expect, Page} from '@playwright/test';
import {PluginFieldMap, pluginTestConfiguration} from './plugin-config';

export class PluginPage {
  constructor(private readonly page: Page) {}

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
    await this.page.locator('cds-selection-tile', {hasText: type}).click();
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
    const fields: PluginFieldMap[] = pluginTestConfiguration[type].fieldMap;
    for (const field of fields) {
      const inputWrapper = this.page.locator(`[data-test-id=${field.testId}]`);
      switch (field.type) {
        case 'input':
          console.log('in input');
          await inputWrapper.locator('input').fill(field.value);
          break;
        case 'select':
          console.log('in select');
          await inputWrapper.locator('cds-combo-box').click();
          await inputWrapper.getByRole('option').getByText(field.value).click();
          break;
      }
    }
  }

  async saveConfiguration() {
    await expect(this.saveButton).toBeEnabled();
    await this.saveButton.click();
  }

  async duplicateConfigurationName() {
    const input = this.page.locator('input[name="configurationTitle"]');
    const val = await input.inputValue();
    await input.fill(`${val} - Test Duplicated`);
    await this.saveConfiguration();
  }

  async deletePlugin(pluginType: string) {
    await this.page
      .locator(`tr:has(td:has-text("${pluginTestConfiguration[pluginType].pluginIdentifier}"))`)
      .getByRole('menu')
      .locator('button')
      .click();
    await this.page.getByRole('menuitem', {name: 'Delete'}).click();
    await this.page.waitForResponse(
      res => res.url().includes('/api/v1/plugin/configuration') && res.request().method() === 'GET'
    );
  }

  async assertPluginCreated(pluginType: string) {
    expect(
      await this.page.getByText(pluginTestConfiguration[pluginType].pluginIdentifier).first()
    ).toBeTruthy();
  }

  async assertPluginDeleted(pluginType: string) {
    const plugin = this.page.locator(
      `tr:has(td:has-text("${pluginTestConfiguration[pluginType].pluginIdentifier}"))`
    );
    await expect(plugin).not.toBeVisible();
  }
}
