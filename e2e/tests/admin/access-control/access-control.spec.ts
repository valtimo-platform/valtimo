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
import {roleTestData} from './access-control';
import {AccessControlPage} from './page';

test.use({storageState: undefined});

test.describe('Access Control Management', () => {
  let context;
  let page;
  let accessControlPage: AccessControlPage;
  let request;

  // Arrange
  test.beforeAll(async ({browser, baseURL}) => {
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    request = context.request;

    accessControlPage = new AccessControlPage(page, request);

    await page.goto('/');
    await accessControlPage.goToAccessControl();
  });

  test.afterAll(async () => {
    await accessControlPage.deleteRolesViaApi([roleTestData.key]);
    await context.close();
  });

  // ─── 11.1 View roles list ─────────────────────────────────────────

  test.describe('11.1 — View roles list', () => {
    test('Roles list is visible', async () => {
      await expect(accessControlPage.rolesList).toBeVisible();
    });
  });

  // ─── 11.2–11.4 Add new role ───────────────────────────────────────

  test.describe('11.2–11.4 — Add new role', () => {
    test.describe('Success', () => {
      test('Open add role modal', async () => {
        // Act
        await accessControlPage.addRoleButton.click();

        // Assert — modal input is visible
        await expect(accessControlPage.roleNameInput).toBeVisible();
      });

      test('Enter role name and create role', async () => {
        // Act
        await accessControlPage.roleNameInput.fill(roleTestData.key);
        await accessControlPage.createRoleButton.click();

        // Assert
        await accessControlPage.assertRoleExists(roleTestData.key);
      });
    });
  });

  // ─── 11.5 View role details ───────────────────────────────────────

  test.describe('11.5 — View role details', () => {
    test('Open role and view permissions editor', async () => {
      // Act
      await accessControlPage.openRole(roleTestData.key);

      // Assert — Monaco editor with permissions JSON is visible
      await accessControlPage.assertPermissionsEditorVisible();
    });
  });

  // ─── 11.8 Delete role ─────────────────────────────────────────────

  test.describe('11.8 — Delete role', () => {
    test('Navigate back to roles list', async () => {
      await page.goBack();
      await page.waitForURL('**/access-control', {waitUntil: 'load'});
      await accessControlPage.assertRoleExists(roleTestData.key);
    });

    test('Delete the role', async () => {
      // Act
      await accessControlPage.deleteRole(roleTestData.key);

      // Assert
      await accessControlPage.assertRoleNotExists(roleTestData.key);
    });
  });
});
