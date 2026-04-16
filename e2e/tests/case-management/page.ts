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
import {caseConfiguration} from './case-config';
import path from 'path';
import {
  AUTO_KEY_INPUT_TEST_IDS,
  CASE_MANAGEMENT_CREATE_TEST_IDS,
  CASE_MANAGEMENT_LIST_TEST_IDS,
  CASE_MANAGEMENT_UPLOAD_TEST_IDS,
} from '../../constants';

const DEFAULT_CASE_ARCHIVE = 'test-case-import-success_1.0.0.case.zip';

export interface UploadCaseOptions {
  archiveName?: string;
}

export interface ConfigureStepResult {
  response: Awaited<ReturnType<Page['waitForResponse']>>;
  key: string;
  name: string;
}

export class CaseManagementPage {
  constructor(
    private readonly page: Page,
    private readonly request: APIRequestContext
  ) {}

  // UI Elements
  get createSaveButton() {
    return this.page.getByTestId(CASE_MANAGEMENT_CREATE_TEST_IDS.saveButton);
  }

  get createCancelButton() {
    return this.page.getByTestId(CASE_MANAGEMENT_CREATE_TEST_IDS.closeButton);
  }

  get createCaseButton() {
    return this.page.getByTestId(CASE_MANAGEMENT_LIST_TEST_IDS.createButton);
  }

  get uploadCaseButton() {
    return this.page.getByTestId(CASE_MANAGEMENT_LIST_TEST_IDS.uploadButton).first();
  }

  get fileUploader() {
    return this.page.getByTestId(CASE_MANAGEMENT_UPLOAD_TEST_IDS.fileUploader);
  }

  get uploadWizardCancelButton() {
    return this.page.getByTestId(CASE_MANAGEMENT_UPLOAD_TEST_IDS.cancelButton);
  }

  get uploadWizardNextButton() {
    return this.page.getByTestId(CASE_MANAGEMENT_UPLOAD_TEST_IDS.nextButton);
  }

  get uploadWizardFinishButton() {
    return this.page.getByTestId(CASE_MANAGEMENT_UPLOAD_TEST_IDS.finishButton);
  }

  get configureNameInput() {
    return this.page.getByTestId(CASE_MANAGEMENT_UPLOAD_TEST_IDS.nameInput);
  }

  get configureKeyInput() {
    return this.page.getByTestId(AUTO_KEY_INPUT_TEST_IDS.input);
  }

  get configureVersionTag() {
    return this.page.getByTestId(CASE_MANAGEMENT_UPLOAD_TEST_IDS.versionTag);
  }

  get configureKeyEditButton() {
    return this.page.getByTestId(AUTO_KEY_INPUT_TEST_IDS.editButton);
  }

  get overrideCheckbox() {
    return this.page.getByTestId(CASE_MANAGEMENT_UPLOAD_TEST_IDS.overrideCheckbox);
  }

  get uploadWizardCloseButton() {
    return this.page.getByRole('dialog').locator('button.cds--modal-close');
  }

  // Navigation
  async goToCaseManagement() {
    console.log('Navigate to Case Management...');
    const adminButton = this.page.getByRole('button', {name: 'Admin'});
    if ((await adminButton.getAttribute('aria-expanded')) !== 'true') {
      await adminButton.click();
    }
    await this.page
      .locator('[data-testid="sidenav-item-Admin"]')
      .getByRole('link', {name: 'Cases'})
      .click();
    await this.page.waitForSelector('valtimo-carbon-list');
  }

  // Case form
  async saveConfiguration() {
    await expect(this.createSaveButton).toBeEnabled();
    const [response] = await Promise.all([
      this.page.waitForResponse(
        res =>
          res.url().includes('/api/management/v1/case-definition/draft') &&
          res.request().method() === 'POST'
      ),
      this.createSaveButton.click(),
    ]);
    return response;
  }

  async fillCaseForm(customName?: string) {
    for (let field of caseConfiguration.fields) {
      const inputWrapper = this.page.getByTestId(field.testId);
      if (field.isAutoKey) continue;

      if (field.type === 'input') {
        const value =
          customName && field.testId === 'caseDefinitionNameInput' ? customName : field.value;
        await inputWrapper.fill(value);
      }
    }
  }

