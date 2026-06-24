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

import {APIRequestContext, expect, Locator, Page} from '@playwright/test';
import {ZGW_CASE_SYNC_TEST_IDS, ZGW_CASE_TYPE_LINK_TEST_IDS} from '../../constants';
import {apiDelete, apiGet, apiPost, apiPut} from '../../utils/api.utils';
import {DocumentObjectenApiSync, ObjectManagementConfiguration} from './case-sync.types';
import {PluginConfiguration, ZaakType, ZaakTypeLink} from './case-type-link.types';

async function apiGetNullable<T>(url: string): Promise<T | null> {
  try {
    const result = await apiGet<T>(url);
    return result ?? null;
  } catch (err) {
    if (err instanceof SyntaxError) return null;
    throw err;
  }
}

export class CaseDetailsManagementZgwGeneralPage {
  constructor(
    private readonly page: Page,
    private readonly request: APIRequestContext
  ) {}

  // ─── Tab navigation ──────────────────────────────────────────────

  get zgwTab(): Locator {
    return this.page.getByRole('tab', {name: 'ZGW', exact: true});
  }

  get zgwGeneralTab(): Locator {
    return this.page
      .locator('cds-tabs:not([data-test-id="caseManagementTabs"])')
      .getByRole('tab', {name: 'General', exact: true});
  }

  // ─── Case sync tile locators (6.98) ──────────────────────────────

  get caseSyncTile(): Locator {
    return this.page.locator('valtimo-document-objecten-api-sync');
  }

  get caseSyncAddButton(): Locator {
    return this.page.getByTestId(ZGW_CASE_SYNC_TEST_IDS.addButton);
  }

  get caseSyncEditButton(): Locator {
    return this.page.getByTestId(ZGW_CASE_SYNC_TEST_IDS.editButton);
  }

  get caseSyncDeleteButton(): Locator {
    return this.page.getByTestId(ZGW_CASE_SYNC_TEST_IDS.deleteButton);
  }

  get caseSyncConfigSelect(): Locator {
    return this.page.getByTestId(ZGW_CASE_SYNC_TEST_IDS.modalConfigSelect);
  }

  get caseSyncEnabledCheckbox(): Locator {
    return this.page.getByTestId(ZGW_CASE_SYNC_TEST_IDS.modalEnabledCheckbox);
  }

  get caseSyncModalSubmitButton(): Locator {
    return this.page.getByTestId(ZGW_CASE_SYNC_TEST_IDS.modalSubmitButton);
  }

  get caseSyncModalCancelButton(): Locator {
    return this.page.getByTestId(ZGW_CASE_SYNC_TEST_IDS.modalCancelButton);
  }

  get caseSyncConfigTitle(): Locator {
    return this.caseSyncTile.locator('.valtimo-objecten-sync__card-title');
  }

  // ─── Case type link tile locators (6.99 – 6.101) ─────────────────

  get caseTypeLinkTile(): Locator {
    return this.page.locator('valtimo-zaken-api-zaaktype-link');
  }

  get caseTypeLinkLinkButton(): Locator {
    return this.page.getByTestId(ZGW_CASE_TYPE_LINK_TEST_IDS.linkButton);
  }

  get caseTypeLinkEditButton(): Locator {
    return this.page.getByTestId(ZGW_CASE_TYPE_LINK_TEST_IDS.editButton);
  }

  get caseTypeLinkDeleteButton(): Locator {
    return this.page.getByTestId(ZGW_CASE_TYPE_LINK_TEST_IDS.deleteButton);
  }

  get caseTypeLinkZaakTypeSelect(): Locator {
    return this.page.getByTestId(ZGW_CASE_TYPE_LINK_TEST_IDS.modalZaakTypeSelect);
  }

  get caseTypeLinkPluginSelect(): Locator {
    return this.page.getByTestId(ZGW_CASE_TYPE_LINK_TEST_IDS.modalPluginSelect);
  }

  get caseTypeLinkRsinInput(): Locator {
    return this.page.getByTestId(ZGW_CASE_TYPE_LINK_TEST_IDS.modalRsinInput);
  }

  get caseTypeLinkAutoCreateToggle(): Locator {
    return this.page.getByTestId(ZGW_CASE_TYPE_LINK_TEST_IDS.modalAutoCreateToggle);
  }

