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

import {APIRequestContext, expect, Page} from '@playwright/test';
import {CarbonList} from '../../shared/carbon-list/carbon-list.utils';

export class AccessControlPage {
  constructor(
    private readonly page: Page,
    private readonly request: APIRequestContext
  ) {}

  // ─── Navigation ───────────────────────────────────────────────────

  async goToAccessControl() {
    await this.page.getByRole('button', {name: 'Admin'}).click();
    await this.page.getByRole('link', {name: 'Access Control'}).click();
    await this.page.waitForSelector('valtimo-carbon-list');
  }

  async openRole(roleKey: string) {
    const list = new CarbonList(this.page);
    await list.row(roleKey).click();
  }

  // ─── UI Elements ──────────────────────────────────────────────────

  get rolesList() {
    return this.page.locator('valtimo-carbon-list');
  }

  get addRoleButton() {
    // Two "Add new role" buttons exist when list is empty: toolbar + no-results panel.
    // Scope to toolbar to avoid strict mode violation.
    return this.page.getByLabel('Table action bar').getByRole('button', {name: 'Add new role'});
  }

  // Role metadata modal: cds-label wrapping "Role name" input, no data-test-ids
  get roleNameInput() {
    return this.page
      .locator('cds-modal')
      .locator('cds-label')
      .filter({hasText: 'Role name'})
      .locator('input');
  }

  get createRoleButton() {
    return this.page.locator('cds-modal-footer').getByRole('button', {name: 'Create'});
  }

  get cancelRoleButton() {
    return this.page.locator('cds-modal-footer').getByRole('button', {name: 'Cancel'});
  }

  get permissionsEditor() {
    return this.page.locator('valtimo-editor');
  }

  get savePermissionsButton() {
    return this.page.getByRole('button', {name: 'Save'});
  }

  // ─── Actions ──────────────────────────────────────────────────────

  async addRole(roleKey: string) {
    await this.addRoleButton.click();
    await this.roleNameInput.fill(roleKey);
    await this.createRoleButton.click();
  }

  async deleteRole(roleKey: string) {
    const list = new CarbonList(this.page);
    await list.row(roleKey).select();
    // Click the batch-action "Delete" button (only visible after row selection)
    await this.page.locator('cds-table-toolbar-actions').getByRole('button', {name: 'Delete'}).click();
    // Confirm in valtimo-delete-role-modal — use data-test-id to avoid strict-mode ambiguity
    await this.page.getByTestId('confirmationModalConfirm').click();
  }

  // ─── Assertions ───────────────────────────────────────────────────

  async assertRoleExists(roleKey: string) {
    await expect(this.page.locator(`td:has-text("${roleKey}")`).first()).toBeVisible();
  }

  async assertRoleNotExists(roleKey: string) {
    await expect(this.page.locator(`td:has-text("${roleKey}")`)).toHaveCount(0);
  }

  async assertPermissionsEditorVisible() {
    await expect(this.permissionsEditor).toBeVisible();
  }

  // ─── API Cleanup ──────────────────────────────────────────────────

  async deleteRolesViaApi(roleKeys: string[]) {
    try {
      await this.request.delete('/api/management/v1/roles', {
        data: roleKeys,
      });
    } catch {
      // roles may already be deleted
    }
  }
}
