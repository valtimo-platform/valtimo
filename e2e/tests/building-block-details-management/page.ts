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
  type Download,
  type Locator,
  type Page,
  type Response,
  expect,
} from '@playwright/test';
import path from 'path';
import {
  BUILDING_BLOCK_MANAGEMENT_ARTWORK_TEST_IDS,
  BUILDING_BLOCK_MANAGEMENT_DETAIL_ACTIONS_TEST_IDS,
  BUILDING_BLOCK_MANAGEMENT_DETAIL_TEST_IDS,
  BUILDING_BLOCK_MANAGEMENT_METADATA_TEST_IDS,
  BUILDING_BLOCK_MANAGEMENT_PLUGINS_TEST_IDS,
  BUILDING_BLOCK_VERSION_OPTION_TEST_ID_PREFIX,
  CONFIRMATION_MODAL_TEST_IDS,
  SCHEMA_EDITOR_TEST_IDS,
} from '../../constants';
import {CarbonList} from '../../shared/carbon-list/carbon-list.utils';
import {OverflowMenu} from '../../shared/overflow-menu/overflow-menu.utils';
import {apiDelete, apiGet, apiPost} from '../../utils/api.utils';

const ARCHIVES_DIR = 'building-block-archives';
const BUILDING_BLOCK_API_URL = '/api/management/v1/building-block';

export const BUILDING_BLOCK_TABS = {
  general: 'general',
  document: 'document',
  processes: 'process-definition',
} as const;

export type BuildingBlockTab = (typeof BUILDING_BLOCK_TABS)[keyof typeof BUILDING_BLOCK_TABS];

export interface BuildingBlockDefinition {
  key: string;
  name: string;
  versionTag: string;
  description: string;
  final: boolean;
}

export interface BuildingBlockVersion {
  versionTag: string;
  final: boolean;
}

export class BuildingBlockDetailsPage {
  readonly moreMenu: OverflowMenu;
  readonly processList: CarbonList;

  constructor(
    private readonly page: Page,
    private readonly request: APIRequestContext
  ) {
    this.moreMenu = new OverflowMenu(
      page,
      BUILDING_BLOCK_MANAGEMENT_DETAIL_ACTIONS_TEST_IDS.moreButton
    );
    this.processList = new CarbonList(
      page,
      page.locator('valtimo-building-block-management-processes')
    );
  }

  // ─── Tabs ─────────────────────────────────────────────────────────

