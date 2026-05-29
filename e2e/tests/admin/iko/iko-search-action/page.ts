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
import {CarbonList} from '../../../../shared/carbon-list/carbon-list.utils';
import {
  AUTO_KEY_INPUT_TEST_IDS,
  CONFIRMATION_MODAL_TEST_IDS,
  IKO_SEARCH_ACTION_MODAL_TEST_IDS,
  IKO_SEARCH_ACTIONS_TEST_IDS,
} from '../../../../constants';
import {apiDelete, apiGet, apiPost} from '../../../../utils/api.utils';

interface IkoSearchActionResponse {
  key: string;
  ikoViewKey: string;
  title: string;
  properties: Record<string, unknown>;
}

export class IkoSearchActionPage {
  constructor(
    private readonly page: Page,
    private readonly request: APIRequestContext
  ) {}

  // ─── Search actions tab ─────────────────────────────────────────────

  get list(): CarbonList {
    return new CarbonList(this.page);
  }

  /**
   * The "Add search action" button is rendered twice (once in the toolbar,
   * once as the no-results action). Scope to the toolbar so the locator is
   * unique regardless of whether the list is empty.
   */
  get addActionButton(): Locator {
    return this.list.toolbar.getByTestId(IKO_SEARCH_ACTIONS_TEST_IDS.addActionButton);
  }

  // ─── Search action modal ────────────────────────────────────────────

  get addModalHeading(): Locator {
    return this.page.getByRole('heading', {name: 'Add search action'});
  }

  get editModalHeading(): Locator {
    return this.page.getByRole('heading', {name: 'Edit search action'});
  }

  get titleInput(): Locator {
    return this.page.getByTestId(IKO_SEARCH_ACTION_MODAL_TEST_IDS.titleInput);
  }

  get keyInput(): Locator {
    return this.page.getByTestId(AUTO_KEY_INPUT_TEST_IDS.input);
  }

  get saveButton(): Locator {
    return this.page.getByTestId(IKO_SEARCH_ACTION_MODAL_TEST_IDS.saveButton);
  }

  get cancelButton(): Locator {
    return this.page.getByTestId(IKO_SEARCH_ACTION_MODAL_TEST_IDS.cancelButton);
  }

  /**
   * Best-effort dismissal of any open search action modal. Safe to call in
   * `afterEach`: if no modal is open, this is a no-op.
   */
  async closeAnyOpenModal(): Promise<void> {
    for (const heading of [this.addModalHeading, this.editModalHeading]) {
      if (await heading.isVisible().catch(() => false)) {
        await this.cancelButton.click().catch(() => undefined);
        await heading.waitFor({state: 'hidden', timeout: 5_000}).catch(() => undefined);
      }
    }
  }

  // ─── Delete confirmation modal ──────────────────────────────────────

  get confirmDeleteButton(): Locator {
    return this.page.getByTestId(CONFIRMATION_MODAL_TEST_IDS.confirmButton);
  }

  // ─── Navigation ─────────────────────────────────────────────────────

  /** Navigate directly to the Search actions tab of a given view. */
  async goToSearchActionsTab(apiKey: string, viewKey: string): Promise<void> {
    // The tab is exposed by the SEARCH_FIELDS enum (value `search`) — this is
    // the URL fragment for the "Search actions" tab.
    await this.page.goto(`/iko-management/${apiKey}/${viewKey}/search`);
    await this.list.waitForLoaded();
  }

  // ─── Actions ────────────────────────────────────────────────────────

  async openAddModal(): Promise<void> {
    await this.addActionButton.click();
    await expect(this.addModalHeading).toBeVisible();
  }

  async openEditModal(title: string): Promise<void> {
    await this.list.row(title).clickAction('Edit');
    await expect(this.editModalHeading).toBeVisible();
  }

  async save(): Promise<void> {
    await expect(this.saveButton).toBeEnabled();
    await this.saveButton.click();
    // Both add and edit modals close on save.
    await expect(this.addModalHeading).toBeHidden();
    await expect(this.editModalHeading).toBeHidden();
  }

  /** Full happy-path creation. Returns the auto-generated key. */
  async createSearchAction(title: string): Promise<string> {
    await this.openAddModal();
    await this.titleInput.fill(title);
    // The key auto-generates from the title.
    await expect(this.keyInput).not.toHaveValue('');
    const key = await this.keyInput.inputValue();
    await this.save();
    await this.assertActionVisible(title);
    return key;
  }

  async openDeleteDialog(title: string): Promise<void> {
    await this.list.row(title).clickAction('Delete');
    await expect(this.confirmDeleteButton).toBeVisible();
  }

  async confirmDelete(): Promise<void> {
    await this.confirmDeleteButton.click();
    await expect(this.confirmDeleteButton).toBeHidden();
  }

  async deleteSearchAction(title: string): Promise<void> {
    await this.openDeleteDialog(title);
    await this.confirmDelete();
    await this.assertActionNotVisible(title);
  }

  /**
   * Click a search action row to navigate to its details page (the search
   * fields list for the action).
   */
  async openSearchActionDetails(title: string): Promise<void> {
    await this.list.row(title).click();
  }

  // ─── Assertions ─────────────────────────────────────────────────────

  async assertActionVisible(title: string): Promise<void> {
    await this.list.row(title).assertVisible();
  }

  async assertActionNotVisible(title: string): Promise<void> {
    await this.list.row(title).assertNotVisible();
  }

  // ─── API helpers (setup / cleanup) ──────────────────────────────────

  /**
   * Create a search action directly via the management API. The key is
   * slugified from the title, mirroring the auto-key input's logic.
   * Returns the slugified key.
   */
  async createSearchActionViaApi(viewKey: string, title: string): Promise<string> {
    const key = title
      .toLowerCase()
      .replace(/[^a-z0-9-_]+|-[^a-z0-9]+/g, '-')
      .replace(/^[^a-z]+/g, '');
    await apiPost(`/api/management/v1/iko-view/${viewKey}/search-action/${key}`, {
      title,
      properties: {},
    });
    return key;
  }

  async getSearchActionsViaApi(viewKey: string): Promise<IkoSearchActionResponse[]> {
    return apiGet<IkoSearchActionResponse[]>(
      `/api/management/v1/iko-view/${viewKey}/search-action`
    );
  }

  async deleteSearchActionViaApi(viewKey: string, actionKey: string): Promise<void> {
    try {
      await apiDelete(`/api/management/v1/iko-view/${viewKey}/search-action/${actionKey}`);
    } catch {
      // Action may already be deleted or never created.
    }
  }

  /** Delete every search action under `viewKey` whose title starts with `titlePrefix`. */
  async cleanupTestActionsViaApi(viewKey: string, titlePrefix: string): Promise<void> {
    try {
      const actions = await this.getSearchActionsViaApi(viewKey);
      for (const action of actions) {
        if (action.title?.startsWith(titlePrefix)) {
          await this.deleteSearchActionViaApi(viewKey, action.key);
        }
      }
    } catch {
      // Listing failed — nothing reliable to clean up.
    }
  }
}
