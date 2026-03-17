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

import {type Locator, type Page, type APIRequestContext, expect} from '@playwright/test';
import {PROCESS_MANAGEMENT_LIST_TEST_IDS} from '../../constants';
import {CarbonList} from '../../shared/carbon-list/carbon-list.utils';
import path from 'path';

const BPMN_ASSET_PATH = path.resolve(__dirname, '../../assets/e2e-test-process.bpmn');

export class CaseDetailsProcessesPage {
  readonly carbonList: CarbonList;
  private readonly processListScope: Locator;

  constructor(
    private readonly page: Page,
    private readonly request: APIRequestContext
  ) {
    this.processListScope = page.locator('valtimo-process-management-list');
    this.carbonList = new CarbonList(page, this.processListScope);
  }

  // Locators

  get uploadButton() {
    return this.carbonList.toolbar.getByRole('button').filter({hasText: /^$/}).first();
  }

  get createProcessButton() {
    return this.processListScope.getByRole('button', {name: 'Create process'});
  }

  get uploadModal() {
    return this.page.locator('valtimo-process-management-upload cds-modal');
  }

  get uploadModalCancelButton() {
    return this.uploadModal.getByRole('button', {name: 'Cancel'});
  }

  get uploadModalUploadButton() {
    return this.uploadModal.getByRole('button', {name: 'Upload', exact: true});
  }

  get uploadModalFileInput() {
    return this.uploadModal.locator('input[type="file"]');
  }

  get deleteConfirmationModal() {
    return this.processListScope.locator('valtimo-confirmation-modal cds-modal');
  }

  get deleteConfirmButton() {
    return this.deleteConfirmationModal.getByRole('button', {name: 'Delete'});
  }

  // Builder page locators

  get builderContainer() {
    return this.page.locator('.bpmn__container');
  }

  get builderBackButton() {
    return this.page.getByRole('button', {name: 'Back'});
  }

  get builderSaveButton() {
    return this.page.getByRole('button', {name: 'Save'});
  }

  get startsCaseToggle() {
    return this.page.getByText('Starts case');
  }

  get startableByUserToggle() {
    return this.page.getByText('Startable by user');
  }

  // Navigation

  async goToCaseDetailsProcesses(caseIdentifier: string) {
    await this.page.getByRole('button', {name: 'Admin'}).click();
    await this.page.getByRole('link', {name: 'Cases'}).click();
    await this.page.waitForSelector('valtimo-carbon-list');
    await this.page.locator(`tr:has(td:has-text("${caseIdentifier}"))`).click();
    await this.page.waitForURL(/\/case-management\/case\//);
    await this.page.getByRole('tab', {name: 'Processes'}).click();
    await this.page.waitForURL(/\/processes/);
    await this.carbonList.waitForLoaded();
  }

  // Actions

  async openUploadModal() {
    await this.uploadButton.click();
    await expect(this.uploadModal).toHaveAttribute('ng-reflect-open', 'true');
  }

  async closeUploadModal() {
    await this.uploadModalCancelButton.click();
    await expect(this.uploadModal).toHaveAttribute('ng-reflect-open', 'false');
  }

  async uploadProcess() {
    await this.openUploadModal();
    await this.uploadModalFileInput.setInputFiles(BPMN_ASSET_PATH);
    await expect(this.uploadModalUploadButton).toBeEnabled();
    await this.uploadModalUploadButton.click();
    await expect(this.uploadModal).toHaveAttribute('ng-reflect-open', 'false');
    await this.carbonList.waitForLoaded();
  }

  async clickProcessRow(processName: string) {
    const row = this.carbonList.row(processName);
    await row.click();
  }

  async deleteProcess(processName: string) {
    const row = this.carbonList.row(processName);
    await row.clickAction('Delete');
    await expect(this.deleteConfirmationModal).toHaveAttribute('ng-reflect-open', 'true');
    await this.deleteConfirmButton.click();
  }

  async navigateBackFromBuilder() {
    await this.builderBackButton.click();
    await this.page.waitForURL(/\/processes$/);
    await this.carbonList.waitForLoaded();
  }
}
