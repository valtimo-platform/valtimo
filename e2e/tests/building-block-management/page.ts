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

import {
  type APIRequestContext,
  type Locator,
  type Page,
  type Response,
  expect,
} from '@playwright/test';
import path from 'path';
import {
  AUTO_KEY_INPUT_TEST_IDS,
  BUILDING_BLOCK_MANAGEMENT_CREATE_TEST_IDS,
  BUILDING_BLOCK_MANAGEMENT_LIST_TEST_IDS,
  BUILDING_BLOCK_MANAGEMENT_UPLOAD_TEST_IDS,
} from '../../constants';
import {CarbonList} from '../../shared/carbon-list/carbon-list.utils';
import {apiDelete, apiGet} from '../../utils/api.utils';
import {BUILDING_BLOCK_TEXTS} from './building-block-config';

const ARCHIVES_DIR = 'building-block-archives';
const BUILDING_BLOCK_API_URL = '/api/management/v1/building-block';

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface BuildingBlockDefinition {
  key: string;
  name: string;
  versionTag: string;
  description: string;
}

export interface CreateBuildingBlockValues {
  name: string;
  versionTag: string;
  description?: string;
}

export class BuildingBlockManagementPage {
  readonly carbonList: CarbonList;
  private readonly listScope: Locator;

  constructor(
    private readonly page: Page,
    private readonly request: APIRequestContext
  ) {
    this.listScope = page.locator('valtimo-building-block-management-list');
    this.carbonList = new CarbonList(page, this.listScope);
  }

  // ─── List locators ────────────────────────────────────────────────

