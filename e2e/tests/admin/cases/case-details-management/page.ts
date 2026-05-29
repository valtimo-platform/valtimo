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
import {PluginFieldMap, pluginTestConfiguration} from '../../plugins/plugin-config';
import {
  caseConfiguration,
  caseExternalFormConfiguration,
  CaseManagementFieldMap,
} from './case-config';
import path from 'path';
import {
  CASE_MANAGEMENT_DETAIL_ACTIONS_TEST_IDS,
  CASE_MANAGEMENT_CASE_HANDLER_TEST_IDS,
  CASE_MANAGEMENT_EXTERNAL_START_FORM_TEST_IDS,
  ZGW_LINK_UPLOAD_PROCESS_TEST_IDS,
} from '../../../../constants';

const DEFAULT_CASE_ARCHIVE = 'test-case-import-success_1.0.0.case.zip';

export interface UploadCaseOptions {
  archiveName?: string;
}

export class CaseDetailsManagementPage {
  constructor(private readonly page: Page, private readonly request: APIRequestContext) {}

  // UI Elements
  get versionSelectDropdown() {
    return this.page.getByTestId(CASE_MANAGEMENT_DETAIL_ACTIONS_TEST_IDS.versionSelectDropdown);
  }

  get versionManagementButton() {
    return this.page.getByTestId(CASE_MANAGEMENT_DETAIL_ACTIONS_TEST_IDS.versionManagementButton);
  }

  get moreButton() {
    return this.page.getByTestId(CASE_MANAGEMENT_DETAIL_ACTIONS_TEST_IDS.moreButton);
  }

  get exportButton() {
    return this.page.getByTestId(CASE_MANAGEMENT_DETAIL_ACTIONS_TEST_IDS.exportButton);
  }

  get setActiveVersionButton() {
    return this.page.getByTestId(CASE_MANAGEMENT_DETAIL_ACTIONS_TEST_IDS.setActiveVersionButton);
  }

  get seeAllVersionsButton() {
    return this.page.getByTestId('caseSeeAllVersionsButton');
  }

  get caseHandlerCanHaveHandlerToggle() {
    return this.page.getByTestId(CASE_MANAGEMENT_CASE_HANDLER_TEST_IDS.canHaveHandler).locator('.cds--toggle__switch');
  }

  get caseHandlerCanHaveHandler() {
    return this.page.getByTestId(CASE_MANAGEMENT_CASE_HANDLER_TEST_IDS.canHaveHandler);
  }

  get caseHandlerAutomaticallyAssignToggle() {
    return this.page.getByTestId(CASE_MANAGEMENT_CASE_HANDLER_TEST_IDS.automaticallyAssign).locator('.cds--toggle__switch');
  }

  get caseHandlerAutomaticallyAssign() {
    return this.page.getByTestId(CASE_MANAGEMENT_CASE_HANDLER_TEST_IDS.automaticallyAssign);
  }

  get hasExternalForm() {
    return this.page.getByTestId(CASE_MANAGEMENT_EXTERNAL_START_FORM_TEST_IDS.hasExternalForm).getByRole('switch');
  }

  get hasExternalFormToggle() {
    return this.page.getByTestId(CASE_MANAGEMENT_EXTERNAL_START_FORM_TEST_IDS.hasExternalForm).locator('.cds--toggle__switch');
  }

  get externalFormUrl() {
    return this.page.getByTestId(CASE_MANAGEMENT_EXTERNAL_START_FORM_TEST_IDS.externalFormUrl);
  }

  get externalFormDescription() {
    return this.page.getByTestId(CASE_MANAGEMENT_EXTERNAL_START_FORM_TEST_IDS.externalFormDescription);
  }

  get externalFormSave() {
    return this.page.getByTestId(CASE_MANAGEMENT_EXTERNAL_START_FORM_TEST_IDS.externalFormSave);
  }

  // Link upload process
  get linkUploadProcessComboBox() {
    return this.page.getByTestId(ZGW_LINK_UPLOAD_PROCESS_TEST_IDS.comboBox);
  }

  get linkUploadProcessInput() {
    return this.linkUploadProcessComboBox.getByRole('combobox');
  }

  get linkUploadProcessClearButton() {
    return this.linkUploadProcessComboBox.getByRole('button', {name: 'Clear Selection'});
  }

  get linkUploadProcessMenuButton() {
    return this.linkUploadProcessComboBox.getByRole('button', {name: /menu/i});
  }

  get linkUploadProcessListbox() {
    return this.linkUploadProcessComboBox.getByRole('listbox');
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

  async switchCaseVersionViaList() {
    await this.versionSelectDropdown.click();
    await this.seeAllVersionsButton.click();
    const firstRow = this.page.getByRole('row').nth(1);
    await firstRow.waitFor({state: 'visible'});
    await firstRow.click();
  }

  async exportCaseDefinition() {
    await this.moreButton.click();
    const [download] = await Promise.all([
      this.page.waitForEvent('download'),
      this.exportButton.click(),
    ]);

    return download;
  }

  async makeVersionGlobal(caseVersion: string): Promise<boolean> {
    await this.switchCaseVersionViaDropdown(caseVersion);

    await this.moreButton.click();

    const item = this.setActiveVersionButton;
    await expect(item).toBeVisible();

    // Check disabled state via the button
    const isDisabled = await item.evaluate(el => {
      const btn = el.querySelector('button') || el.querySelector('[role="menuitem"]');
      return btn ? (btn as HTMLButtonElement).disabled : el.hasAttribute('disabled');
    });
    if (isDisabled) {
      await this.page.keyboard.press('Escape');
      return false;
    }

    await item.click();
    await this.confirmationModalContinueButton.click();
    await this.confirmationModalSetActiveButton.click();
    return true;
  }

  async fillInExternalForm() {
    await this.externalFormUrl.fill(caseExternalFormConfiguration.url);
    await this.externalFormDescription.fill(caseExternalFormConfiguration.description);
    await this.externalFormSave.click();
  }

  async selectUploadProcess(processName: string) {
    await expect(this.linkUploadProcessInput).toBeEnabled();
    await this.linkUploadProcessMenuButton.click();
    await this.linkUploadProcessListbox.getByRole('option', {name: processName}).click();
    await expect(this.linkUploadProcessInput).toBeEnabled();
  }

  async clearUploadProcess() {
    await expect(this.linkUploadProcessInput).toBeEnabled();
    await this.linkUploadProcessClearButton.click();
    await expect(this.linkUploadProcessInput).toBeEnabled();
  }
}
