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
  IKO_SEARCH_FIELDS_TEST_IDS,
  IKO_SEARCH_FIELD_MODAL_TEST_IDS,
} from '../../../../constants';
import {apiDelete, apiGet, apiPost} from '../../../../utils/api.utils';
import {
  DATA_TYPE_LABELS,
  FIELD_TYPE_LABELS,
  ikoSearchFieldConfig,
  MATCH_TYPE_LABELS,
} from './iko-search-field-config';

interface IkoSearchFieldResponse {
  key: string;
  title?: string;
  path: string;
  dataType: string;
  fieldType: string;
  matchType?: string;
  required: boolean;
  order: number;
}

export class IkoSearchFieldPage {
  constructor(
    private readonly page: Page,
    private readonly request: APIRequestContext
  ) {}

  // ─── Search fields list page ────────────────────────────────────────

  get list(): CarbonList {
    return new CarbonList(this.page);
  }

  /**
   * The "Add search field" button is rendered twice (toolbar + no-results
   * action). Scope to the toolbar so the locator is unique regardless of
   * whether the list is empty.
   */
  get addFieldButton(): Locator {
    return this.list.toolbar.getByTestId(IKO_SEARCH_FIELDS_TEST_IDS.addFieldButton);
  }

  // ─── Search field modal ─────────────────────────────────────────────

  get addModalHeading(): Locator {
    return this.page.getByRole('heading', {name: 'Add search field'});
  }

  get editModalHeading(): Locator {
    return this.page.getByRole('heading', {name: 'Edit search field'});
  }

  get titleInput(): Locator {
    return this.page.getByTestId(IKO_SEARCH_FIELD_MODAL_TEST_IDS.titleInput);
  }

  get keyInput(): Locator {
    return this.page.getByTestId(AUTO_KEY_INPUT_TEST_IDS.input);
  }

  get pathInput(): Locator {
    return this.page.getByTestId(IKO_SEARCH_FIELD_MODAL_TEST_IDS.pathInput);
  }

  get dataTypeDropdown(): Locator {
    return this.page.getByTestId(IKO_SEARCH_FIELD_MODAL_TEST_IDS.dataTypeDropdown);
  }

  get matchTypeDropdown(): Locator {
    return this.page.getByTestId(IKO_SEARCH_FIELD_MODAL_TEST_IDS.matchTypeDropdown);
  }

  get fieldTypeDropdown(): Locator {
    return this.page.getByTestId(IKO_SEARCH_FIELD_MODAL_TEST_IDS.fieldTypeDropdown);
  }

  /** Carbon's <cds-toggle> exposes a <button role="switch"> internally. */
  get requiredToggleInput(): Locator {
    return this.page
      .getByTestId(IKO_SEARCH_FIELD_MODAL_TEST_IDS.requiredToggle)
      .getByRole('switch');
  }

  /** The visible pill of the toggle is the clickable surface. */
  get requiredToggleClickTarget(): Locator {
    return this.page
      .getByTestId(IKO_SEARCH_FIELD_MODAL_TEST_IDS.requiredToggle)
      .locator('.cds--toggle__appearance');
  }

  get saveButton(): Locator {
    return this.page.getByTestId(IKO_SEARCH_FIELD_MODAL_TEST_IDS.saveButton);
  }

  get cancelButton(): Locator {
    return this.page.getByTestId(IKO_SEARCH_FIELD_MODAL_TEST_IDS.cancelButton);
  }

  /**
   * Best-effort dismissal of any open search field modal. Safe to call in
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

  /** Navigate directly to the search fields page of a given action. */
  async goToSearchFieldsPage(
    apiKey: string,
    viewKey: string,
    actionKey: string
  ): Promise<void> {
    // The tab segment is `search` (SEARCH_FIELDS enum value).
    await this.page.goto(
      `/iko-management/${apiKey}/${viewKey}/search/search-action/${actionKey}`
    );
    await this.list.waitForLoaded();
  }

  // ─── Actions ────────────────────────────────────────────────────────

  async openAddModal(): Promise<void> {
    await this.addFieldButton.click();
    await expect(this.addModalHeading).toBeVisible();
  }

  /**
   * The search-fields list opens the edit modal on plain row click — there
   * is no overflow action menu. Toggling the menu directly would fail, so
   * always navigate through the row body.
   */
  async openEditModal(title: string): Promise<void> {
    await this.list.row(title).click();
    await expect(this.editModalHeading).toBeVisible();
  }

  /** Click a cds-dropdown trigger and pick the option matching `label`. */
  private async selectDropdownItem(dropdown: Locator, label: string): Promise<void> {
    await dropdown.click();
    await this.page.getByRole('listbox').getByText(label, {exact: true}).click();
  }

  async selectDataType(label: string): Promise<void> {
    await this.selectDropdownItem(this.dataTypeDropdown, label);
  }

  async selectMatchType(label: string): Promise<void> {
    await this.selectDropdownItem(this.matchTypeDropdown, label);
  }

  async selectFieldType(label: string): Promise<void> {
    await this.selectDropdownItem(this.fieldTypeDropdown, label);
  }

