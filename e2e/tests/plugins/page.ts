import { expect, Page } from "@playwright/test";
import { pluginFieldMap } from "./plugin-config";

export class PluginPage {

    constructor(private readonly page: Page) {}

    // UI Elements
    get configureButton() {
        return this.page.getByRole('button', { name: 'Configure plugin' });
    }

    get enterDataButton() {
        return this.page.getByRole('button', { name: 'Enter data' });
    }

    get saveButton() {
        return this.page.getByRole('button', { name: 'Save configuration' });
    }

    // Navigation
    async goToPluginManagement() {
        console.log("Navigate to Plugin management...");
        await this.page.getByRole('button', { name: 'Admin' }).click();
        await this.page.getByRole('link', { name: 'Plugins' }).click();
        await this.page.waitForSelector("valtimo-carbon-list");
    }

    // Wizard
    async openWizard() {
        await this.configureButton.click();
        await this.verifyStepperStep1();
    }

    async selectPluginType(type: string) {
        await this.page.locator("cds-selection-tile", { hasText: type }).click();
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
        const fields = pluginFieldMap[type];
        for (const field of fields) {
            const input = this.page.getByLabel(field.label, { exact: false });
            await input.fill(field.value);
        }
    }

    async saveConfiguration() {
        await expect(this.saveButton).toBeEnabled();
        await this.saveButton.click();
        await expect(this.page.getByText("Plugin created")).toBeVisible();
    }

    // Duplicate Plugin
    async duplicateConfigurationName() {
        const input = this.page.locator('input[name="configurationTitle"]');
        const val = await input.inputValue();
        await input.fill(`${val} - Test Duplicated`);
        await this.saveConfiguration();
    }

    // Delete Plugin
    async deletePlugin(rowLocator) {
        await rowLocator.getByRole('button', { name: 'Options' }).click();
        await this.page.getByRole('menuitem', { name: 'Delete' }).click();

        const deleteResponse = await this.page.waitForResponse(res =>
            res.request().method() === "DELETE" &&
            res.url().includes("/v1/plugin/configuration")
        );

        expect(deleteResponse.status()).toBe(200);
    }
}