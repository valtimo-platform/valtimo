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
  generateObjecttypeId,
  OBJECT_MANAGEMENT_TEXTS,
  SEEDED_OBJECT_TYPE,
  TEST_OBJECT_TYPE,
} from './object-management-config';
import {ObjectManagementPage} from './page';

test.use({storageState: undefined});

/**
 * Feature 12 — the object type configurations at `/object-management`.
 *
 * The tests run in declaration order and share one configuration: it is created
 * through the UI by the first test and edited by the ones after it.
 */
test.describe('Feature 12 — Object management', () => {
  let context;
  let page;
  let request;
  let objectManagementPage: ObjectManagementPage;

  const uniqueId = generateId();
  const objectTypeTitle = `${TEST_OBJECT_TYPE.titlePrefix} ${uniqueId}`;
  const editedTitle = `${TEST_OBJECT_TYPE.editedTitlePrefix} ${uniqueId}`;
  const objecttypeId = generateObjecttypeId(uniqueId);

  /** Every configuration these tests create, so `afterAll` can remove them. */
  const createdIds: string[] = [];

  test.beforeAll(async ({browser, baseURL}) => {
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    request = context.request;

    objectManagementPage = new ObjectManagementPage(page, request);

    await page.goto('/');
  });

  test.afterAll(async () => {
    for (const id of createdIds) {
      await objectManagementPage.deleteConfigurationViaApi(id);
    }

    await context.close();
  });

  test.describe('12.1 — Manage object types', () => {
    test('12.1 — Lists the configured object types', async () => {
      await objectManagementPage.goToObjectManagement();

      const headers = await objectManagementPage.carbonList.table
        .locator('thead th')
        .allInnerTexts();
      expect(headers.map(header => header.trim()).filter(Boolean)).toEqual([
        ...OBJECT_MANAGEMENT_TEXTS.columns,
      ]);

      // The overview matches the API, one row per configuration.
      const configurations = await objectManagementPage.getConfigurationsViaApi();
      expect(configurations.length).toBeGreaterThan(0);
      await objectManagementPage.carbonList.assertRowCount(configurations.length);

      for (const configuration of configurations) {
        await objectManagementPage.rowByTitle(configuration.title).assertVisible();
      }
    });

    test('12.1 — Creates an object type through the modal', async () => {
      await objectManagementPage.goToObjectManagement();
      await objectManagementPage.openCreateModal();

      await expect(objectManagementPage.modalHeading).toHaveText(
        OBJECT_MANAGEMENT_TEXTS.createModalHeading
      );

      await objectManagementPage.fillObjectTypeForm({
        title: objectTypeTitle,
        objecttypeId,
        objecttypeVersion: TEST_OBJECT_TYPE.objecttypeVersion,
      });

      const response = await objectManagementPage.submitModal('POST');
      expect(response.ok()).toBe(true);

      // It joins the overview…
      await objectManagementPage.carbonList.waitForLoaded();
      await objectManagementPage.rowByTitle(objectTypeTitle).assertVisible();

      // …and is persisted with the values the modal was filled with.
      const created = await objectManagementPage.getConfigurationByTitleViaApi(objectTypeTitle);
      expect(created).toBeDefined();
      createdIds.push(created!.id);
      expect(created).toMatchObject({
        title: objectTypeTitle,
        objecttypeId,
        objecttypeVersion: Number(TEST_OBJECT_TYPE.objecttypeVersion),
        // Left untouched in the modal, so both keep their default.
        showInDataMenu: false,
        suppressOutbox: false,
      });
    });

    test.describe('Failure scenarios', () => {
      test('12.1a — Save stays disabled until every required field is filled', async () => {
        await objectManagementPage.goToObjectManagement();
        const before = await objectManagementPage.getConfigurationsViaApi();

        await objectManagementPage.openCreateModal();

        // Nothing filled in yet.
        await expect(objectManagementPage.modalSaveButton).toBeDisabled();

        // Every required field is marked as such, and a title alone is not enough.
        for (const label of OBJECT_MANAGEMENT_TEXTS.requiredFieldLabels) {
          await expect(page.getByText(label, {exact: true}).first()).toBeVisible();
        }
        await objectManagementPage.titleInput.fill(`Incomplete ${uniqueId}`);
        await expect(objectManagementPage.modalSaveButton).toBeDisabled();

        await objectManagementPage.fillObjectTypeForm({
          title: `Incomplete ${uniqueId}`,
          objecttypeId,
          objecttypeVersion: TEST_OBJECT_TYPE.objecttypeVersion,
        });
        await expect(objectManagementPage.modalSaveButton).toBeEnabled();

        // Clearing a required field disables it again.
        await objectManagementPage.titleInput.fill('');
        await expect(objectManagementPage.modalSaveButton).toBeDisabled();

        // Cancelling persists nothing.
        await objectManagementPage.closeModal();
        const after = await objectManagementPage.getConfigurationsViaApi();
        expect(after).toHaveLength(before.length);
      });

      test('12.1b — A duplicate objecttype ID is rejected and nothing is created', async () => {
        await objectManagementPage.goToObjectManagement();
        const before = await objectManagementPage.getConfigurationsViaApi();

        await objectManagementPage.openCreateModal();
        await objectManagementPage.fillObjectTypeForm({
          title: `Duplicate ${uniqueId}`,
          // Already used by a seeded configuration, and the column is unique.
          objecttypeId: SEEDED_OBJECT_TYPE.objecttypeId,
          objecttypeVersion: TEST_OBJECT_TYPE.objecttypeVersion,
        });

        const response = await objectManagementPage.submitModal('POST');
        expect(response.status()).toBe(500);

        // The modal stays open so the value can be corrected. No error is
        // surfaced to the user today; that is deliberately not asserted, so a
        // fix that adds one will not break this test.
        await expect(objectManagementPage.modalSaveButton).toBeVisible();

        await objectManagementPage.closeModal();
        const after = await objectManagementPage.getConfigurationsViaApi();
        expect(after).toHaveLength(before.length);
        expect(
          after.find(configuration => configuration.title === `Duplicate ${uniqueId}`)
        ).toBeUndefined();
      });
    });
  });

  test.describe('12.2 — Edit object type configuration', () => {
    test('12.2 — Opens the detail page with its tabs and actions', async () => {
      const created = await objectManagementPage.getConfigurationByTitleViaApi(objectTypeTitle);
      expect(created, 'the object type created earlier still exists').toBeDefined();

      await objectManagementPage.goToObjectTypeDetail(created!.id);

      await expect(objectManagementPage.generalTab).toHaveText(
        OBJECT_MANAGEMENT_TEXTS.detailTabs[0]
      );
      await expect(objectManagementPage.searchFieldsTab).toHaveText(
        OBJECT_MANAGEMENT_TEXTS.detailTabs[1]
      );
      // The List tab is rendered too: its `*ngIf` is fed an observable that
      // emits an empty array when no list columns are configured, which is
      // truthy.
      await expect(objectManagementPage.listTab).toHaveText(
        OBJECT_MANAGEMENT_TEXTS.detailTabs[2]
      );

      await expect(objectManagementPage.downloadButton).toBeEnabled();
      await expect(objectManagementPage.editButton).toBeEnabled();

      // The tag is bound to showInDataMenu, which is still false.
      await expect(objectManagementPage.visibleInMenuTag).toHaveCount(0);
    });

    test('12.2 — Edits the configuration and persists the change', async () => {
      const created = await objectManagementPage.getConfigurationByTitleViaApi(objectTypeTitle);
      await objectManagementPage.goToObjectTypeDetail(created!.id);

      await objectManagementPage.openEditModal();
      await expect(objectManagementPage.modalHeading).toHaveText(
        OBJECT_MANAGEMENT_TEXTS.editModalHeading
      );

      // The modal opens prefilled with the stored configuration.
      await expect(objectManagementPage.titleInput).toHaveValue(objectTypeTitle);
      await expect(objectManagementPage.objecttypeIdInput).toHaveValue(objecttypeId);

      await objectManagementPage.titleInput.fill(editedTitle);
      // Also flip the menu toggle, so the change is visible on the page itself.
      await objectManagementPage.setShowInDataMenu(true);

      const response = await objectManagementPage.submitModal('PUT');
      expect(response.ok()).toBe(true);

      const updated = await objectManagementPage.getConfigurationByTitleViaApi(editedTitle);
      expect(updated).toMatchObject({
        id: created!.id,
        title: editedTitle,
        showInDataMenu: true,
      });

      // The detail page reflects it after a reload.
      await objectManagementPage.goToObjectTypeDetail(created!.id);
      await expect(objectManagementPage.visibleInMenuTag).toHaveText(
        OBJECT_MANAGEMENT_TEXTS.visibleInMenuTag
      );

      // And so does the overview.
      await objectManagementPage.goToObjectManagement();
      await objectManagementPage.rowByTitle(editedTitle).assertVisible();
      await objectManagementPage.rowByTitle(objectTypeTitle).assertNotVisible();
    });
  });
});