  get caseTypeLinkModalSubmitButton(): Locator {
    return this.page.getByTestId(ZGW_CASE_TYPE_LINK_TEST_IDS.modalSubmitButton);
  }

  get caseTypeLinkModalCancelButton(): Locator {
    return this.page.getByTestId(ZGW_CASE_TYPE_LINK_TEST_IDS.modalCancelButton);
  }

  get caseTypeLinkTitle(): Locator {
    return this.caseTypeLinkTile.locator('.valtimo-zaak-type-link__card-title');
  }

  get caseTypeLinkBody(): Locator {
    return this.caseTypeLinkTile.locator('.valtimo-zaak-type-link__card-body');
  }

  // ─── Navigation ──────────────────────────────────────────────────

  async goToCaseManagementForCase(caseIdentifier: string) {
    await this.page.getByRole('button', {name: 'Admin'}).click();
    await this.page.getByRole('link', {name: 'Cases'}).click();
    await this.page.waitForSelector('valtimo-carbon-list');
    await this.page.locator(`tr:has(td:has-text("${caseIdentifier}"))`).click();
  }

  async openZgwGeneralTab() {
    await this.zgwTab.click();
    await this.zgwGeneralTab.click();
    await expect(this.caseSyncTile).toBeVisible();
    await expect(this.caseTypeLinkTile).toBeVisible();
  }

  // ─── Case sync interactions ──────────────────────────────────────

  async openCaseSyncEditModal() {
    await expect(this.caseSyncEditButton).toBeVisible();
    await this.caseSyncEditButton.click();
    await expect(this.caseSyncEnabledCheckbox).toBeVisible();
  }

  async openCaseSyncAddModal() {
    await expect(this.caseSyncAddButton).toBeVisible();
    await this.caseSyncAddButton.click();
    await expect(this.caseSyncEnabledCheckbox).toBeVisible();
  }

  async selectCaseSyncConfig(configTitle: string) {
    await this.caseSyncConfigSelect
      .locator('.cds--list-box__field')
      .first()
      .click();
    await this.page
      .getByRole('listbox')
      .getByRole('option', {name: configTitle, exact: true})
      .click();
  }

  async toggleCaseSyncEnabled() {
    // Click the checkbox label — cds-checkbox wraps an inner label element.
    await this.caseSyncEnabledCheckbox.locator('label').first().click();
  }

  async submitCaseSyncModal() {
    await expect(this.caseSyncModalSubmitButton).toBeEnabled();
    await this.caseSyncModalSubmitButton.click();
    await expect(this.caseSyncEnabledCheckbox).not.toBeVisible();
  }

  async deleteCaseSync() {
    await expect(this.caseSyncDeleteButton).toBeVisible();
    await this.caseSyncDeleteButton.click();
    await expect(this.caseSyncAddButton).toBeVisible();
  }

  // ─── Case sync assertions ────────────────────────────────────────

  async assertCaseSyncConfigTitle(title: string) {
    await expect(this.caseSyncConfigTitle).toHaveText(title);
  }

  async assertCaseSyncEnabledText(expected: 'Yes' | 'No') {
    await expect(
      this.caseSyncTile.locator('.valtimo-objecten-sync__card-body > div').first()
    ).toContainText(expected);
  }

  async assertCaseSyncSubmitDisabled() {
    await expect(this.caseSyncModalSubmitButton).toBeDisabled();
  }

  // ─── Case type link interactions ─────────────────────────────────

  async openCaseTypeLinkEditModal() {
    await expect(this.caseTypeLinkEditButton).toBeVisible();
    await this.caseTypeLinkEditButton.click();
    await expect(this.caseTypeLinkZaakTypeSelect).toBeVisible();
  }

  async openCaseTypeLinkLinkModal() {
    await expect(this.caseTypeLinkLinkButton).toBeVisible();
    await this.caseTypeLinkLinkButton.click();
    await expect(this.caseTypeLinkZaakTypeSelect).toBeVisible();
  }

  async selectZaakTypeByUrl(url: string) {
    const select = this.caseTypeLinkZaakTypeSelect.locator('select');
    await expect(select.locator(`option[value="${url}"]`).first()).toHaveCount(1);
    await select.selectOption(url);
  }

