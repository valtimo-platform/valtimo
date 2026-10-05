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

import {type APIRequestContext, type Locator, type Page, expect} from '@playwright/test';
import {
  OBJECT_MANAGEMENT_DETAIL_TEST_IDS,
  OBJECT_MANAGEMENT_LIST_TEST_IDS,
  OBJECT_MANAGEMENT_MODAL_TEST_IDS,
} from '../../constants';
import {CarbonList, CarbonListRow} from '../../shared/carbon-list/carbon-list.utils';
import {VSelect} from '../../shared/v-select/v-select.utils';
import {apiDelete, apiGet} from '../../utils/api.utils';
import {OBJECT_MANAGEMENT_API} from './object-management-config';

/** One object type configuration, as the management API returns it. */
export interface ObjectTypeConfiguration {
  id: string;
  title: string;
  objecttypenApiPluginConfigurationId: string;
  objecttypeId: string;
  objecttypeVersion: number;
  objectenApiPluginConfigurationId: string;
  showInDataMenu: boolean;
  formDefinitionView: string | null;
  formDefinitionEdit: string | null;
  suppressOutbox: boolean;
}

export class ObjectManagementPage {
  readonly carbonList: CarbonList;

  constructor(
    private readonly page: Page,
    private readonly request: APIRequestContext
  ) {
    this.carbonList = new CarbonList(page);
  }

  // ─── List ─────────────────────────────────────────────────────────

  get uploadButton(): Locator {
    return this.page.getByTestId(OBJECT_MANAGEMENT_LIST_TEST_IDS.uploadButton);
  }

  get createButton(): Locator {
    return this.page.getByTestId(OBJECT_MANAGEMENT_LIST_TEST_IDS.createButton);
  }

  rowByTitle(title: string): CarbonListRow {
    return this.carbonList.row(title);
  }

  // ─── Modal ────────────────────────────────────────────────────────

  get modalHeading(): Locator {
    return this.page.getByTestId(OBJECT_MANAGEMENT_MODAL_TEST_IDS.heading);
  }

  get modalCancelButton(): Locator {
    return this.page.getByTestId(OBJECT_MANAGEMENT_MODAL_TEST_IDS.cancelButton);
  }

  get modalSaveButton(): Locator {
    return this.page.getByTestId(OBJECT_MANAGEMENT_MODAL_TEST_IDS.saveButton);
  }

  /** The test id is on the `v-input` host, so the field itself is one level down. */
  private modalInput(testId: string): Locator {
    return this.page.getByTestId(testId).locator('input');
  }

  get titleInput(): Locator {
    return this.modalInput(OBJECT_MANAGEMENT_MODAL_TEST_IDS.titleInput);
  }

  get objecttypeIdInput(): Locator {
    return this.modalInput(OBJECT_MANAGEMENT_MODAL_TEST_IDS.objecttypeIdInput);
  }

  get objecttypeVersionInput(): Locator {
    return this.modalInput(OBJECT_MANAGEMENT_MODAL_TEST_IDS.objecttypeVersionInput);
  }

  private select(testId: string): VSelect {
    return new VSelect(this.page, this.page.getByTestId(testId));
  }

  get objectenApiSelect(): VSelect {
    return this.select(OBJECT_MANAGEMENT_MODAL_TEST_IDS.objectenApiSelect);
  }

  get objecttypenApiSelect(): VSelect {
    return this.select(OBJECT_MANAGEMENT_MODAL_TEST_IDS.objecttypenApiSelect);
  }

  /**
   * The "Show in menu" checkbox.
   *
   * Carbon hides the real `<input>` and paints the visible box onto the label,
   * so the input can be read but never clicked — `check()` on it times out.
   */
  private get showInDataMenu(): Locator {
    return this.page.getByTestId(OBJECT_MANAGEMENT_MODAL_TEST_IDS.showInDataMenuCheckbox);
  }

  get showInDataMenuInput(): Locator {
    return this.showInDataMenu.locator('input[type="checkbox"]');
  }

  /** Toggle "Show in menu" by clicking its label, then wait for the new state. */
  async setShowInDataMenu(checked: boolean) {
    if ((await this.showInDataMenuInput.isChecked()) === checked) return;
    // Two labels sit under the host: the field title and the checkbox's own.
    await this.showInDataMenu.locator('cds-checkbox label').click();
    await expect(this.showInDataMenuInput).toBeChecked({checked});
  }

