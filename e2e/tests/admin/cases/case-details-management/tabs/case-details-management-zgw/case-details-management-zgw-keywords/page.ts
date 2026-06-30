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
import {ZGW_KEYWORDS_TEST_IDS} from '../../../../../../../constants';
import {apiDelete, apiGet, apiPost} from '../../../../../../../utils/api.utils';
import {CarbonList} from '../../../../../../../shared/carbon-list/carbon-list.utils';
import {DocumentenApiTag, PagedKeywords} from './keywords.types';

export class CaseDetailsManagementZgwKeywordsPage {
  constructor(
    private readonly page: Page,
    private readonly request: APIRequestContext
  ) {}

  // ─── Tab navigation ──────────────────────────────────────────────

  get zgwTab(): Locator {
    return this.page.getByRole('tab', {name: 'ZGW', exact: true});
  }

  get keywordsTab(): Locator {
    return this.page
      .locator('cds-tabs:not([data-test-id="caseManagementTabs"])')
      .getByRole('tab', {name: 'Document tags', exact: true});
  }

  // ─── List locators ───────────────────────────────────────────────

  get list(): CarbonList {
    return new CarbonList(this.page, this.page.locator('valtimo-documenten-api-tags'));
  }

  get addButton(): Locator {
    return this.page
      .getByRole('region', {name: 'Table action bar'})
      .getByTestId(ZGW_KEYWORDS_TEST_IDS.addButton);
  }

  get deleteMultipleButton(): Locator {
    return this.page.getByTestId(ZGW_KEYWORDS_TEST_IDS.deleteMultipleButton);
  }

  // ─── Modal locators ──────────────────────────────────────────────

  get modalValueInput(): Locator {
    return this.page.getByTestId(ZGW_KEYWORDS_TEST_IDS.modalValueInput);
  }

  get modalSubmitButton(): Locator {
    return this.page.getByTestId(ZGW_KEYWORDS_TEST_IDS.modalSubmitButton);
  }

  get modalCancelButton(): Locator {
    return this.page.getByTestId(ZGW_KEYWORDS_TEST_IDS.modalCancelButton);
  }

  // ─── Navigation ──────────────────────────────────────────────────

  async goToCaseManagementForCase(caseIdentifier: string) {
    await this.page.getByRole('button', {name: 'Admin'}).click();
    await this.page.getByRole('link', {name: 'Cases'}).click();
    await this.page.waitForSelector('valtimo-carbon-list');
    await this.page.locator(`tr:has(td:has-text("${caseIdentifier}"))`).click();
  }

  async openKeywordsTab() {
    await this.zgwTab.click();
    await this.keywordsTab.click();
    await this.list.waitForLoaded();
  }

  // ─── UI actions ──────────────────────────────────────────────────

  async openAddModal() {
    await expect(this.addButton).toBeEnabled();
    await this.addButton.click();
    await expect(this.modalValueInput).toBeVisible();
  }

  async fillModalValue(value: string) {
    await this.modalValueInput.fill(value);
  }

  async submitModal() {
    await expect(this.modalSubmitButton).toBeEnabled();
    await this.modalSubmitButton.click();
    await expect(this.modalValueInput).not.toBeVisible();
  }

  async cancelModal() {
    await this.modalCancelButton.click();
    await expect(this.modalValueInput).not.toBeVisible();
  }

  async addKeywordViaUi(value: string) {
    await this.openAddModal();
    await this.fillModalValue(value);
    await this.submitModal();
  }

  async search(term: string) {
    await this.list.search(term);
  }

  async clearSearch() {
    await this.list.clearSearch();
  }

  // ─── Assertions ──────────────────────────────────────────────────

  async assertKeywordVisible(value: string) {
    await expect(this.list.row(value).cell(value)).toBeVisible();
  }

  async assertKeywordNotVisible(value: string) {
    await expect(
      this.list.table.locator('td', {hasText: new RegExp(`^${escapeRegex(value)}$`)})
    ).toHaveCount(0);
  }

  async assertModalSubmitDisabled() {
    await expect(this.modalSubmitButton).toBeDisabled();
  }

  // ─── API helpers ─────────────────────────────────────────────────

  async getKeywords(caseKey: string, search = ''): Promise<DocumentenApiTag[]> {
    const qs = new URLSearchParams({page: '0', size: '100'});
    if (search) qs.set('search', search);
    const res = await apiGet<PagedKeywords>(
      `/api/management/v1/case-definition/${caseKey}/zgw-document/trefwoord?${qs.toString()}`
    );
    return res.content;
  }

  async createKeywordViaApi(caseKey: string, value: string) {
    try {
      await apiPost(
        `/api/management/v1/case-definition/${caseKey}/zgw-document/trefwoord/${encodeURIComponent(value)}`,
        {}
      );
    } catch (err) {
      if (!(err instanceof SyntaxError)) throw err;
    }
  }

  async deleteKeywordViaApi(caseKey: string, value: string) {
    try {
      await apiDelete(
        `/api/management/v1/case-definition/${caseKey}/zgw-document/trefwoord/${encodeURIComponent(value)}`
      );
    } catch {
      // Keyword may already be deleted.
    }
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
