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

import {expect, test} from '@playwright/test';
import {generateId} from '../../utils/dataGenerator';
import {expectNotificationMessage} from '../../utils/ui.utils';
import {
  ARTWORK_FILE_NAME,
  BUILDING_BLOCK_DETAIL_TEXTS,
  SEEDED_BUILDING_BLOCK_WITH_PLUGINS,
  TEST_BUILDING_BLOCK,
  UPDATED_METADATA,
} from './building-block-details-config';
import {BUILDING_BLOCK_TABS, BuildingBlockDetailsPage} from './page';

test.use({storageState: undefined});

test.describe('Building block management — building block details', () => {
  let context;
  let page;
  let request;
  let detailsPage: BuildingBlockDetailsPage;

  /**
   * The building block created for this suite. Key *and* name carry the same
   * unique id: the overview list identifies rows by key, but a duplicated name
   * would still make name-based lookups in other specs ambiguous.
   */
  const uniqueId = generateId();
  const buildingBlockKey = `${TEST_BUILDING_BLOCK.keyPrefix}-${uniqueId}`;
  const buildingBlockName = `${TEST_BUILDING_BLOCK.namePrefix} ${uniqueId}`;
  const updatedName = `${UPDATED_METADATA.namePrefix} ${uniqueId}`;
  const initialVersion = TEST_BUILDING_BLOCK.initialVersionTag;
  const draftVersion = TEST_BUILDING_BLOCK.draftVersionTag;

  test.beforeAll(async ({browser, baseURL}) => {
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    request = context.request;

    detailsPage = new BuildingBlockDetailsPage(page, request);

    // Create the building block through the API so the UI tests start from a
    // known state: one draft version, no artwork, no plugins.
    await detailsPage.createBuildingBlockViaApi({
      key: buildingBlockKey,
      name: buildingBlockName,
      versionTag: initialVersion,
      description: TEST_BUILDING_BLOCK.description,
    });

    await page.goto('/');
  });

  test.afterAll(async () => {
    // Artwork can be removed; the building block itself cannot — there is no
    // DELETE endpoint for building block definitions (see
    // `deleteBuildingBlockViaApi`). Both versions created here stay behind until
    // that endpoint exists.
    for (const versionTag of [initialVersion, draftVersion]) {
      await detailsPage.deleteArtworkViaApi(buildingBlockKey, versionTag);
    }

    for (const versionTag of [draftVersion, initialVersion]) {
      await detailsPage.deleteBuildingBlockViaApi(buildingBlockKey, versionTag);
    }

    await context.close();
  });

  test.describe('13.10, 13.13 — View general information', () => {
    test('13.10 — General tab shows the building block name, key and description', async () => {
      await detailsPage.goToGeneralTab(buildingBlockKey, initialVersion);

      await detailsPage.assertTabsVisible(BUILDING_BLOCK_DETAIL_TEXTS.tabs);
      await detailsPage.assertMetadata({
        name: buildingBlockName,
        key: buildingBlockKey,
        description: TEST_BUILDING_BLOCK.description,
      });
    });

    test('13.13 — A building block without plugins shows the empty plugins message', async () => {
      await detailsPage.goToGeneralTab(buildingBlockKey, initialVersion);

      await detailsPage.assertNoPluginsUsed(BUILDING_BLOCK_DETAIL_TEXTS.noPluginsUsed);
    });

    test('13.13 — The plugins used by a building block are listed', async () => {
      await detailsPage.goToGeneralTab(
        SEEDED_BUILDING_BLOCK_WITH_PLUGINS.key,
        SEEDED_BUILDING_BLOCK_WITH_PLUGINS.versionTag
      );

      await detailsPage.assertUsedPlugins(SEEDED_BUILDING_BLOCK_WITH_PLUGINS.pluginTitles);
    });
  });

  test.describe('13.11, 13.12 — View the document and processes tabs', () => {
    test('13.11 — Document tab shows the document schema of the building block', async () => {
      await detailsPage.goToTab(buildingBlockKey, initialVersion, BUILDING_BLOCK_TABS.document);

      // Creating a building block generates a `<key>.schema` document definition.
      await detailsPage.assertSchemaEditorShows(`${buildingBlockKey}.schema`);
    });

    test('13.12 — Processes tab lists the process of the building block', async () => {
      await detailsPage.goToTab(buildingBlockKey, initialVersion, BUILDING_BLOCK_TABS.processes);
      await detailsPage.processList.waitForLoaded();

      const headers = await detailsPage.processList.table.locator('thead th').allInnerTexts();
      expect(headers.map(header => header.trim())).toEqual([
        ...BUILDING_BLOCK_DETAIL_TEXTS.processColumns,
      ]);

      // Creating a building block also generates its main process definition.
      const processes = await detailsPage.getBuildingBlockProcessesViaApi(
        buildingBlockKey,
        initialVersion
      );
      expect(processes.length).toBeGreaterThan(0);

      const row = detailsPage.processList.row(buildingBlockKey);
      await row.assertVisible();
      await expect(row.tags).toContainText(BUILDING_BLOCK_DETAIL_TEXTS.mainProcessTag);
    });
  });

  test.describe('13.16 — Save building block metadata', () => {
    test('13.16 — Saves an updated name and description', async () => {
      await detailsPage.goToGeneralTab(buildingBlockKey, initialVersion);

      await detailsPage.fillMetadata({
        name: updatedName,
        description: UPDATED_METADATA.description,
      });

      const response = await detailsPage.saveMetadata(buildingBlockKey, initialVersion);
      expect(response.status()).toBe(200);

      const definition = await detailsPage.getBuildingBlockViaApi(buildingBlockKey, initialVersion);
      expect(definition).toMatchObject({
        key: buildingBlockKey,
        name: updatedName,
        description: UPDATED_METADATA.description,
      });

      // The saved values survive a reload.
      await detailsPage.goToGeneralTab(buildingBlockKey, initialVersion);
      await detailsPage.assertMetadata({
        name: updatedName,
        key: buildingBlockKey,
        description: UPDATED_METADATA.description,
      });
    });

    test.describe('Failure scenarios', () => {
      test('Save is disabled while nothing has changed and when the name is cleared', async () => {
        await detailsPage.goToGeneralTab(buildingBlockKey, initialVersion);

        // Pristine form.
        await expect(detailsPage.metadataSaveButton).toBeDisabled();

        // Name is required.
        await detailsPage.fillMetadata({name: ''});
        await expect(detailsPage.metadataSaveButton).toBeDisabled();

        // Restoring a value re-enables saving.
        await detailsPage.fillMetadata({name: updatedName});
        await expect(detailsPage.metadataSaveButton).toBeEnabled();
      });
    });
  });

  test.describe('13.14, 13.15 — Building block artwork', () => {
    test('13.14, 13.15 — Uploads artwork and deletes it again', async () => {
      await detailsPage.goToGeneralTab(buildingBlockKey, initialVersion);

      // 13.14 — upload
      await expect(detailsPage.artworkFileUploader).toBeVisible();
      await expect(detailsPage.artworkImage).toHaveCount(0);

      const uploadResponse = await detailsPage.uploadArtwork(
        buildingBlockKey,
        initialVersion,
        ARTWORK_FILE_NAME
      );
      expect(uploadResponse.status()).toBe(200);

      await expect(detailsPage.artworkImage).toBeVisible();
      // Once artwork exists the uploader is replaced by a delete action, so
      // replacing artwork means deleting it first.
      await expect(detailsPage.artworkFileUploader).toHaveCount(0);
      expect(await detailsPage.getArtworkViaApi(buildingBlockKey, initialVersion)).not.toBeNull();

      // 13.15 — delete, which asks for confirmation first
      await detailsPage.openArtworkDeleteConfirmation();
      await expect(detailsPage.openModal).toContainText(
        BUILDING_BLOCK_DETAIL_TEXTS.deleteArtworkConfirmation
      );

      const deleteResponse = await detailsPage.confirmArtworkDeletion(
        buildingBlockKey,
        initialVersion
      );
      expect(deleteResponse.status()).toBe(204);

      await expect(detailsPage.artworkFileUploader).toBeVisible();
      await expect(detailsPage.artworkImage).toHaveCount(0);
      expect(await detailsPage.getArtworkViaApi(buildingBlockKey, initialVersion)).toBeNull();
    });

    test.describe('Failure scenarios', () => {
      test('Upload is disabled until a file is selected', async () => {
        await detailsPage.goToGeneralTab(buildingBlockKey, initialVersion);

        await expect(detailsPage.artworkFileUploader).toBeVisible();
        await expect(detailsPage.artworkUploadButton).toBeDisabled();
      });
    });
  });

  test.describe('13.17 — Export the building block', () => {
    test('13.17 — Exports the building block as a ZIP', async () => {
      await detailsPage.goToGeneralTab(buildingBlockKey, initialVersion);

      const download = await detailsPage.exportBuildingBlock();

      expect(download.suggestedFilename()).toContain(buildingBlockKey);
      expect(download.suggestedFilename()).toMatch(/\.zip$/);
      await expectNotificationMessage(page, BUILDING_BLOCK_DETAIL_TEXTS.exportStarted);
    });
  });

  /**
   * These tests share one building block and run in declaration order: the draft
   * has to be finalized before a new draft can be created, and both versions have
   * to exist before they can be switched between.
   */
  test.describe('13.18–13.22 — Version lifecycle', () => {
    test('13.20 — A draft version is badged as DRAFT and can be edited', async () => {
      await detailsPage.goToGeneralTab(buildingBlockKey, initialVersion);

      await detailsPage.assertDraftVersionSelected(initialVersion);
      // A single version leaves nothing to switch to.
      await expect(detailsPage.versionDropdownButton).toBeDisabled();

      // Draft versions are editable.
      await detailsPage.fillMetadata({name: updatedName});
      await expect(detailsPage.metadataSaveButton).toBeEnabled();
    });

    test('13.22 — Finalizes the draft version, which becomes read-only', async () => {
      await detailsPage.goToGeneralTab(buildingBlockKey, initialVersion);

      // A draft offers "Make version final"; creating a draft is only offered on
      // a version that is already final.
      const draftActions = await detailsPage.readMoreMenuOptions();
      expect(draftActions).toContain(BUILDING_BLOCK_DETAIL_TEXTS.makeFinalAction);
      expect(draftActions).not.toContain(BUILDING_BLOCK_DETAIL_TEXTS.createDraftAction);

      const response = await detailsPage.finalizeVersion(buildingBlockKey, initialVersion);
      expect(response.status()).toBe(200);

      await expectNotificationMessage(page, BUILDING_BLOCK_DETAIL_TEXTS.finalizeSuccess);

      // 13.20 — the DRAFT badge is gone once the version is final.
      await detailsPage.assertFinalVersionSelected(initialVersion);
      await expect(detailsPage.metadataSaveButton).toBeDisabled();

      const versions = await detailsPage.getVersionsViaApi(buildingBlockKey);
      expect(versions).toEqual(expect.arrayContaining([{versionTag: initialVersion, final: true}]));
    });

    test('13.18, 13.19 — Creates a draft version from the finalized version', async () => {
      await detailsPage.goToGeneralTab(buildingBlockKey, initialVersion);

      // Now that the version is final, the draft action replaces "Make final".
      const finalActions = await detailsPage.readMoreMenuOptions();
      expect(finalActions).toContain(BUILDING_BLOCK_DETAIL_TEXTS.createDraftAction);
      expect(finalActions).not.toContain(BUILDING_BLOCK_DETAIL_TEXTS.makeFinalAction);

      await detailsPage.openDraftModal();

      // 13.19 — a version tag is required.
      await expect(detailsPage.draftConfirmButton).toBeDisabled();

      const response = await detailsPage.createDraft(
        buildingBlockKey,
        initialVersion,
        draftVersion
      );
      expect(response.status()).toBe(200);

      await expectNotificationMessage(page, BUILDING_BLOCK_DETAIL_TEXTS.draftSuccess);

      // Creating the draft navigates to it.
      await page.waitForURL(new RegExp(`/version/${draftVersion}/`));
      await detailsPage.assertDraftVersionSelected(draftVersion);

      const versions = await detailsPage.getVersionsViaApi(buildingBlockKey);
      expect(versions).toEqual(expect.arrayContaining([{versionTag: draftVersion, final: false}]));
    });

    test('13.21 — Switches between versions through the dropdown', async () => {
      await detailsPage.goToGeneralTab(buildingBlockKey, draftVersion);

      // Two versions now exist, so the dropdown offers both.
      await detailsPage.openVersionDropdown();
      await expect(detailsPage.versionOption(initialVersion)).toBeVisible();
      await expect(detailsPage.versionOption(draftVersion)).toBeVisible();
      await detailsPage.versionOption(initialVersion).click();

      await page.waitForURL(new RegExp(`/version/${initialVersion}/`));
      await detailsPage.assertFinalVersionSelected(initialVersion);

      // ...and back to the draft.
      await detailsPage.switchToVersion(draftVersion);
      await detailsPage.assertDraftVersionSelected(draftVersion);
    });
  });
});