  // ─── Detail ───────────────────────────────────────────────────────

  get visibleInMenuTag(): Locator {
    return this.page.getByTestId(OBJECT_MANAGEMENT_DETAIL_TEST_IDS.visibleInMenuTag);
  }

  get generalTab(): Locator {
    return this.page.getByTestId(OBJECT_MANAGEMENT_DETAIL_TEST_IDS.generalTab);
  }

  get searchFieldsTab(): Locator {
    return this.page.getByTestId(OBJECT_MANAGEMENT_DETAIL_TEST_IDS.searchFieldsTab);
  }

  get listTab(): Locator {
    return this.page.getByTestId(OBJECT_MANAGEMENT_DETAIL_TEST_IDS.listTab);
  }

  get downloadButton(): Locator {
    return this.page.getByTestId(OBJECT_MANAGEMENT_DETAIL_TEST_IDS.downloadButton);
  }

  get editButton(): Locator {
    return this.page.getByTestId(OBJECT_MANAGEMENT_DETAIL_TEST_IDS.editButton);
  }

  // ─── Navigation ───────────────────────────────────────────────────

  /**
   * Navigate straight to the route rather than driving the Admin menu: loading
   * the dashboard first and then opening a heavy admin route crashes the
   * Chromium renderer.
   */
  async goToObjectManagement() {
    await this.page.goto('/object-management');
    await this.page.waitForURL(/\/object-management$/);
    await this.carbonList.waitForLoaded();
    await expect(this.carbonList.table).toBeVisible();
  }

  async goToObjectTypeDetail(id: string) {
    await this.page.goto(`/object-management/object/${id}`);
    await this.page.waitForURL(new RegExp(`/object-management/object/${id}$`));
    await expect(this.generalTab).toBeVisible();
  }

  // ─── Actions ──────────────────────────────────────────────────────

  async openCreateModal() {
    await expect(this.createButton).toBeEnabled();
    await this.createButton.click();
    await expect(this.modalSaveButton).toBeVisible();
  }

  async openEditModal() {
    await expect(this.editButton).toBeEnabled();
    await this.editButton.click();
    await expect(this.modalSaveButton).toBeVisible();
  }

  async closeModal() {
    await this.modalCancelButton.click();
    await expect(this.modalSaveButton).not.toBeVisible();
  }

  /**
   * Fill every required field of the add/edit modal. The two plugin dropdowns
   * are picked by index: the environment seeds exactly one configuration of each
   * API, and which one it is does not matter to these tests.
   */
  async fillObjectTypeForm(values: {
    title: string;
    objecttypeId: string;
    objecttypeVersion: string;
  }) {
    await this.titleInput.fill(values.title);
    await this.objectenApiSelect.selectByIndex(0);
    await this.objecttypenApiSelect.selectByIndex(0);
    await this.objecttypeIdInput.fill(values.objecttypeId);
    await this.objecttypeVersionInput.fill(values.objecttypeVersion);
  }

  /** Submit the modal and wait for the write it triggers. */
  async submitModal(method: 'POST' | 'PUT') {
    await expect(this.modalSaveButton).toBeEnabled();
    const [response] = await Promise.all([
      this.page.waitForResponse(
        res =>
          new URL(res.url()).pathname === OBJECT_MANAGEMENT_API.configurations &&
          res.request().method() === method
      ),
      this.modalSaveButton.click(),
    ]);
    return response;
  }

  // ─── API helpers ──────────────────────────────────────────────────

  async getConfigurationsViaApi(): Promise<ObjectTypeConfiguration[]> {
    return apiGet<ObjectTypeConfiguration[]>(OBJECT_MANAGEMENT_API.configurations);
  }

  async getConfigurationByTitleViaApi(title: string): Promise<ObjectTypeConfiguration | undefined> {
    const configurations = await this.getConfigurationsViaApi();
    return configurations.find(configuration => configuration.title === title);
  }

  async deleteConfigurationViaApi(id: string) {
    try {
      await apiDelete(OBJECT_MANAGEMENT_API.configuration(id));
    } catch {
      // Already gone.
    }
  }
}
