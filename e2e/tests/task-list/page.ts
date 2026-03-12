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

export class TaskListPage {
  constructor(private readonly page: Page) {}

  get caseDropdown() {
    return this.page.locator('[data-testid="task-list-case-dropdown"]');
  }

  get taskTable() {
    return this.page.locator('valtimo-carbon-list table');
  }

  get tabList() {
    return this.page.getByRole('tablist', {name: 'List of tabs'}).first();
  }

  async waitForTaskListLoaded() {
    await expect(this.taskTable).toBeVisible();
    await expect(this.tabList).toBeVisible();
  }

  async selectCaseFromDropdown(caseName: string) {
    await this.caseDropdown.click();
    await this.page.getByRole('option', {name: caseName}).click();
  }

  async assertTaskTableVisible() {
    await expect(this.taskTable).toBeVisible();
  }

  async assertTabsVisible() {
    await expect(this.tabList).toBeVisible();
  }
}
