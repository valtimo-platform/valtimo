import {APIRequestContext, expect, Page} from '@playwright/test';
import {PluginFieldMap, pluginTestConfiguration, pluginTypes} from './plugin-config';

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
    const fields: PluginFieldMap[] = pluginTestConfiguration[type].fieldMap;
    for (const field of fields) {
      const inputWrapper = this.page.getByTestId(field.testId);
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
    await this.saveButton.click();
  }

  async expectSavingError() {
    // const [response] = await Promise.all([
    //   this.page.waitForResponse(
    //     res =>
    //       res.url().includes('/api/v1/plugin/configuration') &&
    //       res.request().method() === 'POST}' &&
    //       res.status() === 500
    //   ),
    // ]);
    const response = await this.request.post('/api/v1/plugin/configuration', {
      failOnStatusCode: false,
    });

    const [response500] = await Promise.all([
      this.page.waitForResponse(
        res =>
          res.url().includes('/api/plugins') &&
          res.status() === 500 &&
          res.request().method() === 'POST'
      ),
      this.saveButton.click(),
    ]);

    expect(response500.status()).toBe(500);

    //   this.page.waitForResponse(
    //     res =>
    //       res.url().includes() &&
    //       res.request().method() === 'POST}' &&
    //       res.status() === 500
    //   ),
    // );

    // console.log({response});
    // expect(response.status()).toBe(500);

    const errorToast = this.page.locator('.cds--toast-notification__details');

    await expect(errorToast).toContainText(
      "Plugin property with name 'rsin' failed to parse for plugin"
    );
    await this.page.getByTestId('stepperFooterCancelButton').click();
  }

  async duplicateConfigurationName(configurationName: string, configurationIdTestId: string) {
    await this.page
      .locator(`tr:has(td:has-text("${configurationName}"))`)
      .getByRole('menu')
      .locator('button')
      .click();
    await this.page.getByRole('menuitem', {name: 'Duplicate'}).click();

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
    await this.page.locator(`tr:has(td:has-text("${pluginIdentifier}"))`).click();
    await this.editPluginName(configurationNameTestId, newConfigurationName);
  }

  async editPluginMenuClick(
    pluginIdentifier: string,
    configurationNameTestId: string,
    newConfigurationName: string
  ): Promise<void> {
    await this.page
      .locator(`tr:has(td:has-text("${pluginIdentifier}"))`)
      .getByRole('menu')
      .locator('button')
      .click();
    await this.page.getByRole('menuitem', {name: 'Edit'}).click();
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
      .getByRole('menu')
      .locator('button')
      .click();
    await this.page.getByRole('menuitem', {name: 'Delete'}).click();
    await this.page.waitForResponse(
      res => res.url().includes('/api/v1/plugin/configuration') && res.request().method() === 'GET'
    );
  }

  async deleteZakenApiExpectingError(): Promise<void> {
    const pluginIdentifier = 'zakenapi';

    await this.page
      .locator(`tr:has(td:has-text("${pluginIdentifier}"))`)
      .getByRole('menu')
      .locator('button')
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
    expect(await this.page.getByText(pluginIdentifier).first()).toBeVisible();
  }

  async assertPluginDeleted(pluginType: string): Promise<void> {
    const plugin = this.page.locator(
      `tr:has(td:has-text("${pluginTestConfiguration[pluginType].pluginIdentifier}"))`
    );
    await expect(plugin).not.toBeVisible();
  }

  async deleteAllTestPlugins(): Promise<void> {
    for (const type of pluginTypes) {
      if (type === 'Besluiten API') continue;

      const isVisible = await this.page
        .locator(`tr:has(td:has-text("${pluginTestConfiguration[type].pluginIdentifier}"))`)
        .isVisible();
      if (isVisible) await this.deletePlugin(pluginTestConfiguration[type].pluginIdentifier);
    }
  }

  private async fillVerzoekExtra() {
    await this.page.getByRole('button', {name: 'Add verzoek type'}).click();

    // TODO: fill subform
  }
}
