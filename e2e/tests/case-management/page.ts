import {APIRequestContext, expect, Page} from "@playwright/test";
import {PluginFieldMap, pluginTestConfiguration} from "../plugins/plugin-config";
import {caseConfiguration, CaseManagementFieldMap} from "./case-config";

export class CaseManagementPage {
    constructor(private readonly page: Page, private readonly request: APIRequestContext) {
    }

    // UI Elements
    get saveButton() {
        return this.page.getByRole('button', {name: 'Save'});
    }

    get startUploadButton() {
        return this.page.getByRole('button', {name: 'Start upload'});
    }

    get uploadButton() {
        return this.page.getByRole('button', {name: 'Upload'});
    }

    get nextButton() {
        return this.page.getByRole('button', {name: 'Next'});
    }

    get finishButton() {
        return this.page.getByRole('button', {name: 'Next'});
    }

    // Navigation
    async goToCaseManagement() {
        console.log('Navigate to Case Management...');
        await this.page.getByRole('button', {name: 'Admin'}).click();
        await this.page.getByRole('link', {name: 'Cases'}).click();
        await this.page.waitForSelector('valtimo-carbon-list');
    }

    // Case form
    async saveConfiguration() {
        await expect(this.saveButton).toBeEnabled();
        await this.saveButton.click();
    }

    async fillCaseForm() {
        caseConfiguration.map(async (field: CaseManagementFieldMap) => {
            const inputWrapper = this.page.getByTestId(field.testId);
            await inputWrapper.locator('input').fill(field.value);
        })
    }

    async addCase() {
        await this.page.getByRole('button', {name: 'Create'}).click();
        await this.fillCaseForm();
    }

    async uploadCase() {
        await this.page.getByRole('button', {name: 'Upload'}).click();
        await this.pluginConfigurationStep();
        await this.uploadFileStep();
        await this.accessControlStep();
        await this.dashboardStep();

        await expect(this.uploadButton).toBeEnabled();
        await this.uploadButton.click();
    }

    async uploadCaseConfiguration() {
        this.page.getByRole('button', {name: 'Select file'}).click();
        // TO DO: Add in the project a file
    }

    async checkWarningMessage() {
        const warningNotification = this.page.getByRole('status');
        await expect(warningNotification).toBeVisible();
        await expect(warningNotification).toContainText('If your case definition contains configurations');

        const overwriteCheckbox = this.page.getByLabel('I understand that configurations may be overwritten');
        await overwriteCheckbox.check();
        await expect(overwriteCheckbox).toBeChecked();
        await expect(this.startUploadButton).toBeEnabled();
        await this.startUploadButton.click();
    }

    // Upload steps
    async pluginConfigurationStep() {
        await expect(this.page.getByText('Plugin Configuration')).toBeVisible();
        await expect(this.page.getByText('This process may use plugins. Make sure you configure them correctly.')).toBeVisible();
    }

    async uploadFileStep() {
        await expect(this.page.getByText('Upload File')).toBeVisible();
        await expect(this.page.getByRole('alert')).toBeVisible();
        await expect(this.page.getByText('Max file size is 500kb. Supported file types are ZIP and JSON.')).toBeVisible();
        this.uploadCaseConfiguration();
        this.checkWarningMessage();
    }

    async accessControlStep() {
        await expect(this.page.getByText('Access Control')).toBeVisible();
        await expect(this.page.getByText('rights in Access Control')).toBeVisible();
        await this.nextButton.click();
    }

    async dashboardStep() {
        await expect(this.page.getByText('Dashboard')).toBeVisible();
        await expect(this.page.getByText('If you want widgets to appear on your dashboard')).toBeVisible();
        await this.finishButton.click();
    }

    // Assert functions
    async assertCaseExists(testName: string) {
        expect(await this.page.getByText(testName).first()).toBeVisible();
        console.log("TO DO: Check case creation endpoint")
    }

    async assertCaseUploaded() {
        await expect(this.page.getByText('Case definition successfully imported')).toBeVisible();
        await expect(this.page.locator('cds-progress-bar.cds--progress-bar--finished')).toBeVisible();
        await expect(this.page.getByText('Importing case definition')).toBeVisible();
        await expect(this.page.getByText('Case definition successfully imported')).toBeVisible();
    }
}