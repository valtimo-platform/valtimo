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
import {
  BUILDING_BLOCK_TEXTS,
  IMPORT_ARCHIVE,
  INVALID_IMPORT_ARCHIVE_FILE_NAME,
  NEW_BUILDING_BLOCK,
  SEEDED_BUILDING_BLOCK,
} from './building-block-config';
import {BuildingBlockDefinition, BuildingBlockManagementPage} from './page';

test.use({storageState: undefined});

test.describe('Building block management — building block overview', () => {
  let context;
  let page;
  let request;
  let buildingBlockPage: BuildingBlockManagementPage;
  let existingBuildingBlocks: BuildingBlockDefinition[];

  /** Building blocks created through the UI, tracked for cleanup. */
  const createdBuildingBlocks: {key: string; versionTag: string}[] = [];

  test.beforeAll(async ({browser, baseURL}) => {
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    request = context.request;

    buildingBlockPage = new BuildingBlockManagementPage(page, request);

    await page.goto('/');
    await buildingBlockPage.goToBuildingBlockManagement();

    existingBuildingBlocks = await buildingBlockPage.getBuildingBlocksViaApi();
  });

  test.afterAll(async () => {
    // Building block definitions cannot be removed: the management API has no
    // DELETE endpoint for them (see `deleteBuildingBlockViaApi`). The calls below
    // are no-ops today and will clean up once that endpoint exists. Until then
    // the building block created by the create test stays in the environment.
    for (const buildingBlock of createdBuildingBlocks) {
      await buildingBlockPage.deleteBuildingBlockViaApi(
        buildingBlock.key,
        buildingBlock.versionTag
      );
    }

    await context.close();
  });

  test.describe('13.1, 13.2 — View building blocks and their metadata', () => {
    test('13.1 — Building blocks list is visible and loaded', async () => {
      await buildingBlockPage.goToBuildingBlockManagement();
      await buildingBlockPage.assertListLoaded();
    });

    test('13.1 — List shows every building block returned by the API', async () => {
      const buildingBlocks = await buildingBlockPage.getBuildingBlocksViaApi();

      await buildingBlockPage.goToBuildingBlockManagement();

      await expect(buildingBlockPage.carbonList.rows).toHaveCount(buildingBlocks.length);

      for (const buildingBlock of buildingBlocks) {
        await buildingBlockPage.assertBuildingBlockVisibleByKey(buildingBlock.key);
      }
    });

    test('13.2 — List shows the name, key and version columns', async () => {
      await buildingBlockPage.goToBuildingBlockManagement();
      await buildingBlockPage.assertColumnHeaders(BUILDING_BLOCK_TEXTS.listColumns);
    });

    test('13.2 — Row shows the name, key and version tag of a building block', async () => {
      // Resolve the version from the API instead of hardcoding it, so the test
      // does not break when the seeded content moves to another version.
      const seeded = existingBuildingBlocks.find(
        buildingBlock => buildingBlock.key === SEEDED_BUILDING_BLOCK.key
      );
      expect(
        seeded,
        `seeded building block "${SEEDED_BUILDING_BLOCK.key}" is missing`
      ).toBeDefined();

      await buildingBlockPage.goToBuildingBlockManagement();
      await buildingBlockPage.assertBuildingBlockMetadata({
        name: seeded!.name,
        key: seeded!.key,
        versionTag: seeded!.versionTag,
      });
    });
  });

  test.describe('13.5–13.9 — Create a new building block', () => {
    test('13.6, 13.7 — Key is auto-generated from the name and de-duplicated', async () => {
      await buildingBlockPage.openCreateModal();

      // The key is derived from the name, not typed by the user.
      await expect(buildingBlockPage.keyInput).toHaveAttribute('readonly', '');
      await expect(buildingBlockPage.keyInput).toHaveValue('');

      await buildingBlockPage.nameInput.fill(SEEDED_BUILDING_BLOCK.collidingName);

      // "income check" slugifies to the key of an existing building block, so
      // the generator appends a counter instead of producing a duplicate.
      await expect(buildingBlockPage.keyInput).toHaveValue(SEEDED_BUILDING_BLOCK.deduplicatedKey);

      await buildingBlockPage.closeCreateModal();
    });

    test('13.5, 13.8, 13.9 — Creates a building block and opens its detail page', async () => {
      const name = `${NEW_BUILDING_BLOCK.namePrefix} ${generateId()}`;

      await buildingBlockPage.openCreateModal();
      await buildingBlockPage.fillCreateForm({
        name,
        versionTag: NEW_BUILDING_BLOCK.versionTag,
        description: NEW_BUILDING_BLOCK.description,
      });

      const key = await buildingBlockPage.keyInput.inputValue();
      createdBuildingBlocks.push({key, versionTag: NEW_BUILDING_BLOCK.versionTag});

      const response = await buildingBlockPage.saveCreateForm();
      expect(response.status()).toBe(200);

      // Saving navigates straight to the new building block's General tab.
      await buildingBlockPage.assertOnBuildingBlockDetail(key, NEW_BUILDING_BLOCK.versionTag);

      // Name, version and description were persisted as entered.
      const created = await buildingBlockPage.getBuildingBlockViaApi(
        key,
        NEW_BUILDING_BLOCK.versionTag
      );
      expect(created).toMatchObject({
        key,
        name,
        versionTag: NEW_BUILDING_BLOCK.versionTag,
        description: NEW_BUILDING_BLOCK.description,
      });

      // And it shows up in the overview.
      await buildingBlockPage.goToBuildingBlockManagement();
      await buildingBlockPage.assertBuildingBlockMetadata({
        name,
        key,
        versionTag: NEW_BUILDING_BLOCK.versionTag,
      });
    });

    test.describe('Failure scenarios', () => {
      test('Cannot save without a name or a version', async () => {
        await buildingBlockPage.openCreateModal();
        await expect(buildingBlockPage.createSaveButton).toBeDisabled();

        // Name only — version is still missing.
        await buildingBlockPage.nameInput.fill(`${NEW_BUILDING_BLOCK.namePrefix} ${generateId()}`);
        await expect(buildingBlockPage.keyInput).not.toHaveValue('');
        await expect(buildingBlockPage.createSaveButton).toBeDisabled();

        // Version only — clearing the name also clears the generated key.
        await buildingBlockPage.versionInput.fill(NEW_BUILDING_BLOCK.versionTag);
        await buildingBlockPage.nameInput.fill('');
        await expect(buildingBlockPage.createSaveButton).toBeDisabled();

        await buildingBlockPage.closeCreateModal();
      });

      test('Cannot save with a manually entered duplicate key', async () => {
        await buildingBlockPage.openCreateModal();
        await buildingBlockPage.fillCreateForm({
          name: `${NEW_BUILDING_BLOCK.namePrefix} ${generateId()}`,
          versionTag: NEW_BUILDING_BLOCK.versionTag,
        });
        await expect(buildingBlockPage.createSaveButton).toBeEnabled();

        await buildingBlockPage.enterKeyManually(SEEDED_BUILDING_BLOCK.key);

        await expect(buildingBlockPage.duplicateKeyError).toBeVisible();
        await expect(buildingBlockPage.createSaveButton).toBeDisabled();

        await buildingBlockPage.closeCreateModal();

        // Nothing was created.
        const buildingBlocks = await buildingBlockPage.getBuildingBlocksViaApi();
        expect(
          buildingBlocks.filter(buildingBlock => buildingBlock.key === SEEDED_BUILDING_BLOCK.key)
        ).toHaveLength(1);
      });

      test('Cannot save with a key that contains invalid characters', async () => {
        await buildingBlockPage.openCreateModal();
        await buildingBlockPage.fillCreateForm({
          name: `${NEW_BUILDING_BLOCK.namePrefix} ${generateId()}`,
          versionTag: NEW_BUILDING_BLOCK.versionTag,
        });
        await expect(buildingBlockPage.createSaveButton).toBeEnabled();

        // Only [A-Za-z0-9-] is accepted.
        await buildingBlockPage.enterKeyManually('invalid key!');
        await expect(buildingBlockPage.createSaveButton).toBeDisabled();

        await buildingBlockPage.closeCreateModal();
      });
    });
  });

  test.describe('13.3, 13.4 — Upload a building block definition', () => {
    test('13.3 — Wizard starts on the plugin step and advances to file select', async () => {
      await buildingBlockPage.openUploadModal();

      // Step 1 only informs about plugins — no file input yet.
      await expect(buildingBlockPage.fileUploader).not.toBeVisible();

      await buildingBlockPage.goToFileSelectStep();

      await expect(buildingBlockPage.fileUploader).toContainText(
        BUILDING_BLOCK_TEXTS.fileSelectStepTitle
      );
      await expect(buildingBlockPage.fileUploader).toContainText(BUILDING_BLOCK_TEXTS.fileSizeHint);
      // The file select step is the only step that can be stepped back from.
      await expect(buildingBlockPage.uploadBackButton).toBeVisible();

      await buildingBlockPage.uploadCancelButton.click();
    });

    test('13.4 — Upload is blocked until the overwrite warning is acknowledged', async () => {
      await buildingBlockPage.openUploadModal();
      await buildingBlockPage.goToFileSelectStep();

      await expect(buildingBlockPage.overwriteWarning).toContainText(
        BUILDING_BLOCK_TEXTS.overwriteWarning
      );
      await expect(buildingBlockPage.overwriteCheckbox).toContainText(
        BUILDING_BLOCK_TEXTS.overwriteCheckbox
      );

      // No file and no acknowledgement.
      await expect(buildingBlockPage.uploadNextButton).toBeDisabled();

      // A file on its own is not enough.
      await buildingBlockPage.selectArchive(IMPORT_ARCHIVE.fileName);
      await expect(buildingBlockPage.uploadNextButton).toBeDisabled();

      // Acknowledging the warning unlocks the upload.
      await buildingBlockPage.acknowledgeOverwriteWarning();
      await expect(buildingBlockPage.uploadNextButton).toBeEnabled();

      await buildingBlockPage.uploadCancelButton.click();
    });

    test('13.3, 13.4 — Imports a building block archive', async () => {
      const response = await buildingBlockPage.importArchive(IMPORT_ARCHIVE.fileName);
      expect(response.status()).toBe(200);

      await buildingBlockPage.assertUploadSucceeded();
      await buildingBlockPage.finishUpload();

      // The imported building block is available through the API...
      const imported = await buildingBlockPage.getBuildingBlockViaApi(
        IMPORT_ARCHIVE.key,
        IMPORT_ARCHIVE.versionTag
      );
      expect(imported).toMatchObject({
        key: IMPORT_ARCHIVE.key,
        name: IMPORT_ARCHIVE.name,
        versionTag: IMPORT_ARCHIVE.versionTag,
      });

      // ...and listed in the overview.
      await buildingBlockPage.goToBuildingBlockManagement();
      await buildingBlockPage.assertBuildingBlockMetadata(IMPORT_ARCHIVE);
    });

    test.describe('Failure scenarios', () => {
      test('An archive without a building block definition fails the import', async () => {
        const response = await buildingBlockPage.importArchive(INVALID_IMPORT_ARCHIVE_FILE_NAME);
        expect(response.ok()).toBe(false);

        await buildingBlockPage.assertUploadFailed();
        await buildingBlockPage.finishUpload();

        // No building block was added.
        const buildingBlocks = await buildingBlockPage.getBuildingBlocksViaApi();
        expect(buildingBlocks.map(buildingBlock => buildingBlock.key)).not.toContain(
          'not-a-building-block'
        );
      });
    });
  });
});
