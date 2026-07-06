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

test.describe('Access Control Management', () => {
  // Create → view → delete is a dependent lifecycle: run in order, share the same page.
  test.describe.configure({mode: 'serial'});

  let accessControlPage: AccessControlPage;

  // Arrange — the `page` fixture is already authenticated via the "admin tests"
  // project's storageState, so we can navigate straight to the roles list.
  test.beforeEach(async ({page, request}) => {
    accessControlPage = new AccessControlPage(page, request);
    await accessControlPage.goToAccessControlList();
  });

  test.afterAll(async ({request}) => {
    // Best-effort cleanup — the role may already be deleted by the 11.8 test.
    await request.delete('/api/management/v1/roles', {data: [roleTestData.key]}).catch(() => {});
  });

  // ─── 11.1 View roles list ─────────────────────────────────────────

  test.describe('11.1 — View roles list', () => {
    test('Roles list is visible', async () => {
      await expect(accessControlPage.rolesList).toBeVisible();
    });
  });

  // ─── 11.2–11.4 Add new role ───────────────────────────────────────

  test.describe('11.2–11.4 — Add new role', () => {
    // Keep open-modal → fill → submit in one test: the beforeEach re-navigates to
    // the list before every test, so a split modal would be lost between blocks.
    test('Add a new role', async () => {
      // Act
      await accessControlPage.addRoleButton.click();
      await expect(accessControlPage.roleNameInput).toBeVisible();
      await accessControlPage.roleNameInput.fill(roleTestData.key);
      await accessControlPage.createRoleButton.click();

      // Assert
      await accessControlPage.assertRoleExists(roleTestData.key);
    });
  });

  // ─── 11.5 View role details ───────────────────────────────────────

  test.describe('11.5 — View role details', () => {
    test('Open role and view permissions editor', async () => {
      // Act — the editor lives behind the "JSON editor" tab; the "Summary" tab is shown first
      await accessControlPage.openRole(roleTestData.key);
      await accessControlPage.openJsonEditorTab();

      // Assert — Monaco editor with permissions JSON is visible
      await accessControlPage.assertPermissionsEditorVisible();
    });
  });

  // ─── 11.8 Delete role ─────────────────────────────────────────────

  test.describe('11.8 — Delete role', () => {
    test('Delete the role', async () => {
      // The beforeEach already lands on the roles list; the role from 11.2 persists (serial mode).
      await accessControlPage.assertRoleExists(roleTestData.key);

      // Act
      await accessControlPage.deleteRole(roleTestData.key);

      // Assert
      await accessControlPage.assertRoleNotExists(roleTestData.key);
    });
  });
});
