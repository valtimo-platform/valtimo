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

import {expect, Locator, Page} from '@playwright/test';
import {
  CASE_DEFINITION_GROUP_CONFIG_TEST_IDS,
  CASE_DEFINITION_GROUP_DETAIL_TEST_IDS,
  CASE_DEFINITION_GROUP_LIST_TEST_IDS,
  CASE_DEFINITION_GROUP_MODAL_TEST_IDS,
  CASE_MANAGEMENT_LIST_TEST_IDS,
} from '../../constants';
import {CarbonList} from '../../shared/carbon-list/carbon-list.utils';
import {ColorPanel} from '../../shared/color-panel/color-panel.utils';
import {fillStable} from '../../utils/ui.utils';
import {CaseGroup, GROUP_MANAGEMENT_ENDPOINT} from '../../utils/case-group.utils';

export type GroupDetailTab = 'Config' | 'List columns' | 'Search fields';

export class CaseManagementGroupsPage {
  readonly colorPanel: ColorPanel;

  constructor(private readonly page: Page) {
    this.colorPanel = new ColorPanel(page);
  }

  // ─── Navigation ───────────────────────────────────────────────────

  async goToGroupsTab() {
    await this.page.goto('/case-management?tab=groups');
    await expect(this.caseGroupsTabPanel).toBeVisible();
    await this.groupsList.waitForLoaded();
  }

  async goToGroup(groupKey: string, tab = 'config') {
    await this.page.goto(`/case-management/group/${groupKey}/${tab}`);
    await expect(this.detailTabs).toBeVisible();
  }

  // ─── List page ────────────────────────────────────────────────────

  get listTabs(): Locator {
    return this.page.getByTestId(CASE_MANAGEMENT_LIST_TEST_IDS.tabs);
  }

  listTab(name: 'Cases' | 'Case groups'): Locator {
    return this.listTabs.getByRole('tab', {name, exact: true});
  }

  get caseGroupsTabPanel(): Locator {
    return this.page.getByTestId(CASE_MANAGEMENT_LIST_TEST_IDS.caseGroupsTabPanel);
  }

  get casesTabPanel(): Locator {
    return this.page.getByTestId(CASE_MANAGEMENT_LIST_TEST_IDS.casesTabPanel);
  }

  get groupsList(): CarbonList {
    return new CarbonList(this.page, this.caseGroupsTabPanel);
  }

  groupRow(cellText: string): Locator {
    return this.groupsList.rows.filter({hasText: cellText});
  }

  // Toolbar and the empty state both render the button; the toolbar one is always there
  get createGroupButton(): Locator {
    return this.groupsList.toolbar.getByTestId(CASE_DEFINITION_GROUP_LIST_TEST_IDS.createButton);
  }

  // ─── Create / edit modal ──────────────────────────────────────────

  get modal(): Locator {
    return this.page.getByTestId(CASE_DEFINITION_GROUP_MODAL_TEST_IDS.modal);
  }

  get modalTitleInput(): Locator {
    return this.modal.getByTestId(CASE_DEFINITION_GROUP_MODAL_TEST_IDS.titleInput);
  }

  get modalDescriptionInput(): Locator {
    return this.modal.getByTestId(CASE_DEFINITION_GROUP_MODAL_TEST_IDS.descriptionInput);
  }

  get modalSubmitButton(): Locator {
    return this.modal.getByTestId(CASE_DEFINITION_GROUP_MODAL_TEST_IDS.submitButton);
  }

  get modalCancelButton(): Locator {
    return this.modal.getByTestId(CASE_DEFINITION_GROUP_MODAL_TEST_IDS.cancelButton);
  }

  async openCreateModal() {
    await this.createGroupButton.click();
    await expect(this.modalTitleInput).toBeVisible();
  }

  async fillModal(title: string, description?: string) {
    await fillStable(this.modalTitleInput, title);
    if (description !== undefined) await fillStable(this.modalDescriptionInput, description);
  }

  /** Submits the create modal and returns the group the backend created. */
  async submitCreateModal(): Promise<CaseGroup> {
    const [response] = await Promise.all([
      this.page.waitForResponse(
        res =>
          res.request().method() === 'POST' &&
          new URL(res.url()).pathname === GROUP_MANAGEMENT_ENDPOINT
      ),
      this.modalSubmitButton.click(),
    ]);
    expect(response.ok()).toBeTruthy();
    await expect(this.modal).toBeHidden();
    return (await response.json()) as CaseGroup;
  }

  /** Submits the edit modal and returns the request body that was sent. */
  async submitEditModal(groupKey: string): Promise<Record<string, unknown>> {
    const [response] = await Promise.all([
      this.page.waitForResponse(
        res =>
          res.request().method() === 'PUT' &&
          new URL(res.url()).pathname === `${GROUP_MANAGEMENT_ENDPOINT}/${groupKey}`
      ),
      this.modalSubmitButton.click(),
    ]);
    expect(response.ok()).toBeTruthy();
    await expect(this.modal).toBeHidden();
    return response.request().postDataJSON();
  }

  // ─── Detail page ──────────────────────────────────────────────────

  get heading(): Locator {
    return this.page.getByRole('heading', {level: 2});
  }

