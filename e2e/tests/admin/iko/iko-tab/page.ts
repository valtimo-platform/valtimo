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
  IKO_PROPERTIES_TEST_IDS,
  IKO_TABS_TEST_IDS,
  IKO_TAB_DETAILS_MODAL_TEST_IDS,
} from '../../../../constants';
import {apiDelete, apiGet, apiPost} from '../../../../utils/api.utils';
import {ikoTabConfig, TAB_TYPE_LABELS} from './iko-tab-config';

interface TabResponse {
  key: string;
  title?: string;
  type: string;
  properties: Record<string, unknown>;
}

export class IkoTabPage {
  constructor(
    private readonly page: Page,
    private readonly request: APIRequestContext
  ) {}

  // ─── Tabs list page ─────────────────────────────────────────────────

  get list(): CarbonList {
    return new CarbonList(this.page);
  }

  get addTabButton(): Locator {
    return this.list.toolbar.getByTestId(IKO_TABS_TEST_IDS.addTabButton);
  }

  // ─── Tab modal ──────────────────────────────────────────────────────

  get addModalHeading(): Locator {
    return this.page.getByRole('heading', {name: 'Add tab'});
  }

  get editModalHeading(): Locator {
    return this.page.getByRole('heading', {name: 'Edit tab'});
  }

  get titleInput(): Locator {
    return this.page.getByTestId(IKO_TAB_DETAILS_MODAL_TEST_IDS.titleInput);
  }

  get keyInput(): Locator {
    return this.page.getByTestId(AUTO_KEY_INPUT_TEST_IDS.input);
  }

  /**
   * The tab type field is a `v-select` wrapping Carbon's `cds-combo-box`.
   * Scope to the `cds-combo-box` for clicks — the wrapper div has no
   * clickable surface.
   */
  get typeComboBox(): Locator {
    return this.page
      .getByTestId(IKO_TAB_DETAILS_MODAL_TEST_IDS.typeSelect)
      .locator('cds-combo-box');
  }

  /**
   * The "Aggregated Data Profile Name" property field. Rendered dynamically
   * by `PropertiesFormComponent`, so the test-id is built from the shared
   * `inputPrefix` and the backend property field key.
   */
  get aggregatedDataProfileNameInput(): Locator {
    return this.page.getByTestId(
      IKO_PROPERTIES_TEST_IDS.inputPrefix + 'aggregatedDataProfileName'
    );
  }

  get saveButton(): Locator {
    return this.page.getByTestId(IKO_TAB_DETAILS_MODAL_TEST_IDS.saveButton);
  }

  get cancelButton(): Locator {
    return this.page.getByTestId(IKO_TAB_DETAILS_MODAL_TEST_IDS.cancelButton);
  }

  /**
   * Best-effort dismissal of any open tab modal. Safe to call in
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

  /** Navigate directly to the Tabs tab of a given view. */
  async goToTabsTab(apiKey: string, viewKey: string): Promise<void> {
    await this.page.goto(`/iko-management/${apiKey}/${viewKey}/tabs`);
    await this.list.waitForLoaded();
  }

  // ─── Actions ────────────────────────────────────────────────────────

  async openAddModal(): Promise<void> {
    await this.addTabButton.click();
    await expect(this.addModalHeading).toBeVisible();
  }

  /**
   * The tabs list opens widget-details on plain row click. Edit goes
   * through the overflow action menu instead.
   */
  async openEditModal(title: string): Promise<void> {
    await this.list.row(title).clickAction('Edit');
    await expect(this.editModalHeading).toBeVisible();
  }

  /** Click the v-select combo-box and pick the option matching `label`. */
  async selectTabType(label: string): Promise<void> {
    await this.typeComboBox.click();
    await this.page.getByRole('listbox').getByText(label, {exact: true}).click();
  }

  async save(): Promise<void> {
    await expect(this.saveButton).toBeEnabled();
    await this.saveButton.click();
    // Both add and edit modals close on save.
    await expect(this.addModalHeading).toBeHidden();
    await expect(this.editModalHeading).toBeHidden();
  }

