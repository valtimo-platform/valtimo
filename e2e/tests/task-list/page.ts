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

import {expect, Page} from '@playwright/test';
import {CarbonList} from '../../shared/carbon-list/carbon-list.utils';

export class TaskListPage {
  constructor(private readonly page: Page) {}

  // ─── Task List Elements ────────────────────────────────────────────

  get caseDropdown() {
    return this.page.locator('[data-testid="task-list-case-dropdown"]');
  }

  get taskTable() {
    return this.page.locator('valtimo-carbon-list table');
  }

  get tabList() {
    return this.page.getByRole('tablist', {name: 'List of tabs'}).first();
  }

  get carbonList(): CarbonList {
    return new CarbonList(this.page);
  }

  // ─── Task Detail Elements ──────────────────────────────────────────

  get taskDetailDialog() {
    return this.page.getByRole('dialog');
  }

  get assignmentPill() {
    return this.page.locator('.assignment-pill').first();
  }

  // ─── Navigation & Waiting ──────────────────────────────────────────

  async waitForTaskListLoaded() {
    await this.carbonList.waitForLoaded();
    await expect(this.tabList).toBeVisible();
  }

  async selectCaseFromDropdown(caseName: string) {
    await this.caseDropdown.click();
    await this.page.getByRole('option', {name: caseName}).first().click();
  }

  async selectTab(tabName: string) {
    await this.page.getByRole('tab', {name: tabName}).click();
    await this.carbonList.waitForLoaded();
  }

  // ─── Task Detail Actions ───────────────────────────────────────────

  async openTaskByName(taskName: string) {
    const row = this.page
      .locator('valtimo-carbon-list tbody tr')
      .filter({has: this.page.getByRole('cell', {name: taskName, exact: true})})
      .first();
    await row.click();
    await expect(this.taskDetailDialog.getByText(taskName)).toBeVisible({timeout: 10_000});
  }

  async assertTaskDetailVisible(expectedTitle: string) {
    await expect(this.taskDetailDialog.getByText(expectedTitle)).toBeVisible();
  }

  async closeTaskDetailModal() {
    await this.taskDetailDialog.getByRole('button', {name: 'Close modal'}).click();
    await this.page.waitForTimeout(1_000);
  }

  async claimTask() {
    const assignButton = this.page.getByText('Assign this task');
    if (!(await assignButton.isVisible().catch(() => false))) {
      return;
    }
    await assignButton.click();
    await this.page.getByRole('combobox', {name: 'Select user'}).click();
    await this.page.getByRole('listbox').getByRole('option').first().click();
    // The assignment dialog requires both a user and a team — Confirm stays
    // disabled until both are picked.
    await this.page.getByRole('combobox', {name: 'Select team'}).click();
    await this.page.getByRole('listbox').getByRole('option').first().click();
    await this.page.getByRole('button', {name: 'Confirm', exact: true}).click();
  }

  async assertTaskAssigned() {
    await expect(this.assignmentPill).toBeVisible({timeout: 10_000});
  }

  async submitEmptyForm() {
    const submitButton = this.taskDetailDialog.getByRole('button', {name: 'Submit'});
    await expect(submitButton).toBeVisible({timeout: 10_000});
    await submitButton.click();
    // Wait for the modal to close after submission
    await expect(this.taskDetailDialog).not.toBeVisible({timeout: 15_000});
  }

  async assertTaskCompletedNotification(taskName: string) {
    // Toast notification shows "{taskName} has successfully been completed"
    await expect(this.page.getByText(`${taskName} has successfully been completed`).first()).toBeVisible({
      timeout: 15_000,
    });
  }

  // ─── Assertions ────────────────────────────────────────────────────

  async assertTaskTableVisible() {
    await expect(this.taskTable).toBeVisible();
  }

  async assertTabsVisible() {
    await expect(this.tabList).toBeVisible();
  }
}