  async selectPluginById(pluginId: string) {
    const select = this.caseTypeLinkPluginSelect.locator('select');
    await expect(select.locator(`option[value="${pluginId}"]`).first()).toHaveCount(1);
    await select.selectOption(pluginId);
  }

  async fillRsin(value: string) {
    await this.caseTypeLinkRsinInput.fill(value);
  }

  async submitCaseTypeLinkModal() {
    await expect(this.caseTypeLinkModalSubmitButton).toBeEnabled();
    await this.caseTypeLinkModalSubmitButton.click();
    await expect(this.caseTypeLinkZaakTypeSelect).not.toBeVisible();
  }

  async deleteCaseTypeLink() {
    await expect(this.caseTypeLinkDeleteButton).toBeVisible();
    await this.caseTypeLinkDeleteButton.click();
    await expect(this.caseTypeLinkLinkButton).toBeVisible();
  }

  // ─── Case type link assertions ───────────────────────────────────

  async assertCaseTypeLinkTitle(title: string) {
    await expect(this.caseTypeLinkTitle).toHaveText(title);
  }

  async assertCaseTypeLinkRsinValue(rsin: string) {
    await expect(this.caseTypeLinkBody).toContainText(rsin);
  }

  async assertCaseTypeLinkAutoCreateValue(expected: 'Yes' | 'No') {
    await expect(
      this.caseTypeLinkBody.locator('div').first()
    ).toContainText(expected);
  }

  async assertCaseTypeLinkSubmitDisabled() {
    await expect(this.caseTypeLinkModalSubmitButton).toBeDisabled();
  }

  // ─── API helpers: case sync ──────────────────────────────────────

  async getCaseSync(
    caseKey: string,
    version: string
  ): Promise<DocumentObjectenApiSync | null> {
    return apiGetNullable<DocumentObjectenApiSync>(
      `/api/management/v1/case-definition/${caseKey}/version/${version}/objecten-api-sync`
    );
  }

  async putCaseSync(
    caseKey: string,
    version: string,
    config: {objectManagementConfigurationId: string; enabled: boolean}
  ) {
    await apiPut(
      `/api/management/v1/case-definition/${caseKey}/version/${version}/objecten-api-sync`,
      config
    );
  }

  async deleteCaseSyncViaApi(caseKey: string, version: string) {
    try {
      await apiDelete(
        `/api/management/v1/case-definition/${caseKey}/version/${version}/objecten-api-sync`
      );
    } catch {
      // Resource may already be deleted.
    }
  }

  async getObjectManagementConfigurations(): Promise<ObjectManagementConfiguration[]> {
    return apiGet<ObjectManagementConfiguration[]>(
      `/api/management/v1/object/management/configuration`
    );
  }

  // ─── API helpers: case type link ─────────────────────────────────

  async getCaseTypeLink(
    caseKey: string,
    version: string
  ): Promise<ZaakTypeLink | null> {
    return apiGetNullable<ZaakTypeLink>(
      `/api/management/v1/case-definition/${caseKey}/version/${version}/zaak-type-link`
    );
  }

  async postCaseTypeLink(
    caseKey: string,
    version: string,
    link: Omit<ZaakTypeLink, 'id'>
  ) {
    await apiPost(
      `/api/management/v1/case-definition/${caseKey}/version/${version}/zaak-type-link`,
      {...link, caseDefinitionKey: caseKey, caseVersionTag: version}
    );
  }

  async deleteCaseTypeLinkViaApi(caseKey: string, version: string) {
    try {
      await apiDelete(
        `/api/management/v1/case-definition/${caseKey}/version/${version}/zaak-type-link`
      );
    } catch {
      // Resource may already be deleted.
    }
  }

  async getZaakTypes(): Promise<ZaakType[]> {
    return apiGet<ZaakType[]>(`/api/management/v1/zgw/zaaktype`);
  }

  async getZakenApiPluginConfigurations(): Promise<PluginConfiguration[]> {
    return apiGet<PluginConfiguration[]>(
      `/api/v1/plugin/configuration?pluginDefinitionKey=zakenapi`
    );
  }
}
