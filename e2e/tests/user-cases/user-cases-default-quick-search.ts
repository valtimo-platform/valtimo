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

import {expect, Locator, Page} from '@playwright/test';
import {QUICK_SEARCH_TEST_IDS} from '../../constants';
import {CarbonList} from '../../shared/carbon-list/carbon-list.utils';
import {apiDelete, apiGet, apiPost, apiPut} from '../../utils/api.utils';
import {generateId} from '../../utils/dataGenerator';

export const CASE_DEFINITION_KEY = 'layout-test';
export const OTHER_CASE_DEFINITION_KEY = 'bezwaar';
export const OTHER_CASE_DEFINITION_TITLE = 'Bezwaar';
export const CASE_DEFINITION_TITLE = 'Layout Test';

const QUICK_SEARCH_ENDPOINT = `/api/v1/case/${CASE_DEFINITION_KEY}/stored-quick-search`;
const USER_SETTINGS_ENDPOINT = '/api/v1/user/settings';

interface UserSettings {
  caseListDefaultQuickSearches?: {[caseDefinitionKey: string]: string};
}

export interface QuickSearch {
  title: string;
  statuses: string[];
}

/** Test data for the case list's quick searches, through the API. */
export const defaultQuickSearchApi = {
  async createQuickSearchViaApi(statuses: string[]): Promise<QuickSearch> {
    const title = `E2E ${generateId()}`.slice(0, 50);
    const queryPath = new URLSearchParams({status: btoa(JSON.stringify(statuses))}).toString();
    await apiPost(QUICK_SEARCH_ENDPOINT, {title, queryPath});
    return {title, statuses};
  },

  async deleteQuickSearchViaApi(quickSearch: QuickSearch) {
    try {
      await apiDelete(`${QUICK_SEARCH_ENDPOINT}/${encodeURIComponent(quickSearch.title)}`);
    } catch {
      // Already deleted
    }
  },

  async createCaseViaApi(): Promise<string> {
    const {caseDefinitionVersionTag} = await apiGet<{caseDefinitionVersionTag: string}>(
      `/api/management/v1/case-definition/${CASE_DEFINITION_KEY}`
    );
    const response = await apiPost<{document: {id: string}}>(
      '/api/v1/process-document/operation/new-document-and-start-process',
      {
        processDefinitionKey: CASE_DEFINITION_KEY,
        request: {
          definition: CASE_DEFINITION_KEY,
          caseDefinitionKey: CASE_DEFINITION_KEY,
          caseDefinitionVersionTag,
          content: {},
        },
      }
    );
    return response.document.id;
  },

  async deleteCaseViaApi(documentId: string) {
    try {
      await apiDelete(`/api/v1/document/${documentId}`);
    } catch {
      // Already deleted
    }
  },

  async defaultQuickSearchesViaApi(): Promise<{[caseDefinitionKey: string]: string}> {
    const settings = await apiGet<UserSettings>(USER_SETTINGS_ENDPOINT);
    return settings?.caseListDefaultQuickSearches ?? {};
  },

  async setDefaultQuickSearchesViaApi(defaults: {[caseDefinitionKey: string]: string}) {
    await apiPut(USER_SETTINGS_ENDPOINT, {caseListDefaultQuickSearches: defaults});
  },
};

export class DefaultQuickSearchPage {
  constructor(private readonly page: Page) {}

  // ─── Navigation ──────────────────────────────────────────────────

  /** Through the left menu, so the app navigates the way a user does. */
  async openCaseListFromMenu(caseDefinitionTitle: string, caseDefinitionKey: string) {
    const link = this.page
      .locator('.cds--side-nav a')
      .filter({hasText: caseDefinitionTitle})
      .first();

    if (!(await link.isVisible())) {
      await this.page
        .locator('cds-sidenav-menu, .cds--side-nav__submenu')
        .filter({has: this.page.locator('a', {hasText: caseDefinitionTitle})})
        .locator('button, .cds--side-nav__submenu')
        .first()
        .click();
    }

    await link.click();
    await this.page.waitForURL(new RegExp(`/cases/${caseDefinitionKey}(\\?|$)`));
    await this.caseList.waitForLoaded();
  }

  async openFirstCase() {
    await this.caseList.rows.first().click();
    await this.page.waitForURL(/\/document\//, {timeout: 30_000});
    await expect(this.detailTabs.first()).toBeVisible({timeout: 15_000});
  }

  async switchToSecondCaseTab() {
    await this.detailTabs.nth(1).click();
    await this.page.waitForURL(/\/document\/[^/]+\/[^/?]+/, {timeout: 15_000});
  }

  async returnThroughBreadcrumb() {
    await this.page
      .locator('.cds--breadcrumb a')
      .filter({hasText: CASE_DEFINITION_TITLE})
      .last()
      .click();
    await this.page.waitForURL(new RegExp(`/cases/${CASE_DEFINITION_KEY}(\\?|$)`));
    await this.caseList.waitForLoaded();
  }

  /** Enters the case without a row click, so nothing but the list itself records its filter. */
  async openCaseThroughBrowserForward() {
    await this.page.goForward();
    await this.page.waitForURL(/\/document\//, {timeout: 30_000});
    await expect(this.detailTabs.first()).toBeVisible({timeout: 15_000});
  }

  async returnThroughBrowserBack() {
    await this.page.goBack();
    await this.page.waitForURL(new RegExp(`/cases/${CASE_DEFINITION_KEY}(\\?|$)`));
    await this.caseList.waitForLoaded();
  }

  // ─── Quick search ────────────────────────────────────────────────

  quickSearchTag(quickSearch: QuickSearch): Locator {
    return this.page.getByTestId(QUICK_SEARCH_TEST_IDS.tag).filter({hasText: quickSearch.title});
  }

  defaultIcon(quickSearch: QuickSearch): Locator {
    return this.quickSearchTag(quickSearch).getByTestId(QUICK_SEARCH_TEST_IDS.defaultIcon);
  }

  async applyQuickSearch(quickSearch: QuickSearch) {
    await this.quickSearchTag(quickSearch).click();
    await this.expectStatusFilter(quickSearch.statuses);
    await this.caseList.waitForLoaded();
  }

  async chooseFromQuickSearchMenu(
    quickSearch: QuickSearch,
    option: 'setAsDefaultOption' | 'removeAsDefaultOption'
  ) {
    await this.quickSearchTag(quickSearch).click({button: 'right'});
    await this.page.getByTestId(QUICK_SEARCH_TEST_IDS[option]).click();
  }

  // ─── Assertions ──────────────────────────────────────────────────

  async expectStatusFilter(statuses: string[]) {
    await expect.poll(() => this.statusFilterInAddress()).toEqual(statuses);
  }

  statusFilterInAddress(): string[] | null {
    const status = new URL(this.page.url()).searchParams.get('status');
    return status ? JSON.parse(atob(status)) : null;
  }

  // ─── Locators ────────────────────────────────────────────────────

  get caseList(): CarbonList {
    return new CarbonList(this.page);
  }

  get detailTabs(): Locator {
    return this.page.locator('cds-tabs [role="tab"]');
  }
}