  get uploadButton() {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_LIST_TEST_IDS.uploadButton);
  }

  get createButton() {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_LIST_TEST_IDS.createButton);
  }

  // ─── Create modal locators ────────────────────────────────────────

  get createModal() {
    return this.page.locator('valtimo-building-block-management-create-modal');
  }

  get nameInput() {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_CREATE_TEST_IDS.nameInput);
  }

  get versionInput() {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_CREATE_TEST_IDS.versionInput);
  }

  get descriptionInput() {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_CREATE_TEST_IDS.descriptionInput);
  }

  get keyInput() {
    return this.page.getByTestId(AUTO_KEY_INPUT_TEST_IDS.input);
  }

  get keyEditButton() {
    return this.page.getByTestId(AUTO_KEY_INPUT_TEST_IDS.editButton);
  }

  get createSaveButton() {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_CREATE_TEST_IDS.saveButton);
  }

  get createCancelButton() {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_CREATE_TEST_IDS.cancelButton);
  }

  /**
   * Validation message of the auto-key input. Carbon renders `invalidText`
   * inside its own `cds-label` markup, so there is no project-owned element to
   * hang a test id on — the message is asserted by text, scoped to the modal.
   */
  get duplicateKeyError() {
    return this.createModal.getByText(BUILDING_BLOCK_TEXTS.duplicateKeyError);
  }

  // ─── Upload modal locators ────────────────────────────────────────

  get fileUploader() {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_UPLOAD_TEST_IDS.fileUploader);
  }

  get overwriteWarning() {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_UPLOAD_TEST_IDS.overwriteWarning);
  }

  get overwriteCheckbox() {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_UPLOAD_TEST_IDS.overwriteCheckbox);
  }

  get uploadProgressBar() {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_UPLOAD_TEST_IDS.progressBar);
  }

  get uploadNextButton() {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_UPLOAD_TEST_IDS.nextButton);
  }

  get uploadBackButton() {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_UPLOAD_TEST_IDS.backButton);
  }

  get uploadCancelButton() {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_UPLOAD_TEST_IDS.cancelButton);
  }

  get uploadFinishButton() {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_UPLOAD_TEST_IDS.finishButton);
  }

  // ─── Navigation ───────────────────────────────────────────────────

  /**
   * Navigate straight to the route instead of going through the Admin menu:
   * loading the dashboard first crashes the Chromium renderer on heavy admin
   * routes.
   */
  async goToBuildingBlockManagement() {
    await this.page.goto('/building-block-management');
    await this.page.waitForURL(/\/building-block-management$/);
    await this.carbonList.waitForLoaded();
  }

  // ─── List assertions ──────────────────────────────────────────────

  async assertListLoaded() {
    await this.carbonList.waitForLoaded();
    await expect(this.carbonList.table).toBeVisible();
    await expect(this.uploadButton).toBeVisible();
    await expect(this.createButton).toBeVisible();
  }

  async assertColumnHeaders(expectedHeaders: readonly string[]) {
    const headers = await this.carbonList.table.locator('thead th').allInnerTexts();
    expect(headers.map(header => header.trim())).toEqual([...expectedHeaders]);
  }

  async assertBuildingBlockVisible(name: string) {
    await this.carbonList.row(name).assertVisible();
  }

  /**
   * Locate a row by its key column. Names are not unique — two building blocks
   * may share a name — and substring matching would make a name that is a prefix
   * of another match several rows, so identify rows by their exact key.
   */
  async assertBuildingBlockVisibleByKey(key: string) {
    await this.carbonList.row(new RegExp(`^${escapeForRegExp(key)}$`)).assertVisible();
  }

  /**
   * Assert the name, key and version tag rendered for a single building block.
   * The version is rendered as a Carbon tag rather than plain cell text.
   */
  async assertBuildingBlockMetadata(definition: {name: string; key: string; versionTag: string}) {
    const row = this.carbonList.row(new RegExp(`^${escapeForRegExp(definition.key)}$`));
    await row.assertVisible();
    await expect(row.cellByIndex(0)).toHaveText(definition.name);
    await expect(row.cellByIndex(1)).toHaveText(definition.key);
    await row.assertTagCount(1);
    await expect(row.tags).toHaveText(definition.versionTag);
  }

  // ─── Create modal ─────────────────────────────────────────────────

  /**
   * Always reload the list before opening the modal. A Carbon modal resets its
   * reactive form 240 ms after closing, so re-opening a modal within the same
   * page state can have that pending reset wipe the freshly filled form.
   */
  async openCreateModal() {
    await this.goToBuildingBlockManagement();
    await this.createButton.click();
    await expect(this.nameInput).toBeVisible();
    await expect(this.createSaveButton).toBeVisible();
  }

  async fillCreateForm(values: CreateBuildingBlockValues) {
    await this.nameInput.fill(values.name);
    // The key is derived from the name asynchronously — wait for it to land
    // before touching the rest of the form.
    await expect(this.keyInput).not.toHaveValue('');
    await this.versionInput.fill(values.versionTag);

    if (values.description !== undefined) {
      await this.descriptionInput.fill(values.description);
    }
  }

  /** Switch the auto-key input to manual mode and type a key. */
  async enterKeyManually(key: string) {
    await this.keyEditButton.click();
    await expect(this.keyEditButton).not.toBeVisible();
    await this.keyInput.fill(key);
  }

  async saveCreateForm(): Promise<Response> {
    await expect(this.createSaveButton).toBeEnabled();
    const [response] = await Promise.all([
      this.page.waitForResponse(
        res => res.url().endsWith(BUILDING_BLOCK_API_URL) && res.request().method() === 'POST'
      ),
      this.createSaveButton.click(),
    ]);
    return response;
  }

  async closeCreateModal() {
    await this.createCancelButton.click();
    await expect(this.page.locator('.cds--modal.is-visible')).not.toBeVisible();
  }

  async assertOnBuildingBlockDetail(key: string, versionTag: string) {
    await this.page.waitForURL(
      `**/building-block-management/building-block/${key}/version/${versionTag}/general`
    );
  }

  // ─── Upload modal ─────────────────────────────────────────────────

  /** Opens the wizard, which starts on the plugin configuration step. */
  async openUploadModal() {
    await this.goToBuildingBlockManagement();
    await this.uploadButton.click();
    await expect(this.page.getByText(BUILDING_BLOCK_TEXTS.pluginStepTitle).first()).toBeVisible();
  }

  async goToFileSelectStep() {
    await expect(this.uploadNextButton).toBeEnabled();
    await this.uploadNextButton.click();
    await expect(this.fileUploader).toBeVisible();
  }

  async selectArchive(fileName: string) {
    const filePath = path.resolve(process.cwd(), 'assets', ARCHIVES_DIR, fileName);
    await this.fileUploader.locator('input.cds--file-input[type="file"]').setInputFiles(filePath);
  }

  /**
   * Tick the overwrite acknowledgement. The inner label has to be clicked — a
   * click on the `cds-checkbox` host does not emit Carbon's `checkedChange`.
   */
  async acknowledgeOverwriteWarning() {
    await this.overwriteCheckbox.locator('label').click();
  }

  async startUpload(): Promise<Response> {
    await expect(this.uploadNextButton).toBeEnabled();
    const [response] = await Promise.all([
      this.page.waitForResponse(
        res =>
          res.url().includes(`${BUILDING_BLOCK_API_URL}/import`) &&
          res.request().method() === 'POST'
      ),
      this.uploadNextButton.click(),
    ]);
    return response;
  }

  async finishUpload() {
    await expect(this.uploadFinishButton).toBeVisible();
    await this.uploadFinishButton.click();
    await expect(this.page.locator('.cds--modal.is-visible')).not.toBeVisible();
  }

  /** Full happy-path import: plugin step → file select → acknowledge → upload. */
  async importArchive(fileName: string): Promise<Response> {
    await this.openUploadModal();
    await this.goToFileSelectStep();
    await this.selectArchive(fileName);
    await this.acknowledgeOverwriteWarning();
    return this.startUpload();
  }

  async assertUploadSucceeded() {
    await expect(this.uploadProgressBar).toContainText(BUILDING_BLOCK_TEXTS.uploadSuccess);
    await expect(this.uploadProgressBar).toHaveClass(/cds--progress-bar--finished/);
  }

  async assertUploadFailed() {
    await expect(this.uploadProgressBar).toContainText(BUILDING_BLOCK_TEXTS.uploadError);
    await expect(this.uploadProgressBar).toHaveClass(/cds--progress-bar--error/);
    // The failed step only offers "Finish" — no retry, cancel or back.
    await expect(this.uploadFinishButton).toBeVisible();
    await expect(this.uploadCancelButton).not.toBeVisible();
    await expect(this.uploadBackButton).not.toBeVisible();
  }

  // ─── API helpers ──────────────────────────────────────────────────

  async getBuildingBlocksViaApi(): Promise<BuildingBlockDefinition[]> {
    return apiGet<BuildingBlockDefinition[]>(BUILDING_BLOCK_API_URL);
  }

  async getBuildingBlockViaApi(key: string, versionTag: string): Promise<BuildingBlockDefinition> {
    return apiGet<BuildingBlockDefinition>(
      `${BUILDING_BLOCK_API_URL}/${key}/version/${versionTag}`
    );
  }

  /**
   * Best-effort cleanup of a building block created during a test.
   *
   * The management API currently exposes no DELETE for building block
   * definitions (`BuildingBlockManagementResource` only serves GET/POST/PUT), so
   * this call fails and is swallowed — building blocks created through the UI
   * stay behind. The helper is kept in place so cleanup starts working as soon
   * as the endpoint is added.
   */
  async deleteBuildingBlockViaApi(key: string, versionTag: string) {
    try {
      await apiDelete(`${BUILDING_BLOCK_API_URL}/${key}/version/${versionTag}`);
    } catch {
      // No DELETE endpoint yet — nothing to do.
    }
  }
}
