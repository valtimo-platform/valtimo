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
import {ACCESS_CONTROL_EDITOR_TEST_IDS, ACCESS_CONTROL_ROLES_TEST_IDS} from '../../constants';
import * as ApiUtils from '../../utils/api.utils';
import {pasteToMonacoEditor} from '../../utils/monaco.utils';

/** A permission as returned by `GET /api/management/v1/roles/{key}/permissions`. */
export interface RolePermissionCondition {
  type: string;
  field: string;
  operator: string;
  value: string;
}

export interface RolePermission {
  resourceType: string;
  actions: string[];
  conditions: RolePermissionCondition[];
}

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

  // Direct navigation to the roles list — avoids relying on the Admin menu and shared history.
  async goToAccessControlList() {
    await this.page.goto('/access-control');
    await this.page.waitForSelector('valtimo-carbon-list');
  }

  async openRole(roleKey: string) {
    const list = new CarbonList(this.page);
    await list.row(roleKey).click();
  }

  // Role details opens on the "Summary" tab; the permissions editor is on "JSON editor".
  async openJsonEditorTab() {
    await this.page.getByRole('tab', {name: 'JSON editor'}).click();
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

  // Role metadata modal (shared by add and edit).
  // The key input is only rendered in manual mode — see openAddRoleModal().
  get roleNameInput() {
    return this.page.getByTestId(ACCESS_CONTROL_ROLES_TEST_IDS.metadataKeyInput);
  }

  /**
   * The add modal defaults to a "choose from list" v-select of existing role keys; the free
   * text input only appears after switching to manual mode. The same button switches back
   * ("Choose from list"), so only click it while it still offers manual entry. The edit modal
   * already opens in manual mode.
   */
  get manualEntryButton() {
    return this.page.locator('cds-modal').getByRole('button', {name: 'Enter manually'});
  }

  /** Primary button of the role metadata modal — reads "Create" when adding, "Save" when editing. */
  get roleMetadataConfirmButton() {
    return this.page.getByTestId(ACCESS_CONTROL_ROLES_TEST_IDS.metadataConfirmButton);
  }

  get createRoleButton() {
    return this.roleMetadataConfirmButton;
  }

  get cancelRoleButton() {
    return this.page.getByTestId(ACCESS_CONTROL_ROLES_TEST_IDS.metadataCancelButton);
  }

  get permissionsEditor() {
    return this.page.locator('valtimo-editor');
  }

  // ─── Actions ──────────────────────────────────────────────────────

  /** Opens the add-role modal and switches it to manual key entry. */
  async openAddRoleModal() {
    await this.addRoleButton.click();
    await expect(this.manualEntryButton).toBeVisible();
    await this.manualEntryButton.click();
    await expect(this.roleNameInput).toBeVisible();
  }

  async addRole(roleKey: string) {
    await this.openAddRoleModal();
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

  // ─── 11.6 Edit role metadata ──────────────────────────────────────

  /** Direct navigation to a role's detail page, where the metadata and export actions live. */
  async goToRoleDetail(roleKey: string) {
    await this.page.goto(`/access-control/${roleKey}`);
    await expect(this.roleDetailMoreMenuTrigger).toBeVisible();
  }

  /**
   * The page-header overflow menu ("more" menu). Scoped to the header button container: permission
   * cards in the editor tab each render their own overflow trigger too.
   */
  get roleDetailMoreMenuTrigger(): Locator {
    return this.page.locator('.buttons-container .v-overflow-menu__trigger');
  }

  get editMetadataMenuOption(): Locator {
    return this.page.getByTestId(ACCESS_CONTROL_ROLES_TEST_IDS.moreMenuEditMetadata);
  }

  async openRoleDetailMoreMenu() {
    await this.roleDetailMoreMenuTrigger.click();
    await expect(this.page.getByRole('menu')).toBeVisible();
  }

  /**
   * Renames a role via the detail page's "Edit metadata" modal. The modal opens in manual entry
   * mode, prefilled with the current key.
   */
  async editRoleMetadata(currentKey: string, newKey: string) {
    await this.goToRoleDetail(currentKey);
    await this.openRoleDetailMoreMenu();
    await expect(this.editMetadataMenuOption).toBeEnabled();
    await this.editMetadataMenuOption.click();

    await expect(this.roleNameInput).toHaveValue(currentKey);
    await this.roleNameInput.fill(newKey);

    await expect(this.roleMetadataConfirmButton).toBeEnabled();
    await Promise.all([
      this.page.waitForResponse(
        res =>
          res.url().includes(`/api/management/v1/roles/${currentKey}`) &&
          res.request().method() === 'PUT' &&
          res.ok()
      ),
      this.roleMetadataConfirmButton.click(),
    ]);

    // The detail route is keyed on the role name, so a rename navigates to the new URL.
    await this.page.waitForURL(`**/access-control/${newKey}`);
  }

  // ─── 11.7 Export role configuration ───────────────────────────────

  get exportRolesButton(): Locator {
    return this.page.getByTestId(ACCESS_CONTROL_ROLES_TEST_IDS.exportButton);
  }

  get exportSingleFileButton(): Locator {
    return this.page.getByTestId(ACCESS_CONTROL_ROLES_TEST_IDS.exportModalSingleFile);
  }

  get exportSeparateFilesButton(): Locator {
    return this.page.getByTestId(ACCESS_CONTROL_ROLES_TEST_IDS.exportModalSeparateFiles);
  }

  get exportConfirmButton(): Locator {
    return this.page.getByTestId(ACCESS_CONTROL_ROLES_TEST_IDS.exportModalConfirmButton);
  }

  /** Selects a role in the list and opens the export modal from the batch action bar. */
  async openExportModal(roleKey: string) {
    const list = new CarbonList(this.page);
    await list.row(roleKey).select();
    await expect(this.exportRolesButton).toBeVisible();
    await this.exportRolesButton.click();
    await expect(this.exportSingleFileButton).toBeVisible();
  }

  /**
   * Confirms the export as a single combined JSON file and returns the triggered download.
   * The export type must be chosen first — the confirm button stays disabled until then.
   */
  async exportSelectedRoleAsSingleFile() {
    await expect(this.exportConfirmButton).toBeDisabled();
    await this.exportSingleFileButton.click();
    await expect(this.exportConfirmButton).toBeEnabled();

    const [download] = await Promise.all([
      this.page.waitForEvent('download'),
      this.exportConfirmButton.click(),
    ]);
    return download;
  }

  // ─── 11.9–11.13 Permissions ───────────────────────────────────────

  /** Role detail tabs. "Editor" needs `exact` — "JSON editor" also contains it. */
  get editorTab() {
    return this.page.getByRole('tab', {name: 'Editor', exact: true});
  }

  get summaryTab() {
    return this.page.getByRole('tab', {name: 'Summary'});
  }

  get jsonEditorTab() {
    return this.page.getByRole('tab', {name: 'JSON editor'});
  }

  get monacoEditor() {
    return this.page.locator('.monaco-editor');
  }

  get savePermissionsButton() {
    return this.page.getByTestId(ACCESS_CONTROL_ROLES_TEST_IDS.saveButton);
  }

  get addPermissionButton() {
    return this.page.getByTestId(ACCESS_CONTROL_EDITOR_TEST_IDS.addPermissionButton);
  }

  get permissionCards() {
    return this.page.getByTestId(ACCESS_CONTROL_EDITOR_TEST_IDS.permissionCard);
  }

  get resourceTypeSelect() {
    return this.page.getByTestId(ACCESS_CONTROL_EDITOR_TEST_IDS.resourceTypeSelect);
  }

  get actionsGrid() {
    return this.page.getByTestId(ACCESS_CONTROL_EDITOR_TEST_IDS.actionsSelect);
  }

  get addConditionButton() {
    return this.page.getByTestId(ACCESS_CONTROL_EDITOR_TEST_IDS.addConditionButton);
  }

  get conditionFieldSelect() {
    return this.page.getByTestId(ACCESS_CONTROL_EDITOR_TEST_IDS.conditionFieldSelect);
  }

  get conditionOperatorSelect() {
    return this.page.getByTestId(ACCESS_CONTROL_EDITOR_TEST_IDS.conditionOperatorSelect);
  }

  get conditionValueInput() {
    return this.page.getByTestId(ACCESS_CONTROL_EDITOR_TEST_IDS.conditionValueInput);
  }

  /**
   * Expands one of a permission card's accordion sections. Only one section is open at a time,
   * so controls in the others are in the DOM but not visible.
   */
  async expandPermissionSection(section: 'sectionResourceActions' | 'sectionConditions') {
    await this.page.getByTestId(ACCESS_CONTROL_EDITOR_TEST_IDS[section]).getByRole('button').first().click();
  }

  /** Picks an option from a Carbon combo box. Options render in an overlay, so resolve page-wide. */
  private async selectComboBoxOption(comboBox: Locator, optionLabel: string) {
    await comboBox.click();
    await this.page.getByRole('option', {name: optionLabel, exact: true}).click();
  }

  async selectResourceType(resourceType: string) {
    await this.selectComboBoxOption(this.resourceTypeSelect, resourceType);
    // The available actions are derived from the resource type, so wait for them to render.
    await expect(this.actionsGrid.locator('cds-checkbox').first()).toBeVisible();
  }

  /**
   * Actions are a checkbox grid, not a dropdown. The label must match exactly: "View" is also a
   * substring of "View list", so a loose match ticks the wrong action.
   */
  private actionCheckbox(actionLabel: string): Locator {
    return this.actionsGrid.locator('cds-checkbox').filter({
      has: this.page.getByText(actionLabel, {exact: true}),
    });
  }

  async toggleAction(actionLabel: string) {
    await this.actionCheckbox(actionLabel).click();
  }

  async assertActionChecked(actionLabel: string) {
    await expect(this.actionCheckbox(actionLabel).locator('input[type="checkbox"]')).toBeChecked();
  }

  async addPermissionCondition(condition: {field: string; operator: string; value: string}) {
    await this.expandPermissionSection('sectionConditions');
    await expect(this.addConditionButton).toBeVisible();
    await this.addConditionButton.click();

    await this.selectComboBoxOption(this.conditionFieldSelect, condition.field);
    await this.selectComboBoxOption(this.conditionOperatorSelect, condition.operator);
    await this.conditionValueInput.fill(condition.value);
    await expect(this.conditionValueInput).toHaveValue(condition.value);
  }

  /** Replaces the whole permissions array through the JSON editor. */
  async setPermissionsJson(permissions: unknown[]) {
    await expect(this.monacoEditor.first()).toBeVisible();
    await pasteToMonacoEditor(this.page, JSON.stringify(permissions, null, 2));
  }

  async savePermissions(roleKey: string) {
    await expect(this.savePermissionsButton).toBeEnabled();
    await Promise.all([
      this.page.waitForResponse(
        res =>
          res.url().includes(`/api/management/v1/roles/${roleKey}/permissions`) &&
          res.request().method() === 'PUT' &&
          res.ok()
      ),
      this.savePermissionsButton.click(),
    ]);
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

  // ─── 11.9–11.13 API Helpers ───────────────────────────────────────

  async getRolePermissionsViaApi(roleKey: string): Promise<RolePermission[]> {
    return ApiUtils.apiGet<RolePermission[]>(`/api/management/v1/roles/${roleKey}/permissions`);
  }

  /** Polls until the saved permissions satisfy `predicate`. */
  async assertRolePermissions(
    roleKey: string,
    predicate: (permissions: RolePermission[]) => boolean,
    message: string
  ) {
    await expect
      .poll(async () => predicate(await this.getRolePermissionsViaApi(roleKey)), {message})
      .toBe(true);
  }

  async setRolePermissionsViaApi(roleKey: string, permissions: unknown[]) {
    try {
      await ApiUtils.apiPut(`/api/management/v1/roles/${roleKey}/permissions`, permissions);
    } catch {
      // best effort — used to reset state during teardown
    }
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
