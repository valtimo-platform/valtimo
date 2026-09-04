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
import {jsonPermission, permissionTestData, roleTestData} from './access-control';
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
    // Best-effort cleanup — the role may already be deleted by the 11.8 test. Both keys are
    // listed because 11.6 renames the role and renames it back.
    await request
      .delete('/api/management/v1/roles', {
        data: [roleTestData.key, roleTestData.updatedKey],
      })
      .catch(() => {});
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
      // Act — the modal opens in "choose from list" mode; switch it to manual entry first
      await accessControlPage.openAddRoleModal();
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

  // ─── 11.6 Edit role metadata ──────────────────────────────────────

  test.describe('11.6 — Edit role metadata', () => {
    /**
     * A role's only metadata is its name, and the detail route is keyed on it, so renaming is
     * the whole flow. The role is renamed back afterwards so 11.7 and 11.8 keep working with
     * `roleTestData.key`.
     */
    test('Rename the role via the detail page', async () => {
      // Act
      await accessControlPage.editRoleMetadata(roleTestData.key, roleTestData.updatedKey);

      // Assert — the renamed role replaces the original in the list
      await accessControlPage.goToAccessControlList();
      await accessControlPage.assertRoleExists(roleTestData.updatedKey);
      await accessControlPage.assertRoleNotExists(roleTestData.key);

      // Restore the original name for the remaining tests
      await accessControlPage.editRoleMetadata(roleTestData.updatedKey, roleTestData.key);
      await accessControlPage.goToAccessControlList();
      await accessControlPage.assertRoleExists(roleTestData.key);
    });
  });

  // ─── 11.7 Export role configuration ───────────────────────────────

  test.describe('11.7 — Export role configuration', () => {
    test('Export the role as a single JSON file', async () => {
      // Act
      await accessControlPage.openExportModal(roleTestData.key);
      const download = await accessControlPage.exportSelectedRoleAsSingleFile();

      // Assert — a combined permission file is downloaded
      expect(download.suggestedFilename()).toBe('combined.permission.json');
    });
  });

  // ─── 11.9–11.13 Permissions ───────────────────────────────────────
  //
  // Ordered deliberately: 11.9 switches tabs first, while the editor has no unsaved changes.
  // With pending edits a "leave page" alert modal intercepts every click, so any test that
  // dirties the form must save (or be the last one) before tabs are touched again.

  test.describe('11.9 — View role permissions', () => {
    test('Editor, Summary and JSON editor tabs are available', async () => {
      await accessControlPage.openRole(roleTestData.key);

      // Assert — all three views of the same permissions are reachable
      await expect(accessControlPage.editorTab).toBeVisible();
      await expect(accessControlPage.summaryTab).toBeVisible();
      await expect(accessControlPage.jsonEditorTab).toBeVisible();

      // The form editor is shown first and offers the add-permission action
      await expect(accessControlPage.addPermissionButton).toBeVisible();

      // Toggling to the JSON view shows the raw permissions in a Monaco editor
      await accessControlPage.jsonEditorTab.click();
      await expect(accessControlPage.monacoEditor.first()).toBeVisible();

      // ...and back to the visual editor
      await accessControlPage.editorTab.click();
      await expect(accessControlPage.addPermissionButton).toBeVisible();
    });
  });

  test.describe('11.10, 11.13 — Edit and save permissions JSON', () => {
    test('Write permissions in the JSON editor and save them', async () => {
      test.setTimeout(60_000);
      await accessControlPage.openRole(roleTestData.key);
      await accessControlPage.jsonEditorTab.click();

      // Act
      await accessControlPage.setPermissionsJson([jsonPermission]);
      await accessControlPage.savePermissions(roleTestData.key);

      // Assert — the permission is persisted
      await accessControlPage.assertRolePermissions(
        roleTestData.key,
        permissions =>
          permissions.some(
            p =>
              p.resourceType === jsonPermission.resourceType &&
              p.actions.includes(jsonPermission.actions[0])
          ),
        `permission ${jsonPermission.resourceType}/${jsonPermission.actions[0]} was not saved`
      );
    });
  });

  test.describe('11.11, 11.12, 11.13 — Configure resource permissions and conditions', () => {
    /**
     * One test on purpose: the permission card is transient form state. Splitting the build-up
     * across tests would lose it (and under retries the page is re-navigated).
     */
    test('Add a permission with a resource type, action and condition, then save', async () => {
      test.setTimeout(90_000);
      await accessControlPage.openRole(roleTestData.key);

      // Act — 11.11: resource type + action
      await accessControlPage.addPermissionButton.click();
      await expect(accessControlPage.permissionCards.first()).toBeVisible();
      await accessControlPage.selectResourceType(permissionTestData.resourceType);
      await accessControlPage.toggleAction(permissionTestData.actionLabel);
      await accessControlPage.assertActionChecked(permissionTestData.actionLabel);

      // Act — 11.12: a condition on that permission
      await accessControlPage.addPermissionCondition({
        field: permissionTestData.conditionField,
        operator: permissionTestData.conditionOperator,
        value: permissionTestData.conditionValue,
      });

      // Act — 11.13: save
      await accessControlPage.savePermissions(roleTestData.key);

      // Assert — the new permission is stored with a condition attached
      await accessControlPage.assertRolePermissions(
        roleTestData.key,
        permissions =>
          permissions.some(
            p =>
              p.resourceType === permissionTestData.resourceTypeFqn &&
              p.actions.includes(permissionTestData.action) &&
              p.conditions.some(
                c =>
                  c.field === permissionTestData.conditionField &&
                  c.operator === permissionTestData.conditionOperatorSymbol &&
                  c.value === permissionTestData.conditionValue
              )
          ),
        'no permission with a condition was saved'
      );
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
