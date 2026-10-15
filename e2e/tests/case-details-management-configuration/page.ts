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

import {expect, Page} from '@playwright/test';
import * as ApiUtils from '../../utils/api.utils';
import {CarbonList, CarbonListRow} from '../../shared/carbon-list/carbon-list.utils';
import {ensureDraftVersionSelected} from '../../utils/version.utils';

interface CaseConfigurationItem {
  key: string;
  defaultValue: string | null;
  environmentValue: string | null;
}

interface CaseVersion {
  versionTag: string;
  final?: boolean;
}

const configurationUrl = (caseDefinitionKey: string, versionTag: string) =>
  `/api/management/v1/case-definition/${caseDefinitionKey}/version/${versionTag}/configuration`;

export class CaseDetailsManagementConfigurationPage {
  constructor(private readonly page: Page) {}

  // ─── UI Elements ──────────────────────────────────────────────────

  get configurationTab() {
    return this.page.getByRole('tab', {name: 'Configuration'});
  }

  get list() {
    return new CarbonList(
      this.page,
      this.page.locator('ng-component').filter({has: this.page.getByTestId('caseConfigurationList')})
    );
  }

  get addButton() {
    return this.page.getByTestId('caseConfigurationAddButton');
  }

  get keyInput() {
    return this.page.getByTestId('caseConfigurationKeyInput');
  }

  get defaultValueInput() {
    return this.page.getByTestId('caseConfigurationDefaultValueInput');
  }

  get addConfirmButton() {
    return this.page.getByTestId('caseConfigurationAddConfirmButton');
  }

  get saveButton() {
    return this.page.getByTestId('caseConfigurationSaveButton');
  }

  get environmentValueInput() {
    return this.page.getByTestId('caseConfigurationEnvironmentValueInput');
  }

  get environmentValueSaveButton() {
    return this.page.getByTestId('caseConfigurationEnvironmentValueSaveButton');
  }

  row(key: string): CarbonListRow {
    return this.list.row(new RegExp(`^${key}$`));
  }

  // ─── Navigation ───────────────────────────────────────────────────

  async goToDraftConfiguration(caseIdentifier: string): Promise<string> {
    await this.page.goto('/case-management');
    await this.page.waitForSelector('valtimo-carbon-list');
    await this.page.locator(`tr:has(td:has-text("${caseIdentifier}"))`).click();
    const versionTag = await ensureDraftVersionSelected(this.page);
    await this.openConfigurationTab();
    return versionTag;
  }

  async goToConfiguration(caseDefinitionKey: string, versionTag: string) {
    await this.page.goto(`/case-management/case/${caseDefinitionKey}/version/${versionTag}/general`);
    await this.openConfigurationTab();
  }

  async openConfigurationTab() {
    await this.configurationTab.click();
    await expect(this.page).toHaveURL(/\/configuration$/);
    await this.list.waitForVisible();
  }

  async reload() {
    await this.page.reload();
    await expect(this.page).toHaveURL(/\/configuration$/);
    await this.list.waitForVisible();
  }

  // ─── Actions ──────────────────────────────────────────────────────

  async addDeclaration(key: string, defaultValue: string) {
    await this.addButton.first().click();
    await this.keyInput.fill(key);
    await this.defaultValueInput.fill(defaultValue);
    await expect(this.addConfirmButton).toBeEnabled();
    await this.addConfirmButton.click();
  }

  async editDefaultValue(key: string, defaultValue: string) {
    await this.row(key).clickAction('Edit');
    await this.defaultValueInput.fill(defaultValue);
    await expect(this.saveButton).toBeEnabled();
    await this.saveButton.click();
  }

  async setEnvironmentValue(key: string, value: string) {
    await this.row(key).clickAction('Set environment value');
    await this.environmentValueInput.fill(value);
    await this.environmentValueSaveButton.click();
  }

  async clearEnvironmentValue(key: string) {
    await this.row(key).clickAction('Clear environment value');
    await this.page.getByRole('button', {name: 'Clear', exact: true}).click();
  }

  async deleteDeclaration(key: string) {
    await this.row(key).clickAction('Delete');
    await this.page.getByRole('button', {name: 'Delete'}).click();
  }

  // ─── Assertions ───────────────────────────────────────────────────

  async assertRow(key: string, defaultValue: string, environmentValue: string) {
    const row = this.row(key);
    await row.assertVisible();
    await expect(row.cellByIndex(1)).toHaveText(defaultValue);
    await expect(row.cellByIndex(2)).toHaveText(environmentValue);
  }

  // ─── API Fixtures ─────────────────────────────────────────────────

  async ensureFinalCaseWithDeclaration(
    caseDefinitionKey: string,
    versionTag: string,
    configurationKey: string,
    defaultValue: string
  ) {
    const versions = await ApiUtils.apiGet<CaseVersion[]>(
      `/api/management/v1/case-definition/${caseDefinitionKey}/version?size=100`
    ).catch(error => {
      if (ApiUtils.isApiStatus(error, 404)) return [] as CaseVersion[];
      throw error;
    });
    const existing = versions.find(version => version.versionTag === versionTag);
    if (existing?.final) return;

    if (!existing) {
      await ApiUtils.apiPost('/api/management/v1/case-definition/draft', {
        caseDefinitionKey,
        caseDefinitionVersion: versionTag,
        name: 'E2E case configuration fixture',
        description:
          'Fixture for the case configuration tests. Finalized on purpose and therefore permanent.',
      });
    }

    const declarations = await ApiUtils.apiGet<CaseConfigurationItem[]>(
      configurationUrl(caseDefinitionKey, versionTag)
    );
    if (!declarations.some(item => item.key === configurationKey)) {
      await ApiUtils.apiPost(configurationUrl(caseDefinitionKey, versionTag), {
        key: configurationKey,
        defaultValue,
      });
    }

    await ApiUtils.apiPost(
      `/api/management/v1/case-definition/${caseDefinitionKey}/version/${versionTag}/finalize`,
      {}
    );
  }

  async cleanupStaleDeclarationsViaApi(caseDefinitionKey: string, versionTag: string) {
    try {
      const items = await ApiUtils.apiGet<CaseConfigurationItem[]>(
        configurationUrl(caseDefinitionKey, versionTag)
      );
      for (const item of items) {
        if (item.key.startsWith('e2e-')) {
          await this.deleteDeclarationViaApi(caseDefinitionKey, versionTag, item.key);
        }
      }
    } catch {
      // Ignore errors
    }
  }

  async deleteDeclarationViaApi(caseDefinitionKey: string, versionTag: string, key: string) {
    try {
      await ApiUtils.apiDelete(`${configurationUrl(caseDefinitionKey, versionTag)}/${key}`);
    } catch {
      // Declaration may already have been deleted by the test
    }
  }

  async clearEnvironmentValueViaApi(caseDefinitionKey: string, versionTag: string, key: string) {
    try {
      await ApiUtils.apiDelete(
        `${configurationUrl(caseDefinitionKey, versionTag)}/${key}/environment-value`
      );
    } catch {
      // Nothing to clear
    }
  }
}
