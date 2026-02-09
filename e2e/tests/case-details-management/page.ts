import {APIRequestContext, expect, Page} from '@playwright/test';
import {PluginFieldMap, pluginTestConfiguration} from '../plugins/plugin-config';
import {
  caseConfiguration,
  caseExternalFormConfiguration,
  CaseManagementFieldMap,
} from './case-config';
import path from 'path';

const DEFAULT_CASE_ARCHIVE = 'test-case-import-success_1.0.0.case.zip';

export interface UploadCaseOptions {
  archiveName?: string;
}

export class CaseDetailsManagementPage {
  constructor(private readonly page: Page, private readonly request: APIRequestContext) {}

  // UI Elements
  get versionSelectDropdown() {
    return this.page.getByTestId('caseVersionSelectDropdown');
  }

  get versionManagementButton() {
    return this.page.getByTestId('caseVersionManagementButton');
  }

  get moreButton() {
    return this.page.getByTestId('caseMoreButton');
  }

  get exportButton() {
    return this.page.getByTestId('caseExportButton');
  }

  get setActiveVersionButton() {
    return this.page.getByRole('menuitem', {name: 'Set as active version'});
  }

  get seeAllVersionsButton() {
    return this.page.getByTestId('caseSeeAllVersionsButton');
  }

  get caseHandlerCanHaveHandlerToggle() {
    return this.page.getByTestId('caseHandlerCanHaveHandler').locator('.cds--toggle__switch');
  }

  get caseHandlerCanHaveHandler() {
    return this.page.getByTestId('caseHandlerCanHaveHandler');
  }

  get caseHandlerAutomaticallyAssignToggle() {
    return this.page.getByTestId('caseHandlerAutomaticallyAssign').locator('.cds--toggle__switch');
  }

  get caseHandlerAutomaticallyAssign() {
    return this.page.getByTestId('caseHandlerAutomaticallyAssign');
  }

  get hasExternalForm() {
    return this.page.getByTestId('caseManagementHasExternalForm').getByRole('switch');
  }

  get hasExternalFormToggle() {
    return this.page.getByTestId('caseManagementHasExternalForm').locator('.cds--toggle__switch');
  }

  get externalFormUrl() {
    return this.page.getByTestId('caseManagementExternalFormUrl');
  }

  get externalFormDescription() {
    return this.page.getByTestId('caseManagementExternalFormDescription');
  }

  get externalFormSave() {
    return this.page.getByTestId('caseManagementExternalFormSave');
  }

  get confirmationModalContinueButton() {
    return this.page.getByRole('button', {name: 'Continue'});
  }

  get confirmationModalSetActiveButton() {
    return this.page.getByRole('button', {name: 'Set as active version'});
  }

  // Navigation
  async goToCaseDetailsManagement(caseIdentifier: string) {
    console.log('Navigate to Case Details Management...');
    await this.page.getByRole('button', {name: 'Admin'}).click();
    await this.page.getByRole('link', {name: 'Cases'}).click();
    await this.page.waitForSelector('valtimo-carbon-list');
    await this.page.locator(`tr:has(td:has-text("${caseIdentifier}"))`).click();
  }

  async switchCaseVersionViaDropdown(caseVersion: string) {
    await this.versionSelectDropdown.click();
    await this.page.getByRole('listbox').getByTestId(`caseVersion${caseVersion}`).click();
  }

  async switchCaseVersionViaList(caseVersion: string) {
    await this.versionSelectDropdown.click();
    await this.seeAllVersionsButton.click();
    await this.page.locator(`tr:has(td:has-text("${caseVersion}"))`).click();
  }

  async exportCaseDefinition() {
    await this.moreButton.click();
    const [download] = await Promise.all([
      this.page.waitForEvent('download'),
      this.exportButton.click(),
    ]);

    return download;
  }

  async makeVersionGlobal(caseVersion: string) {
    await this.switchCaseVersionViaDropdown(caseVersion);

    await this.moreButton.click();

    const item = this.setActiveVersionButton;
    await expect(item).toBeVisible();

    if (await item.isDisabled()) {
      return;
    }

    await item.click();
    await this.confirmationModalContinueButton.click();
    await this.confirmationModalSetActiveButton.click();
  }

  async fillInExternalForm() {
    await this.externalFormUrl.fill(caseExternalFormConfiguration.url);
    await this.externalFormDescription.fill(caseExternalFormConfiguration.description);
    await this.externalFormSave.click();
  }
}
