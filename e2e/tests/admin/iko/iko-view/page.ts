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
  IKO_VIEW_MANAGEMENT_TEST_IDS,
  IKO_VIEW_MODAL_TEST_IDS,
} from '../../../../constants';
import {apiDelete, apiGet, apiPost} from '../../../../utils/api.utils';
import {ikoViewConfig} from './iko-view-config';

interface IkoViewListResponse {
  content: Array<{key: string; title: string}>;
}

export class IkoViewPage {
  constructor(
    private readonly page: Page,
    private readonly request: APIRequestContext
  ) {}

  // ─── Views list page ────────────────────────────────────────────────

  get list(): CarbonList {
    return new CarbonList(this.page);
  }

  /**
   * The "Add view" button is rendered twice (once in the toolbar, once as
   * the no-results action). Scope to the toolbar so the locator is unique
   * regardless of whether the list is empty.
   */
  get addViewButton(): Locator {
    return this.list.toolbar.getByTestId(IKO_VIEW_MANAGEMENT_TEST_IDS.addViewButton);
  }

  // ─── View modal ─────────────────────────────────────────────────────

  get addModalHeading(): Locator {
    return this.page.getByRole('heading', {name: 'Add view'});
  }

  get editModalHeading(): Locator {
    return this.page.getByRole('heading', {name: 'Edit view'});
  }

  get titleInput(): Locator {
    return this.page.getByTestId(IKO_VIEW_MODAL_TEST_IDS.titleInput);
  }

  get keyInput(): Locator {
    return this.page.getByTestId(AUTO_KEY_INPUT_TEST_IDS.input);
  }

  get saveButton(): Locator {
    return this.page.getByTestId(IKO_VIEW_MODAL_TEST_IDS.saveButton);
  }

  get cancelButton(): Locator {
    return this.page.getByTestId(IKO_VIEW_MODAL_TEST_IDS.cancelButton);
  }

  // ─── Property field helpers ─────────────────────────────────────────

  /** Text input for a property field, addressed by the field's backend key. */
  propertyInput(key: string): Locator {
    return this.page.getByTestId(IKO_PROPERTIES_TEST_IDS.inputPrefix + key);
  }

  /** Information icon that triggers a property field's tooltip popover. */
  propertyTooltipTrigger(key: string): Locator {
    return this.page.getByTestId(IKO_PROPERTIES_TEST_IDS.tooltipPrefix + key);
  }

  /** First row key input of a key-value-list property. */
  propertyKvKey(key: string): Locator {
    return this.page.getByTestId(IKO_PROPERTIES_TEST_IDS.kvKeyPrefix + key).first();
  }

  /** First row value input of a key-value-list property. */
  propertyKvValue(key: string): Locator {
    return this.page.getByTestId(IKO_PROPERTIES_TEST_IDS.kvValuePrefix + key).first();
  }

  propertyKvAddRowButton(key: string): Locator {
    return this.page.getByTestId(IKO_PROPERTIES_TEST_IDS.kvAddRowPrefix + key);
  }

  /** All key inputs of a key-value-list property (one per row). */
  propertyKvKeyAll(key: string): Locator {
    return this.page.getByTestId(IKO_PROPERTIES_TEST_IDS.kvKeyPrefix + key);
  }

  /** All value inputs of a key-value-list property (one per row). */
  propertyKvValueAll(key: string): Locator {
    return this.page.getByTestId(IKO_PROPERTIES_TEST_IDS.kvValuePrefix + key);
  }

  /** All remove-row buttons of a key-value-list property (one per row). */
  propertyKvRemoveAll(key: string): Locator {
    return this.page.getByTestId(IKO_PROPERTIES_TEST_IDS.kvRemoveRowPrefix + key);
  }

  /** Navigate directly to the views page of a given server. */
  async goToServerViews(apiKey: string): Promise<void> {
    await this.page.goto(`/iko-management/${apiKey}`);
    await this.list.waitForLoaded();
  }

  // ─── Delete confirmation modal ──────────────────────────────────────

  get confirmDeleteButton(): Locator {
    return this.page.getByTestId(CONFIRMATION_MODAL_TEST_IDS.confirmButton);
  }

  // ─── Actions ────────────────────────────────────────────────────────

  async openAddModal(): Promise<void> {
    await this.addViewButton.click();
    await expect(this.addModalHeading).toBeVisible();
  }

  async openEditModal(title: string): Promise<void> {
    await this.list.row(title).clickAction('Edit');
    await expect(this.editModalHeading).toBeVisible();
  }

