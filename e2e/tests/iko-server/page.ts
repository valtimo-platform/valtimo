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
import {CarbonList} from '../../shared/carbon-list/carbon-list.utils';
import {
  AUTO_KEY_INPUT_TEST_IDS,
  CONFIRMATION_MODAL_TEST_IDS,
  IKO_MANAGEMENT_TEST_IDS,
  IKO_PROPERTIES_TEST_IDS,
  IKO_REPOSITORY_MODAL_TEST_IDS,
  IKO_UPLOAD_MODAL_TEST_IDS,
} from '../../constants';
import {apiDelete, apiGet} from '../../utils/api.utils';
import {ikoServerConfig} from './iko-server-config';

interface IkoRepositoryConfigListResponse {
  content: Array<{key: string; title: string}>;
}

export class IkoServerPage {
  constructor(
    private readonly page: Page,
    private readonly request: APIRequestContext
  ) {}

  // ─── List page ────────────────────────────────────────────────────

  get list(): CarbonList {
    return new CarbonList(this.page);
  }

  get configureServerButton(): Locator {
    return this.page.getByTestId(IKO_MANAGEMENT_TEST_IDS.configureServerButton);
  }

  // ─── Repository (server) modal ──────────────────────────────────────

  get modalHeading(): Locator {
    return this.page.getByRole('heading', {name: 'Configure IKO Server'});
  }

  get titleInput(): Locator {
    return this.page.getByTestId(IKO_REPOSITORY_MODAL_TEST_IDS.titleInput);
  }

  get keyInput(): Locator {
    return this.page.getByTestId(AUTO_KEY_INPUT_TEST_IDS.input);
  }

  get serverUrlInput(): Locator {
    return this.page.getByTestId(
      IKO_PROPERTIES_TEST_IDS.inputPrefix + ikoServerConfig.serverUrlPropertyKey
    );
  }

  get saveButton(): Locator {
    return this.page.getByTestId(IKO_REPOSITORY_MODAL_TEST_IDS.saveButton);
  }

  get cancelButton(): Locator {
    return this.page.getByTestId(IKO_REPOSITORY_MODAL_TEST_IDS.cancelButton);
  }

  // ─── Delete confirmation modal ──────────────────────────────────────

  get confirmDeleteButton(): Locator {
    return this.page.getByTestId(CONFIRMATION_MODAL_TEST_IDS.confirmButton);
  }

  // ─── Import modal (on the server's views page) ──────────────────────

  get uploadButton(): Locator {
    return this.page.getByTestId(IKO_MANAGEMENT_TEST_IDS.uploadButton);
  }

  get importModalHeading(): Locator {
    return this.page.getByRole('heading', {name: 'Import IKO definition'});
  }

  get importFileInput(): Locator {
    return this.page
      .getByTestId(IKO_UPLOAD_MODAL_TEST_IDS.fileUploader)
      .locator('input[type="file"]');
  }

  get importOverwriteCheckbox(): Locator {
    return this.page.getByTestId(IKO_UPLOAD_MODAL_TEST_IDS.overwriteCheckbox);
  }

  get importStartButton(): Locator {
    return this.page.getByTestId(IKO_UPLOAD_MODAL_TEST_IDS.startUploadButton);
  }

  get importCancelButton(): Locator {
    return this.page.getByTestId(IKO_UPLOAD_MODAL_TEST_IDS.cancelButton);
  }

  // ─── Navigation ─────────────────────────────────────────────────────

  async goToIkoManagement(): Promise<void> {
    // The "Admin" menu is a toggle; only expand it when the IKO link is hidden,
    // otherwise a second click would collapse the menu and hide the link.
    // `exact` (case-sensitive) targets the menu link "IKO" and not the
    // breadcrumb link "Iko" shown on a server's views page.
    const ikoLink = this.page.getByRole('link', {name: 'IKO', exact: true});
    if (!(await ikoLink.isVisible())) {
      await this.page.getByRole('button', {name: 'Admin'}).click();
    }
    await ikoLink.click();
    await this.list.waitForLoaded();
  }

  /** Click a server row, navigating to its (empty) views page. */
  async enterServer(title: string): Promise<void> {
    await this.list.row(title).click();
    await expect(this.uploadButton).toBeVisible();
  }

  // ─── Server CRUD ────────────────────────────────────────────────────

  async openConfigureModal(): Promise<void> {
    await this.configureServerButton.click();
    await expect(this.modalHeading).toBeVisible();
  }

  async fillServer(title: string, url?: string): Promise<void> {
    await this.titleInput.fill(title);
    if (url !== undefined) {
      await this.serverUrlInput.fill(url);
    }
  }

  async save(): Promise<void> {
    await expect(this.saveButton).toBeEnabled();
    await this.saveButton.click();
    await expect(this.modalHeading).toBeHidden();
  }

  /** Full happy-path creation. Returns the auto-generated key. */
  async createServer(title: string, url: string): Promise<string> {
    await this.openConfigureModal();
    await this.titleInput.fill(title);
    // The key auto-generates from the title (15.4).
    await expect(this.keyInput).not.toHaveValue('');
    const key = await this.keyInput.inputValue();
    await this.serverUrlInput.fill(url);
    await this.save();
    await this.assertServerVisible(title);
    return key;
  }

  async openEdit(title: string): Promise<void> {
    await this.list.row(title).clickAction('Edit');
    await expect(this.modalHeading).toBeVisible();
  }

  async editServerTitle(oldTitle: string, newTitle: string): Promise<void> {
    await this.openEdit(oldTitle);
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

  async deleteServer(title: string): Promise<void> {
    await this.openDeleteDialog(title);
    await this.confirmDelete();
    await this.assertServerNotVisible(title);
  }

  // ─── Import flow ────────────────────────────────────────────────────

  async openImportModal(): Promise<void> {
    await this.uploadButton.click();
    await expect(this.importModalHeading).toBeVisible();
  }

  async selectImportFile(path: string): Promise<void> {
    await this.importFileInput.setInputFiles(path);
  }

  async cancelImport(): Promise<void> {
    await this.importCancelButton.click();
    await expect(this.importModalHeading).toBeHidden();
  }

  // ─── Assertions ─────────────────────────────────────────────────────

  async assertServerVisible(title: string): Promise<void> {
    await this.list.row(title).assertVisible();
  }

  async assertServerNotVisible(title: string): Promise<void> {
    await this.list.row(title).assertNotVisible();
  }

  // ─── API helpers (setup / cleanup) ──────────────────────────────────

  async getServersViaApi(): Promise<Array<{key: string; title: string}>> {
    const res = await apiGet<IkoRepositoryConfigListResponse>('/api/management/v1/iko');
    return res.content ?? [];
  }

  async deleteServerViaApi(key: string): Promise<void> {
    try {
      await apiDelete(`/api/management/v1/iko/${key}`);
    } catch {
      // Server may already be deleted or never created.
    }
  }

  /** Delete every server whose title starts with the suite prefix. */
  async cleanupTestServersViaApi(titlePrefix: string): Promise<void> {
    try {
      const servers = await this.getServersViaApi();
      for (const server of servers) {
        if (server.title?.startsWith(titlePrefix)) {
          await this.deleteServerViaApi(server.key);
        }
      }
    } catch {
      // Listing failed — nothing reliable to clean up.
    }
  }
}