  async addCase(customName?: string): Promise<string> {
    await this.createCaseButton.click();
    // Wait for the create case modal to be fully rendered before filling
    await expect(this.createSaveButton).toBeVisible();
    await this.fillCaseForm(customName);
    // Return the auto-generated key
    const keyInput = this.page.getByTestId('caseDefinitionKeyInput');
    return keyInput.inputValue();
  }

  async uploadCase(options?: UploadCaseOptions): Promise<ConfigureStepResult> {
    const archiveName = options?.archiveName ?? DEFAULT_CASE_ARCHIVE;
    await this.uploadCaseButton.click();
    await this.pluginConfigurationStep();
    await this.uploadFileStep(archiveName);
    const result = await this.configureStep();

    if (result.response.status() === 200) {
      // Success: click Next to advance through remaining steps
      await this.uploadWizardNextButton.click();
      await this.accessControlStep();
      await this.dashboardStep();
    } else {
      // Error: wait for finish button and close wizard
      await expect(this.uploadWizardFinishButton).toBeVisible();
      await this.uploadWizardFinishButton.click();
    }

    return result;
  }

  async uploadInvalidCase(options?: UploadCaseOptions) {
    const archiveName = options?.archiveName ?? DEFAULT_CASE_ARCHIVE;
    await this.uploadCaseButton.click();
    await this.pluginConfigurationStep();
    await this.uploadInvalidFileStep(archiveName);
    await this.closeUploadWizard();
  }

  async closeUploadWizard() {
    await this.uploadWizardCloseButton.click();
    await expect(this.page.locator('.cds--modal.is-visible')).not.toBeVisible();
  }

  async uploadCaseConfiguration(archiveName: string) {
    const filePath = path.resolve(process.cwd(), 'assets', 'case-import-archives', archiveName);
    await this.fileUploader.locator('input.cds--file-input[type="file"]').setInputFiles(filePath);
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
    await expect(this.page.getByText('Upload file')).toBeVisible();
    await expect(
      this.page.getByText('Max file size is 500kb. Supported file type is ZIP.')
    ).toBeVisible();
    await this.uploadCaseConfiguration(archiveName);
    await expect(this.uploadWizardNextButton).toBeEnabled();
    await this.uploadWizardNextButton.click();
  }

  async uploadInvalidFileStep(archiveName: string) {
    await expect(this.page.getByText('Upload file')).toBeVisible();
    await this.uploadCaseConfiguration(archiveName);
    await expect(this.page.getByText('Invalid file')).toBeVisible();
    await expect(
      this.page.getByText('The file could not be read as a valid case definition archive.')
    ).toBeVisible();
    await expect(this.uploadWizardNextButton).toBeDisabled();
  }

  async configureStep(): Promise<ConfigureStepResult> {
    const initialValidation = this.waitForKeyValidationResponse();

    await expect(this.configureNameInput).toBeVisible();
    await expect(this.configureKeyInput).toBeVisible();
    await expect(this.configureVersionTag).toBeVisible();

    // Wait for the initial validation API response, then for the UI to reflect the result
    await initialValidation;
    await this.awaitConfigureValidation();

    // Handle "Cannot import" — change key to avoid finalized version collision
    if (await this.page.getByText('Cannot import').isVisible()) {
      const currentKey = await this.configureKeyInput.inputValue();
      const uniqueSuffix = Date.now().toString(36);
      const validationPromise = this.waitForKeyValidationResponse();
      await this.changeConfigureKey(`${currentKey}-${uniqueSuffix}`);
      await validationPromise;
    }

    // Handle draft override warning — check the confirmation checkbox
    if (await this.overrideCheckbox.isVisible()) {
      await this.overrideCheckbox.locator('label').click();
    }

    const key = await this.configureKeyInput.inputValue();
    const name = await this.configureNameInput.inputValue();

    const responsePromise = this.page.waitForResponse(
      res =>
        res.url().includes('/api/management/v1/case/import') && res.request().method() === 'POST'
    );
    await expect(this.uploadWizardNextButton).toBeEnabled({timeout: 10_000});
    await this.uploadWizardNextButton.click();

    return {response: await responsePromise, key, name};
  }