  get tabs() {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_DETAIL_TEST_IDS.tabs);
  }

  // ─── Plugins section (General tab) ────────────────────────────────

  get usedPlugins() {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_PLUGINS_TEST_IDS.usedPlugins);
  }

  get noPluginsUsedMessage() {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_PLUGINS_TEST_IDS.noPluginsUsed);
  }

  // ─── Metadata section (General tab) ───────────────────────────────

  get metadataNameInput() {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_METADATA_TEST_IDS.nameInput);
  }

  /**
   * Read-only in the UI through the `valtimoReadOnly` directive, which only adds
   * a CSS class — the input stays editable in the DOM, so assert its value
   * rather than its editability.
   */
  get metadataKeyInput() {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_METADATA_TEST_IDS.keyInput);
  }

  get metadataDescriptionInput() {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_METADATA_TEST_IDS.descriptionInput);
  }

  get metadataSaveButton() {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_METADATA_TEST_IDS.saveButton);
  }

  // ─── Artwork section (General tab) ────────────────────────────────

  get artworkFileUploader() {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_ARTWORK_TEST_IDS.fileUploader);
  }

  get artworkImage() {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_ARTWORK_TEST_IDS.image);
  }

  get artworkUploadButton() {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_ARTWORK_TEST_IDS.uploadButton);
  }

  get artworkDeleteButton() {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_ARTWORK_TEST_IDS.deleteButton);
  }

  get confirmDeleteButton() {
    return this.page.getByTestId(CONFIRMATION_MODAL_TEST_IDS.confirmButton);
  }

  /** The Carbon modal that is currently open, used for content assertions. */
  get openModal() {
    return this.page.locator('.cds--modal.is-visible');
  }

  // ─── Document tab ─────────────────────────────────────────────────

  get schemaEditor() {
    return this.page.getByTestId(SCHEMA_EDITOR_TEST_IDS.editor);
  }

  // ─── Detail actions ───────────────────────────────────────────────

  get versionDropdown() {
    return this.page.getByTestId(
      BUILDING_BLOCK_MANAGEMENT_DETAIL_ACTIONS_TEST_IDS.versionSelectDropdown
    );
  }

  /**
   * Carbon renders the disabled state on the dropdown's inner field button, not
   * on the `cds-dropdown` host, so enabled/disabled has to be asserted here.
   */
  get versionDropdownButton() {
    return this.versionDropdown.getByRole('button').first();
  }

  /** The version badge rendered inside the closed dropdown. */
  get selectedVersionTag() {
    return this.versionDropdownButton.locator('cds-tag').first();
  }

  /**
   * The same version template renders both the dropdown's selected value and its
   * list items, so a version's test id exists twice while the dropdown is open —
   * scope to the listbox to get the selectable option.
   */
  versionOption(versionTag: string): Locator {
    return this.versionDropdown
      .getByRole('listbox')
      .getByTestId(`${BUILDING_BLOCK_VERSION_OPTION_TEST_ID_PREFIX}${versionTag}`);
  }

  get draftVersionInput() {
    return this.page.getByTestId(
      BUILDING_BLOCK_MANAGEMENT_DETAIL_ACTIONS_TEST_IDS.draftVersionInput
    );
  }

  get draftConfirmButton() {
    return this.page.getByTestId(
      BUILDING_BLOCK_MANAGEMENT_DETAIL_ACTIONS_TEST_IDS.draftConfirmButton
    );
  }

  get draftCancelButton() {
    return this.page.getByTestId(
      BUILDING_BLOCK_MANAGEMENT_DETAIL_ACTIONS_TEST_IDS.draftCancelButton
    );
  }

  // ─── Navigation ───────────────────────────────────────────────────

  detailUrl(key: string, versionTag: string, tab: BuildingBlockTab = BUILDING_BLOCK_TABS.general) {
    return `/building-block-management/building-block/${key}/version/${versionTag}/${tab}`;
  }

  async goToTab(key: string, versionTag: string, tab: BuildingBlockTab) {
    await this.page.goto(this.detailUrl(key, versionTag, tab));
    await this.page.waitForURL(new RegExp(`/version/${versionTag}/${tab}$`));
    await expect(this.versionDropdown).toBeVisible();
  }

  async goToGeneralTab(key: string, versionTag: string) {
    await this.goToTab(key, versionTag, BUILDING_BLOCK_TABS.general);
    // The metadata form is populated from the definition request.
    await expect(this.metadataKeyInput).toHaveValue(key);
  }

  // ─── Assertions ───────────────────────────────────────────────────

  async assertTabsVisible(expectedTabs: readonly string[]) {
    await expect(this.tabs).toBeVisible();
    const headings = await this.tabs.getByRole('tab').allInnerTexts();
    expect(headings.map(heading => heading.trim())).toEqual(
      expect.arrayContaining([...expectedTabs])
    );
  }

  async assertMetadata(definition: {name: string; key: string; description: string}) {
    await expect(this.metadataNameInput).toHaveValue(definition.name);
    await expect(this.metadataKeyInput).toHaveValue(definition.key);
    await expect(this.metadataDescriptionInput).toHaveValue(definition.description);
  }

  async assertUsedPlugins(pluginTitles: readonly string[]) {
    await expect(this.usedPlugins).toBeVisible();
    for (const pluginTitle of pluginTitles) {
      await expect(this.usedPlugins).toContainText(pluginTitle);
    }
  }

  async assertNoPluginsUsed(message: string) {
    await expect(this.noPluginsUsedMessage).toHaveText(message);
    await expect(this.usedPlugins).toHaveCount(0);
  }

  async assertSchemaEditorShows(schemaId: string) {
    await expect(this.schemaEditor).toBeVisible();
    await expect(this.schemaEditor).toContainText(schemaId);
  }

  /**
   * Draft versions render as `DRAFT: <tag>`; finalized versions render the tag on
   * its own — there is no literal "RELEASE" label in the UI.
   */
  async assertDraftVersionSelected(versionTag: string) {
    await expect(this.selectedVersionTag).toHaveText(`DRAFT: ${versionTag}`);
  }

  async assertFinalVersionSelected(versionTag: string) {
    await expect(this.selectedVersionTag).toHaveText(versionTag);
  }

  // ─── Metadata actions ─────────────────────────────────────────────

  async fillMetadata(values: {name?: string; description?: string}) {
    if (values.name !== undefined) {
      await this.metadataNameInput.fill(values.name);
    }
    if (values.description !== undefined) {
      await this.metadataDescriptionInput.fill(values.description);
    }
  }

  async saveMetadata(key: string, versionTag: string): Promise<Response> {
    await expect(this.metadataSaveButton).toBeEnabled();
    const [response] = await Promise.all([
      this.page.waitForResponse(
        res =>
          res.url().includes(`${BUILDING_BLOCK_API_URL}/${key}/version/${versionTag}`) &&
          res.request().method() === 'PUT'
      ),
      this.metadataSaveButton.click(),
    ]);
    return response;
  }

  // ─── Artwork actions ──────────────────────────────────────────────

  async selectArtwork(fileName: string) {
    const filePath = path.resolve(process.cwd(), 'assets', ARCHIVES_DIR, fileName);
    await this.artworkFileUploader
      .locator('input.cds--file-input[type="file"]')
      .setInputFiles(filePath);
  }

  async uploadArtwork(key: string, versionTag: string, fileName: string): Promise<Response> {
    await this.selectArtwork(fileName);
    await expect(this.artworkUploadButton).toBeEnabled();
    const [response] = await Promise.all([
      this.page.waitForResponse(
        res =>
          res.url().includes(`${BUILDING_BLOCK_API_URL}/${key}/version/${versionTag}/artwork`) &&
          res.request().method() === 'POST'
      ),
      this.artworkUploadButton.click(),
    ]);
    return response;
  }

  async openArtworkDeleteConfirmation() {
    await this.artworkDeleteButton.click();
    await expect(this.confirmDeleteButton).toBeVisible();
  }

  async confirmArtworkDeletion(key: string, versionTag: string): Promise<Response> {
    const [response] = await Promise.all([
      this.page.waitForResponse(
        res =>
          res.url().includes(`${BUILDING_BLOCK_API_URL}/${key}/version/${versionTag}/artwork`) &&
          res.request().method() === 'DELETE'
      ),
      this.confirmDeleteButton.click(),
    ]);
    return response;
  }

  // ─── Export ───────────────────────────────────────────────────────

  async exportBuildingBlock(): Promise<Download> {
    const [download] = await Promise.all([
      this.page.waitForEvent('download'),
      this.moreMenu.selectOption(BUILDING_BLOCK_MANAGEMENT_DETAIL_ACTIONS_TEST_IDS.exportButton),
    ]);
    return download;
  }

  // ─── Version lifecycle ────────────────────────────────────────────

  async finalizeVersion(key: string, versionTag: string): Promise<Response> {
    const [response] = await Promise.all([
      this.page.waitForResponse(
        res =>
          res.url().includes(`${BUILDING_BLOCK_API_URL}/${key}/version/${versionTag}/finalize`) &&
          res.request().method() === 'POST'
      ),
      this.moreMenu.selectOption(BUILDING_BLOCK_MANAGEMENT_DETAIL_ACTIONS_TEST_IDS.makeFinalButton),
    ]);
    return response;
  }

  async openDraftModal() {
    await this.moreMenu.selectOption(
      BUILDING_BLOCK_MANAGEMENT_DETAIL_ACTIONS_TEST_IDS.createDraftButton
    );
    await expect(this.draftVersionInput).toBeVisible();
  }

  async createDraft(
    key: string,
    basedOnVersionTag: string,
    newVersionTag: string
  ): Promise<Response> {
    await this.draftVersionInput.fill(newVersionTag);
    await expect(this.draftConfirmButton).toBeEnabled();
    const [response] = await Promise.all([
      this.page.waitForResponse(
        res =>
          res
            .url()
            .includes(`${BUILDING_BLOCK_API_URL}/${key}/version/${basedOnVersionTag}/draft`) &&
          res.request().method() === 'POST'
      ),
      this.draftConfirmButton.click(),
    ]);
    return response;
  }

  async switchToVersion(versionTag: string) {
    await this.openVersionDropdown();
    const option = this.versionOption(versionTag);
    await expect(option).toBeVisible();
    await option.click();
    await this.page.waitForURL(new RegExp(`/version/${versionTag}/`));
  }

  async openVersionDropdown() {
    await expect(this.versionDropdownButton).toBeEnabled();
    await this.versionDropdownButton.click();
  }

  /** Open the "More" menu, read the actions it offers, and close it again. */
  async readMoreMenuOptions(): Promise<string[]> {
    await this.moreMenu.open();
    const labels = await this.moreMenu.optionLabels();
    await this.moreMenu.close();
    return labels;
  }

  // ─── API helpers ──────────────────────────────────────────────────

  async createBuildingBlockViaApi(definition: {
    key: string;
    name: string;
    versionTag: string;
    description: string;
  }): Promise<BuildingBlockDefinition> {
    return apiPost<BuildingBlockDefinition>(BUILDING_BLOCK_API_URL, definition);
  }

  async getBuildingBlockViaApi(key: string, versionTag: string): Promise<BuildingBlockDefinition> {
    return apiGet<BuildingBlockDefinition>(
      `${BUILDING_BLOCK_API_URL}/${key}/version/${versionTag}`
    );
  }

  async getVersionsViaApi(key: string): Promise<BuildingBlockVersion[]> {
    const page = await apiGet<{content: BuildingBlockVersion[]}>(
      `${BUILDING_BLOCK_API_URL}/${key}/version?all=true`
    );
    return page.content;
  }

  async getBuildingBlockProcessesViaApi(
    key: string,
    versionTag: string
  ): Promise<{key: string; name: string; main: boolean}[]> {
    return apiGet<{key: string; name: string; main: boolean}[]>(
      `${BUILDING_BLOCK_API_URL}/${key}/version/${versionTag}/process-definition`
    );
  }

  async getArtworkViaApi(key: string, versionTag: string): Promise<{imageBase64: string} | null> {
    try {
      return await apiGet<{imageBase64: string}>(
        `${BUILDING_BLOCK_API_URL}/${key}/version/${versionTag}/artwork`
      );
    } catch {
      return null;
    }
  }

  async deleteArtworkViaApi(key: string, versionTag: string) {
    try {
      await apiDelete(`${BUILDING_BLOCK_API_URL}/${key}/version/${versionTag}/artwork`);
    } catch {
      // No artwork to remove.
    }
  }

  /**
   * Best-effort cleanup of the building block created for this suite.
   *
   * The management API exposes no DELETE for building block definitions
   * (`BuildingBlockManagementResource` only serves GET/POST/PUT), so this call
   * fails and is swallowed — the building block and its versions stay behind. The
   * helper is kept so cleanup starts working as soon as the endpoint is added.
   */
  async deleteBuildingBlockViaApi(key: string, versionTag: string) {
    try {
      await apiDelete(`${BUILDING_BLOCK_API_URL}/${key}/version/${versionTag}`);
    } catch {
      // No DELETE endpoint yet — nothing to do.
    }
  }
}
