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

import {APIRequestContext, expect, Page, Response} from '@playwright/test';
import {CarbonToggle} from '../../shared/carbon-toggle/carbon-toggle.utils';
import {PluginFieldMap, pluginTestConfiguration} from '../plugins/plugin-config';
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
} from '../../constants';

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

  get caseHandlerCanHaveHandler() {
    return this.page.getByTestId(CASE_MANAGEMENT_CASE_HANDLER_TEST_IDS.canHaveHandler);
  }

  get caseHandlerCanHaveHandlerToggle(): CarbonToggle {
    return new CarbonToggle(this.caseHandlerCanHaveHandler);
  }

  get caseHandlerAutomaticallyAssign() {
    return this.page.getByTestId(CASE_MANAGEMENT_CASE_HANDLER_TEST_IDS.automaticallyAssign);
  }

  get caseHandlerAutomaticallyAssignToggle(): CarbonToggle {
    return new CarbonToggle(this.caseHandlerAutomaticallyAssign);
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
  // Navigate directly to the case-management list, then open the case.
  // Avoids the Admin menu + chart-heavy dashboard load, which can hang the
  // beforeAll hook or crash the Chromium renderer ("Target crashed").
  async goToCaseDetailsManagement(caseIdentifier: string) {
    console.log('Navigate to Case Details Management...');
    await this.page.goto('/case-management');
    await this.page.waitForSelector('valtimo-carbon-list');
    await this.page.locator(`tr:has(td:has-text("${caseIdentifier}"))`).click();
    await this.page.waitForURL(/\/case-management\/case\//);
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
    await expect(this.linkUploadProcessInput).toBeEnabled({timeout: 15_000});
    await this.linkUploadProcessMenuButton.click();
    // Use exact matching: "Bezwaar" is a prefix of "Bezwaar ad-hoc FVM" etc.,
    // so a non-exact name match resolves to multiple options.
    await this.linkUploadProcessListbox
      .getByRole('option', {name: processName, exact: true})
      .click();
    // Selecting triggers a save round-trip that briefly disables the combo box.
    await expect(this.linkUploadProcessInput).toBeEnabled({timeout: 15_000});
  }

  async clearUploadProcess() {
    await expect(this.linkUploadProcessInput).toBeEnabled({timeout: 15_000});
    await this.linkUploadProcessClearButton.click();
    await expect(this.linkUploadProcessInput).toBeEnabled({timeout: 15_000});
  }

  // ─── Case handler settings ───────────────────────────────────────
  //
  // `valtimo-case-management-case-handler` binds `[checked]` one-way to the case
  // settings it fetches, and only `[disabled]` to its own in-flight state. So the
  // toggles render *enabled and unchecked* in the window between paint and the
  // settings GET resolving, and then snap to the persisted value. Reading the
  // toggle in that window reports a state that was never real, which is why these
  // assertions have to be anchored on the settings request rather than on
  // "the switch is enabled".

  private isCaseSettingsRequest(response: Response, method: 'GET' | 'PATCH'): boolean {
    return (
      /\/api\/management\/v1\/case-definition\/[^/]+\/version\/[^/]+\/settings$/.test(
        response.url()
      ) && response.request().method() === method
    );
  }

  /**
   * Run `trigger` (a navigation or reload) and resolve once the case settings the
   * handler toggles are bound to have actually arrived.
   */
  async waitForCaseSettingsLoaded(trigger: () => Promise<unknown>): Promise<void> {
    const loaded = this.page.waitForResponse(
      response => this.isCaseSettingsRequest(response, 'GET') && response.ok(),
      {timeout: 15_000}
    );
    await trigger();
    await loaded;
    await this.caseHandlerCanHaveHandlerToggle.assertEnabled();
  }

  /**
   * Flip a case-handler toggle and wait for the PATCH *and* the refresh GET that
   * re-feeds `[checked]`. Without waiting for both, the assertion races the
   * server: Carbon flips optimistically, then the refresh overwrites it.
   */
  private async toggleCaseHandlerSetting(toggle: CarbonToggle, checked: boolean): Promise<void> {
    if ((await toggle.isChecked()) === checked) return;

    const patched = this.page.waitForResponse(
      response => this.isCaseSettingsRequest(response, 'PATCH'),
      {timeout: 15_000}
    );
    const refreshed = this.page.waitForResponse(
      response => this.isCaseSettingsRequest(response, 'GET'),
      {timeout: 15_000}
    );

    await toggle.set(checked);

    expect((await patched).ok(), 'case settings PATCH should succeed').toBeTruthy();
    await refreshed;
    await toggle.assertChecked(checked);
  }

  async setCanHaveHandler(checked: boolean): Promise<void> {
    await this.toggleCaseHandlerSetting(this.caseHandlerCanHaveHandlerToggle, checked);
  }

  async setAutomaticallyAssign(checked: boolean): Promise<void> {
    await this.toggleCaseHandlerSetting(this.caseHandlerAutomaticallyAssignToggle, checked);
  }
}