  /** Fill all view properties needed to produce a valid form. */
  async fillViewProperties(): Promise<void> {
    await this.propertyInput('connectorTag').fill(ikoViewConfig.connectorTag);
    await this.propertyInput('connectorInstanceTag').fill(ikoViewConfig.connectorInstanceTag);
    await this.propertyInput('endpointOperation').fill(ikoViewConfig.endpointOperation);
    // The first key-value row is always required by the form, even though
    // the property field itself is marked as not required by the backend.
    await this.propertyKvKey('endpointQueryParameters').fill(ikoViewConfig.queryParamKey);
    await this.propertyKvValue('endpointQueryParameters').fill(ikoViewConfig.queryParamValue);
  }

  async save(): Promise<void> {
    await expect(this.saveButton).toBeEnabled();
    await this.saveButton.click();
    // Both add and edit modals close on save.
    await expect(this.addModalHeading).toBeHidden();
    await expect(this.editModalHeading).toBeHidden();
  }

  /**
   * Fill the add-view modal (title → auto-key → all properties) and wait until
   * the form is valid (Save enabled). A freshly opened modal initialises its
   * reactive form asynchronously: a late `writeValue('')` can wipe an early
   * `fill`, and the AutoKeyInput only auto-generates the key once its `mode`
   * has propagated. Re-filling every field via `toPass` defeats both races.
   */
  async fillViewForm(title: string): Promise<void> {
    await expect(async () => {
      await this.titleInput.fill(title);
      // 15.16 — the key auto-generates from the title.
      await expect(this.keyInput).not.toHaveValue('', {timeout: 2_000});
      await this.fillViewProperties();
      await expect(this.saveButton).toBeEnabled({timeout: 2_000});
    }).toPass({timeout: 20_000});
  }

  /** Full happy-path creation. Returns the auto-generated key. */
  async createView(title: string): Promise<string> {
    await this.openAddModal();
    await this.fillViewForm(title);
    const key = await this.keyInput.inputValue();
    await this.save();
    await this.assertViewVisible(title);
    return key;
  }

  async editViewTitle(oldTitle: string, newTitle: string): Promise<void> {
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

  async deleteView(title: string): Promise<void> {
    await this.openDeleteDialog(title);
    await this.confirmDelete();
    await this.assertViewNotVisible(title);
  }

  // ─── Tooltip helpers ────────────────────────────────────────────────

  /** Hover the field's information icon and assert the tooltip text shows. */
  async assertTooltip(key: string, text: string): Promise<void> {
    await this.propertyTooltipTrigger(key).hover();
    await expect(this.page.getByText(text)).toBeVisible();
  }

  // ─── Assertions ─────────────────────────────────────────────────────

  async assertViewVisible(title: string): Promise<void> {
    await this.list.row(title).assertVisible();
  }

  async assertViewNotVisible(title: string): Promise<void> {
    await this.list.row(title).assertNotVisible();
  }

  // ─── API helpers (setup / cleanup) ──────────────────────────────────

  /**
   * Create a view directly via the management API. Use this for parent setup
   * in suites that test things nested under a view (columns, tabs, …). The
   * key is slugified from the title, mirroring the modal's auto-key logic.
   * Returns the slugified key.
   */
  async createViewViaApi(repositoryConfigKey: string, title: string): Promise<string> {
    const key = title
      .toLowerCase()
      .replace(/[^a-z0-9-_]+|-[^a-z0-9]+/g, '-')
      .replace(/^[^a-z]+/g, '');
    await apiPost(`/api/management/v1/iko-view/${key}`, {
      ikoRepositoryConfigKey: repositoryConfigKey,
      title,
      properties: {
        connectorTag: 'example-connector',
        connectorInstanceTag: 'example-instance',
        endpointOperation: 'example-endpoint',
        endpointQueryParameters: {type: 'ZoekMetGeslachtsnaamEnGeboortedatum'},
      },
    });
    return key;
  }

  async getViewsViaApi(repositoryConfigKey: string): Promise<Array<{key: string; title: string}>> {
    const res = await apiGet<IkoViewListResponse>(
      `/api/management/v1/iko-view?ikoRepositoryConfigKey=${encodeURIComponent(repositoryConfigKey)}`
    );
    return res.content ?? [];
  }

  async deleteViewViaApi(viewKey: string): Promise<void> {
    try {
      await apiDelete(`/api/management/v1/iko-view/${viewKey}`);
    } catch {
      // View may already be deleted or never created.
    }
  }

  /** Delete every view under `repositoryConfigKey` whose title starts with the prefix. */
  async cleanupTestViewsViaApi(repositoryConfigKey: string, titlePrefix: string): Promise<void> {
    try {
      const views = await this.getViewsViaApi(repositoryConfigKey);
      for (const view of views) {
        if (view.title?.startsWith(titlePrefix)) {
          await this.deleteViewViaApi(view.key);
        }
      }
    } catch {
      // Listing failed — nothing reliable to clean up.
    }
  }
}