  async toggleRequired(): Promise<void> {
    await this.requiredToggleClickTarget.click();
  }

  async save(): Promise<void> {
    await expect(this.saveButton).toBeEnabled();
    await this.saveButton.click();
    // Both add and edit modals close on save.
    await expect(this.addModalHeading).toBeHidden();
    await expect(this.editModalHeading).toBeHidden();
  }

  /**
   * Full happy-path creation: fills every required field and saves. Defaults
   * to dataType=Text, matchType=Exact, fieldType=Single — the canonical
   * configuration tested by 15.33-15.40.
   */
  async createSearchField(
    title: string,
    options?: {
      path?: string;
      dataTypeLabel?: string;
      matchTypeLabel?: string;
      fieldTypeLabel?: string;
      required?: boolean;
    }
  ): Promise<string> {
    const path = options?.path ?? ikoSearchFieldConfig.path;
    const dataTypeLabel = options?.dataTypeLabel ?? DATA_TYPE_LABELS.text.label;
    const fieldTypeLabel = options?.fieldTypeLabel ?? FIELD_TYPE_LABELS.single.label;
    const matchTypeLabel = options?.matchTypeLabel ?? MATCH_TYPE_LABELS.exact.label;

    await this.openAddModal();
    await this.titleInput.fill(title);
    await expect(this.keyInput).not.toHaveValue('');
    const key = await this.keyInput.inputValue();

    await this.pathInput.fill(path);
    await this.selectDataType(dataTypeLabel);
    // Match type only appears when data type is Text — the modal hides it
    // for non-text data types. Try it conditionally.
    if (dataTypeLabel === DATA_TYPE_LABELS.text.label) {
      await this.selectMatchType(matchTypeLabel);
    }
    await this.selectFieldType(fieldTypeLabel);

    if (options?.required) {
      await this.toggleRequired();
    }

    await this.save();
    await this.assertFieldVisible(title);
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

  async deleteSearchField(title: string): Promise<void> {
    await this.openDeleteDialog(title);
    await this.confirmDelete();
    await this.assertFieldNotVisible(title);
  }

  // ─── Assertions ─────────────────────────────────────────────────────

  async assertFieldVisible(title: string): Promise<void> {
    await this.list.row(title).assertVisible();
  }

  async assertFieldNotVisible(title: string): Promise<void> {
    await this.list.row(title).assertNotVisible();
  }

  async assertHeaderVisible(label: string): Promise<void> {
    await expect(this.list.table.locator('th', {hasText: label}).first()).toBeVisible();
  }

  // ─── API helpers (setup / cleanup) ──────────────────────────────────

  async getSearchFieldsViaApi(
    viewKey: string,
    actionKey: string
  ): Promise<IkoSearchFieldResponse[]> {
    return apiGet<IkoSearchFieldResponse[]>(
      `/api/management/v1/iko-view/${viewKey}/search-action/${actionKey}/search-field`
    );
  }

  /**
   * Create a search field directly via the management API. The key is
   * slugified from the title, mirroring the auto-key input's logic.
   */
  async createSearchFieldViaApi(
    viewKey: string,
    actionKey: string,
    title: string,
    overrides?: {
      key?: string;
      path?: string;
      dataType?: string;
      matchType?: string;
      fieldType?: string;
      required?: boolean;
    }
  ): Promise<string> {
    const key =
      overrides?.key ??
      title
        .toLowerCase()
        .replace(/[^a-z0-9-_]+|-[^a-z0-9]+/g, '-')
        .replace(/^[^a-z]+/g, '');
    await apiPost(
      `/api/management/v1/iko-view/${viewKey}/search-action/${actionKey}/search-field/${key}`,
      {
        key,
        title,
        path: overrides?.path ?? ikoSearchFieldConfig.path,
        dataType: overrides?.dataType ?? 'text',
        matchType: overrides?.matchType ?? 'exact',
        fieldType: overrides?.fieldType ?? 'single',
        required: overrides?.required ?? false,
      }
    );
    return key;
  }

  async deleteSearchFieldViaApi(
    viewKey: string,
    actionKey: string,
    fieldKey: string
  ): Promise<void> {
    try {
      await apiDelete(
        `/api/management/v1/iko-view/${viewKey}/search-action/${actionKey}/search-field/${fieldKey}`
      );
    } catch {
      // Field may already be deleted or never created.
    }
  }

  /** Delete every search field whose title starts with `titlePrefix`. */
  async cleanupTestFieldsViaApi(
    viewKey: string,
    actionKey: string,
    titlePrefix: string
  ): Promise<void> {
    try {
      const fields = await this.getSearchFieldsViaApi(viewKey, actionKey);
      for (const field of fields) {
        if (field.title?.startsWith(titlePrefix)) {
          await this.deleteSearchFieldViaApi(viewKey, actionKey, field.key);
        }
      }
    } catch {
      // Listing failed — nothing reliable to clean up.
    }
  }
}

/** Re-exported for the spec's label references. */
export {DATA_TYPE_LABELS, MATCH_TYPE_LABELS, FIELD_TYPE_LABELS};
