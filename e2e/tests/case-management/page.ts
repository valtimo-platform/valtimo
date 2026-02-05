import {APIRequestContext, expect, Page} from '@playwright/test';
import {PluginFieldMap, pluginTestConfiguration} from '../plugins/plugin-config';
import {caseConfiguration, CaseManagementFieldMap} from './case-config';
import path from 'path';

const DEFAULT_CASE_ARCHIVE = 'test-case-import-success_1.0.0.case.zip';

export interface UploadCaseOptions {
  archiveName?: string;
}

export class CaseManagementPage {
  constructor(private readonly page: Page, private readonly request: APIRequestContext) {}

  // UI Elements
  get createSaveButton() {
    return this.page.getByTestId('caseCreateSaveButton');
  }

  get createCancelButton() {
    return this.page.getByTestId('caseCreateCloseButton');
  }

  get createCaseButton() {
    return this.page.getByTestId('caseManagementCreateButton');
  }

  get uploadCaseButton() {
    return this.page.getByTestId('caseManagementUploadButton');
  }

  get fileUploader() {
    return this.page.getByTestId('caseFileUploader');
  }

  get uploadWizardCancelButton() {
    return this.page.getByTestId('uploadWizardCancelButton');
  }

  get uploadWizardNextButton() {
    return this.page.getByTestId('uploadWizardNextButton');
  }

  get uploadWizardFinishButton() {
    return this.page.getByTestId('uploadWizardFinishButton');
  }

  get uploadWarningCheckbox() {
    return this.page.getByTestId('uploadWarningCheckbox').locator('label');
  }

  get uploadWarningNotification() {
    return this.page.getByTestId('uploadWarningNotification');
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
    await expect(this.createSaveButton).toBeEnabled();
    await this.createSaveButton.click();
  }

  async fillCaseForm() {
    for (let field of caseConfiguration.fields) {
      const inputWrapper = this.page.getByTestId(field.testId);
      if (field.isAutoKey) continue;

      if (field.type === 'input') await inputWrapper.fill(field.value);
    }
  }

  async addCase() {
    await this.createCaseButton.click();
    await this.fillCaseForm();
  }

  async uploadCase(options?: UploadCaseOptions) {
    const archiveName = options?.archiveName ?? DEFAULT_CASE_ARCHIVE;
    await this.uploadCaseButton.click();
    await this.pluginConfigurationStep();
    await this.uploadFileStep(archiveName);
    await this.accessControlStep();
    await this.dashboardStep();
  }

  async uploadCaseConfiguration(archiveName: string) {
    const filePath = path.resolve(process.cwd(), 'assets', 'case-import-archives', archiveName);
    await this.fileUploader.locator('input.cds--file-input[type="file"]').setInputFiles(filePath);
  }

  async checkWarningMessage() {
    await expect(this.uploadWarningNotification).toBeVisible();

    const overwriteCheckbox = this.uploadWarningCheckbox;
    await overwriteCheckbox.click();
    await expect(overwriteCheckbox).toBeChecked();
    await expect(this.uploadWizardNextButton).toBeEnabled();
  }

  // Upload steps
  async pluginConfigurationStep() {
    await expect(this.page.getByText('Plugin Configuration')).toBeVisible();
    await expect(
      this.page.getByText('This process may use plugins. Make sure you configure them correctly.')
    ).toBeVisible();
    await this.uploadWizardNextButton.click();
  }

  async uploadFileStep(archiveName: string) {
    await expect(this.page.getByText('Upload File')).toBeVisible();
    await expect(this.page.getByRole('alert')).toBeVisible();
    await expect(
      this.page.getByText('Max file size is 500kb. Supported file types are ZIP and JSON.')
    ).toBeVisible();
    await this.uploadCaseConfiguration(archiveName);
    await this.checkWarningMessage();
    await this.uploadWizardNextButton.click();

    const response = await this.page.waitForResponse(
      res =>
        res.url().includes('/api/management/v1/case-import') &&
        res.request().method() === 'POST' &&
        res.status() === 200
    );
    expect(response.status()).toBe(200);
  }

  async accessControlStep() {
    await expect(this.page.getByText('Access Control')).toBeVisible();
    await expect(this.page.getByText('rights in Access Control')).toBeVisible();
    await this.uploadWizardNextButton.click();
  }

  async dashboardStep() {
    await expect(this.page.getByText('Dashboard')).toBeVisible();
    await expect(
      this.page.getByText('If you want widgets to appear on your dashboard')
    ).toBeVisible();
    await this.uploadWizardFinishButton.click();
  }

  // Assert functions
  async assertCaseExists(testKey: string) {
    const response = await this.page.waitForResponse(
      res =>
        res.url().includes('/api/management/v1/case-definition/draft') &&
        res.request().method() === 'POST' &&
        res.status() === 200
    );

    expect(response.status()).toBe(200);
  }

  async assertCaseUploaded() {
    await expect(this.page.getByText('Case definition successfully imported')).toBeVisible();
    await expect(this.page.locator('cds-progress-bar.cds--progress-bar--finished')).toBeVisible();
    await expect(this.page.getByText('Importing case definition')).toBeVisible();
    await expect(this.page.getByText('Case definition successfully imported')).toBeVisible();
  }
}
