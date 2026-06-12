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
  IKO_MANAGEMENT_TEST_IDS,
  IKO_PROPERTIES_TEST_IDS,
  IKO_REPOSITORY_MODAL_TEST_IDS,
  IKO_UPLOAD_MODAL_TEST_IDS,
} from '../../../../constants';
import {apiDelete, apiGet, apiPost} from '../../../../utils/api.utils';
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
    // Navigate straight to the IKO management list route instead of loading the
    // dashboard at "/" and clicking through the Admin menu. Loading "/" renders
    // the (chart-heavy) dashboard plus its SSE subscriptions, which made the
    // renderer flaky ("Target crashed") when this suite ran first. The other IKO
    // suites already navigate directly to their deep `/iko-management/...` URLs.
    await this.page.goto('/iko-management');
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

  /**
   * Fill the modal's title + IKO server URL and wait until the form is valid
   * (Save enabled). A freshly opened modal initialises its reactive form
   * asynchronously: a late `writeValue('')` can wipe an early `fill`, and the
   * AutoKeyInput only auto-generates the key once its `mode` has propagated.
   * Re-filling every field via `toPass` until Save is enabled defeats both
   * races — mirroring a user typing into a warmed-up form.
   */
  async fillServerForm(title: string, url: string): Promise<void> {
    await expect(async () => {
      await this.titleInput.fill(title);
      // The key auto-generates from the title (15.4).
      await expect(this.keyInput).not.toHaveValue('', {timeout: 2_000});
      await this.serverUrlInput.fill(url);
      await expect(this.saveButton).toBeEnabled({timeout: 2_000});
    }).toPass({timeout: 20_000});
  }

  async save(): Promise<void> {
    await expect(this.saveButton).toBeEnabled();
    await this.saveButton.click();
    await expect(this.modalHeading).toBeHidden();
  }

  /** Full happy-path creation. Returns the auto-generated key. */
  async createServer(title: string, url: string): Promise<string> {
    await this.openConfigureModal();
    await this.fillServerForm(title, url);
    const key = await this.keyInput.inputValue();
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

  /**
   * Create an IKO server directly via the management API. Use this for
   * setup in `beforeAll` hooks when the UI side of the modal is not what's
   * under test — it's faster and avoids any UI-side races.
   * Returns the slugified key used by the server.
   */
  async createServerViaApi(title: string, url: string): Promise<string> {
    const key = title
      .toLowerCase()
      .replace(/[^a-z0-9-_]+|-[^a-z0-9]+/g, '-')
      .replace(/^[^a-z]+/g, '');
    await apiPost(`/api/management/v1/iko/${key}`, {
      key,
      title,
      type: 'iko',
      properties: {[ikoServerConfig.serverUrlPropertyKey]: url},
    });
    return key;
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