  get breadcrumb(): Locator {
    return this.page.getByRole('navigation', {name: 'Breadcrumb'});
  }

  get editButton(): Locator {
    return this.page.getByTestId(CASE_DEFINITION_GROUP_DETAIL_TEST_IDS.editButton);
  }

  get detailTabs(): Locator {
    return this.page.getByTestId(CASE_DEFINITION_GROUP_DETAIL_TEST_IDS.tabs);
  }

  detailTab(name: GroupDetailTab): Locator {
    return this.detailTabs.getByRole('tab', {name, exact: true});
  }

  // ─── Config tab: members ──────────────────────────────────────────

  get memberSearchInput(): Locator {
    return this.page
      .getByTestId(CASE_DEFINITION_GROUP_CONFIG_TEST_IDS.memberSearch)
      .locator('input');
  }

  get addCaseButton(): Locator {
    return this.page.getByTestId(CASE_DEFINITION_GROUP_CONFIG_TEST_IDS.addCaseButton);
  }

  get addPanel(): Locator {
    return this.page.getByTestId(CASE_DEFINITION_GROUP_CONFIG_TEST_IDS.addPanel);
  }

  get caseSelect(): Locator {
    return this.page.getByTestId(CASE_DEFINITION_GROUP_CONFIG_TEST_IDS.caseSelect);
  }

  get caseSelectInput(): Locator {
    return this.caseSelect.getByRole('combobox');
  }

  get addToGroupButton(): Locator {
    return this.page.getByTestId(CASE_DEFINITION_GROUP_CONFIG_TEST_IDS.addToGroupButton);
  }

  get memberRows(): Locator {
    return this.page.getByTestId(CASE_DEFINITION_GROUP_CONFIG_TEST_IDS.memberRow);
  }

  memberRow(caseDefinitionKey: string): Locator {
    return this.memberRows.filter({hasText: caseDefinitionKey});
  }

  get memberCount(): Locator {
    return this.page.getByTestId(CASE_DEFINITION_GROUP_CONFIG_TEST_IDS.memberCount);
  }

  get noMembers(): Locator {
    return this.page.getByTestId(CASE_DEFINITION_GROUP_CONFIG_TEST_IDS.noMembers);
  }

  get noMemberSearchResults(): Locator {
    return this.page.getByTestId(CASE_DEFINITION_GROUP_CONFIG_TEST_IDS.noSearchResults);
  }

  async openAddPanel() {
    if (!(await this.addPanel.isVisible())) await this.addCaseButton.click();
    await expect(this.addPanel).toBeVisible();
  }

  async selectCaseToAdd(caseName: string) {
    await this.openAddPanel();
    const option = this.page.getByRole('option', {name: caseName, exact: true});
    await expect(async () => {
      await this.caseSelectInput.click();
      await this.caseSelectInput.fill(caseName);
      await option.click({timeout: 3_000});
      await expect(this.addToGroupButton).toBeEnabled({timeout: 2_000});
    }).toPass({timeout: 20_000});
  }

  async availableCaseOptions(): Promise<string[]> {
    await this.openAddPanel();
    await this.caseSelectInput.click();
    const options = this.page.getByRole('option');
    await expect(options.first()).toBeVisible();
    const names = (await options.allInnerTexts()).map(name => name.trim());
    await this.page.keyboard.press('Escape');
    return names;
  }

  async addMember(caseName: string, groupKey: string) {
    await this.selectCaseToAdd(caseName);
    const [response] = await Promise.all([
      this.page.waitForResponse(
        res =>
          res.request().method() === 'POST' &&
          new URL(res.url()).pathname === `${GROUP_MANAGEMENT_ENDPOINT}/${groupKey}/member`
      ),
      this.addToGroupButton.click(),
    ]);
    expect(response.ok()).toBeTruthy();
  }

  async removeMember(caseDefinitionKey: string, groupKey: string) {
    const row = this.memberRow(caseDefinitionKey);
    await row.getByTestId(CASE_DEFINITION_GROUP_CONFIG_TEST_IDS.memberOverflowMenu).click();
    const [response] = await Promise.all([
      this.page.waitForResponse(
        res =>
          res.request().method() === 'DELETE' &&
          new URL(res.url()).pathname ===
            `${GROUP_MANAGEMENT_ENDPOINT}/${groupKey}/member/${caseDefinitionKey}`
      ),
      this.page.getByTestId(CASE_DEFINITION_GROUP_CONFIG_TEST_IDS.removeMemberOption).click(),
    ]);
    expect(response.ok()).toBeTruthy();
  }

  // ─── Config tab: color ────────────────────────────────────────────

  async pickSwatch(hex: string, groupKey: string): Promise<Record<string, unknown>> {
    const [response] = await Promise.all([
      this.page.waitForResponse(
        res =>
          res.request().method() === 'PUT' &&
          new URL(res.url()).pathname === `${GROUP_MANAGEMENT_ENDPOINT}/${groupKey}`
      ),
      this.colorPanel.swatch(hex).click(),
    ]);
    expect(response.ok()).toBeTruthy();
    return response.request().postDataJSON();
  }
}