  async configureStepWithCustomKey(name: string, key: string): Promise<ConfigureStepResult> {
    await expect(this.configureNameInput).toBeVisible();

    // Clear and fill custom name
    await this.configureNameInput.clear();
    await this.configureNameInput.fill(name);

    // Enable key editing and fill custom key.
    const keyValidationPromise = this.waitForKeyValidationResponse();
    await this.changeConfigureKey(key);
    await keyValidationPromise;

    // Handle "Cannot import" — change key to avoid finalized version collision
    if (await this.page.getByText('Cannot import').isVisible()) {
      const uniqueSuffix = Date.now().toString(36);
      const retryValidationPromise = this.waitForKeyValidationResponse();
      await this.changeConfigureKey(`${key}-${uniqueSuffix}`);
      await retryValidationPromise;
    }

    // Handle draft override warning — check the confirmation checkbox
    // Must click the inner label, not the cds-checkbox host, for the checkedChange event to fire
    if (await this.overrideCheckbox.isVisible()) {
      await this.overrideCheckbox.locator('label').click();
    }

    const actualKey = await this.configureKeyInput.inputValue();
    const actualName = await this.configureNameInput.inputValue();

    const responsePromise = this.page.waitForResponse(
      res =>
        res.url().includes('/api/management/v1/case/import') && res.request().method() === 'POST'
    );
    await expect(this.uploadWizardNextButton).toBeEnabled({timeout: 10_000});
    await this.uploadWizardNextButton.click();

    return {response: await responsePromise, key: actualKey, name: actualName};
  }

  waitForKeyValidationResponse() {
    return this.page
      .waitForResponse(
        res =>
          /\/management\/v1\/case-definition\/[^/]+\/version/.test(res.url()) &&
          res.request().method() === 'GET',
        {timeout: 15_000}
      )
      .catch(() => {});
  }

  async awaitConfigureValidation() {
    await Promise.race([
      expect(this.uploadWizardNextButton).toBeEnabled({timeout: 15_000}).catch(() => {}),
      this.page
        .getByText('Cannot import')
        .waitFor({state: 'visible', timeout: 15_000})
        .catch(() => {}),
      this.overrideCheckbox.waitFor({state: 'visible', timeout: 15_000}).catch(() => {}),
    ]);
  }

  async changeConfigureKey(key: string) {
    if (await this.configureKeyEditButton.isVisible({timeout: 1000}).catch(() => false)) {
      await this.configureKeyEditButton.click();
      await expect(this.configureKeyEditButton).not.toBeVisible();
    }
    await this.configureKeyInput.clear();
    await this.configureKeyInput.fill(key);
  }

  async assertConfigurePreFilled(
    expectedName: string,
    expectedKey: string,
    expectedVersion: string
  ) {
    await expect(this.configureNameInput).toBeVisible();
    await expect(this.configureNameInput).toHaveValue(expectedName);
    await expect(this.configureKeyInput).toHaveValue(expectedKey);
    await expect(this.configureVersionTag).toContainText(expectedVersion);
  }

  async assertNewVersionWarning() {
    await expect(this.page.getByText('New version')).toBeVisible();
    await expect(
      this.page.getByText(
        'A case definition with this key already exists. This will be imported as a new version.'
      )
    ).toBeVisible();
    await expect(this.uploadWizardNextButton).toBeEnabled();
  }

  async assertExistingDraftWarning() {
    const dialog = this.page.getByRole('dialog');
    await expect(dialog.getByText('Warning', {exact: true})).toBeVisible();
    await expect(
      dialog.getByText(
        'A draft version with this key and version already exists. Importing will override the existing draft.'
      )
    ).toBeVisible();
    await expect(this.uploadWizardNextButton).toBeDisabled();
    await expect(this.overrideCheckbox).toBeVisible();
  }

  async assertExistingFinalWarning() {
    // Allow extra time for the debounced (400ms) key validation API to respond
    await expect(this.page.getByText('Cannot import')).toBeVisible({timeout: 10_000});
    await expect(
      this.page.getByText('A finalized version with this key and version already exists.')
    ).toBeVisible();
    await expect(this.uploadWizardNextButton).toBeDisabled();
  }

  async accessControlStep() {
    await expect(this.page.getByText('Access control', {exact: true})).toBeVisible();
    await expect(
      this.page.getByText("Don't forget to set the rights in Access Control")
    ).toBeVisible();
    await this.uploadWizardNextButton.click();
  }

  async dashboardStep() {
    const dialog = this.page.getByRole('dialog');
    await expect(dialog.getByText('Dashboard', {exact: true})).toBeVisible();
    await expect(dialog.getByText('If you want widgets to appear on your dashboard')).toBeVisible();
    await this.uploadWizardFinishButton.click();
    await expect(this.page.locator('.cds--modal.is-visible')).not.toBeVisible();
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