  /**
   * Full happy-path creation. Returns the auto-generated key. The aggregated
   * data profile name is optional but filled by default to exercise 15.61.
   */
  async createTab(
    title: string,
    options?: {tabTypeLabel?: string; aggregatedDataProfileName?: string | null}
  ): Promise<string> {
    const tabTypeLabel = options?.tabTypeLabel ?? TAB_TYPE_LABELS.widgets.label;
    const profileName =
      options?.aggregatedDataProfileName === null
        ? null
        : (options?.aggregatedDataProfileName ?? ikoTabConfig.aggregatedDataProfileName);

    await this.openAddModal();
    await this.titleInput.fill(title);
    await expect(this.keyInput).not.toHaveValue('');
    const key = await this.keyInput.inputValue();

    await this.selectTabType(tabTypeLabel);

    if (profileName) {
      await this.aggregatedDataProfileNameInput.fill(profileName);
    }

    await this.save();
    await this.assertTabVisible(title);
    return key;
  }

  async editTabTitle(oldTitle: string, newTitle: string): Promise<void> {
    await this.openEditModal(oldTitle);
    await this.titleInput.fill(newTitle);
    await this.save();
  }

  async openDeleteDialog(title: string): Promise<void> {
    await this.list.row(title).clickAction('Delete');
    await expect(this.confirmDeleteButton).toBeVisible();
  }

  async confirmDelete(): Promise<void> {
    await this.confirmDeleteButton.click();
    await expect(this.confirmDeleteButton).toBeHidden();
  }

  async deleteTab(title: string): Promise<void> {
    await this.openDeleteDialog(title);
    await this.confirmDelete();
    await this.assertTabNotVisible(title);
  }

  // ─── Assertions ─────────────────────────────────────────────────────

  async assertTabVisible(title: string): Promise<void> {
    await this.list.row(title).assertVisible();
  }

  async assertTabNotVisible(title: string): Promise<void> {
    await this.list.row(title).assertNotVisible();
  }

  async assertHeaderVisible(label: string): Promise<void> {
    await expect(this.list.table.locator('th', {hasText: label}).first()).toBeVisible();
  }

  // ─── API helpers (setup / cleanup) ──────────────────────────────────

  async getTabsViaApi(viewKey: string): Promise<TabResponse[]> {
    return apiGet<TabResponse[]>(`/api/management/v1/iko-view/${viewKey}/tab`);
  }

  /**
   * Create a tab directly via the management API. The key is slugified from
   * the title, mirroring the auto-key input's logic.
   */
  async createTabViaApi(
    viewKey: string,
    title: string,
    overrides?: {key?: string; type?: string; properties?: Record<string, unknown>}
  ): Promise<string> {
    const key =
      overrides?.key ??
      title
        .toLowerCase()
        .replace(/[^a-z0-9-_]+|-[^a-z0-9]+/g, '-')
        .replace(/^[^a-z]+/g, '');
    await apiPost(`/api/management/v1/iko-view/${viewKey}/tab/${key}`, {
      title,
      type: overrides?.type ?? 'widgets',
      properties: overrides?.properties ?? {},
    });
    return key;
  }

  async deleteTabViaApi(viewKey: string, tabKey: string): Promise<void> {
    try {
      await apiDelete(`/api/management/v1/iko-view/${viewKey}/tab/${tabKey}`);
    } catch {
      // Tab may already be deleted or never created.
    }
  }

  /** Delete every tab under `viewKey` whose title starts with `titlePrefix`. */
  async cleanupTestTabsViaApi(viewKey: string, titlePrefix: string): Promise<void> {
    try {
      const tabs = await this.getTabsViaApi(viewKey);
      for (const tab of tabs) {
        if (tab.title?.startsWith(titlePrefix)) {
          await this.deleteTabViaApi(viewKey, tab.key);
        }
      }
    } catch {
      // Listing failed — nothing reliable to clean up.
    }
  }
}
