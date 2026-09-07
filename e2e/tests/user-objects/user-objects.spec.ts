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
import {USER_OBJECT_TYPE, USER_OBJECTS_TEXTS} from './user-objects-config';
import {UserObjectsPage} from './page';

test.use({storageState: 'playwright/.auth/uiState.json'});

/**
 * Feature 4 — the object pages a user reads at `/objects`.
 *
 * These tests are deliberately read-only: they assert against the seeded object
 * type rather than creating objects, so nothing has to be cleaned up and the
 * shared Objecten API is left untouched.
 */
test.describe('Feature 4 — Objects (User)', () => {
  let context;
  let page;
  let userObjectsPage: UserObjectsPage;

  let objectManagementId: string;

  test.beforeAll(async ({browser, baseURL}) => {
    context = await browser.newContext({
      baseURL,
      storageState: 'playwright/.auth/uiState.json',
    });
    page = await context.newPage();
    userObjectsPage = new UserObjectsPage(page);

    const configuration = await userObjectsPage.getConfigurationByTitleViaApi(
      USER_OBJECT_TYPE.title
    );
    if (!configuration) {
      test.skip(
        true,
        `No object type "${USER_OBJECT_TYPE.title}" is exposed to users in this environment; ` +
          'the object pages cannot be reached without one.'
      );
    }
    objectManagementId = configuration!.id;

    await page.goto('/');
  });

  test.afterAll(async () => {
    // Read-only suite — nothing to clean up.
    await context.close();
  });

  test.describe('4.1 — View objects per type', () => {
    test('4.1 — Lists the objects of one type', async () => {
      await userObjectsPage.goToObjectList(objectManagementId);

      // The type has no list columns configured, so the component falls back to
      // its two default fields.
      await userObjectsPage.assertColumnHeaders(USER_OBJECTS_TEXTS.defaultColumns);

      const objects = await userObjectsPage.getObjectsViaApi(objectManagementId);
      expect(objects.totalElements).toBeGreaterThan(0);

      // The first page is shown, capped at the page size.
      await userObjectsPage.carbonList.assertRowCount(objects.content.length);
      await expect(userObjectsPage.carbonList.pagination).toBeVisible();

      // Every row carries the object URL its record was keyed on.
      const firstUrl = objects.content[0].items.find(item => item.key === 'objectUrl')
        ?.value as string;
      await expect(userObjectsPage.carbonList.rows.first()).toContainText(firstUrl);
    });

    test('4.1 — The list is scoped to the requested type', async () => {
      await userObjectsPage.goToObjectList(objectManagementId);

      // Only the configurations flagged for the data menu are reachable, and
      // the route renders exactly the one it was given.
      const configurations = await userObjectsPage.getConfigurationsViaApi();
      const requested = configurations.find(
        configuration => configuration.id === objectManagementId
      );
      expect(requested?.title).toBe(USER_OBJECT_TYPE.title);

      const objects = await userObjectsPage.getObjectsViaApi(objectManagementId);
      await userObjectsPage.carbonList.assertRowCount(objects.content.length);
    });
  });

  test.describe('4.2 — View object details', () => {
    test('4.2 — Opens an object from its row and shows the summary form', async () => {
      await userObjectsPage.goToObjectList(objectManagementId);

      const objects = await userObjectsPage.getObjectsViaApi(objectManagementId);
      const firstUrl = objects.content[0].items.find(item => item.key === 'objectUrl')
        ?.value as string;
      const objectId = UserObjectsPage.objectIdFromUrl(firstUrl);

      await userObjectsPage.carbonList.rows.first().click();

      // The row navigates to the object, keyed on the plain id rather than the
      // full Objecten API URL.
      await page.waitForURL(new RegExp(`/objects/${objectManagementId}/${objectId}$`));

      // The configured view form renders the object read-only, with the edit and
      // delete actions beside it.
      await expect(userObjectsPage.summaryForm).toBeVisible();
      await expect(userObjectsPage.editButton).toBeVisible();
      await expect(userObjectsPage.deleteButton).toBeVisible();
    });

    test('4.2 — The detail page can be opened directly by URL', async () => {
      const objects = await userObjectsPage.getObjectsViaApi(objectManagementId);
      const secondUrl = objects.content[1].items.find(item => item.key === 'objectUrl')
        ?.value as string;
      const objectId = UserObjectsPage.objectIdFromUrl(secondUrl);

      await userObjectsPage.goToObjectDetail(objectManagementId, objectId);
      await expect(userObjectsPage.summaryForm).toBeVisible();
    });

    test.describe('Failure scenarios', () => {
      test('4.2a — An unknown object id renders no summary form', async () => {
        await userObjectsPage.goToObjectDetail(
          objectManagementId,
          '00000000-0000-4000-8000-000000000000'
        );

        // The route still resolves, but there is no object to render a form for.
        await expect(userObjectsPage.summaryForm).toHaveCount(0);
      });
    });
  });
});
