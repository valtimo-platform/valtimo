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
import {CarbonList} from '../../shared/carbon-list/carbon-list.utils';
import {apiDelete, apiPost} from '../../utils/api.utils';
import {USER_CASES_CONFIG} from './user-cases-config';

export interface CreatedCase {
  documentId: string;
  processInstanceId: string;
  sequence: number;
}

export class UserCasesPage {
  constructor(private readonly page: Page) {}

  // ─── API helpers ─────────────────────────────────────────────────

  async createCaseViaApi(): Promise<CreatedCase> {
    const response = await apiPost<{
      document: {id: string; sequence: number};
      processInstanceId: string;
    }>(USER_CASES_CONFIG.processDocumentEndpoint, {
      processDefinitionKey: USER_CASES_CONFIG.processDefinitionKey,
      request: {
        definition: USER_CASES_CONFIG.caseDefinitionKey,
        caseDefinitionKey: USER_CASES_CONFIG.caseDefinitionKey,
        caseDefinitionVersionTag: USER_CASES_CONFIG.caseDefinitionVersionTag,
        content: {},
      },
    });
    return {
      documentId: response.document.id,
      processInstanceId: response.processInstanceId,
      sequence: response.document.sequence,
    };
  }

  async deleteCaseViaApi(documentId: string) {
    try {
      await apiDelete(`${USER_CASES_CONFIG.documentEndpoint}/${documentId}`);
    } catch {
      // Already deleted or permission denied — ignore in cleanup
    }
  }

  // ─── Navigation ──────────────────────────────────────────────────

  async goToCaseList() {
    await this.page.goto(`/cases/${USER_CASES_CONFIG.caseDefinitionKey}`);
    await this.caseList.waitForLoaded();
  }

  async selectCaseListTab(tabName: 'All cases' | 'My cases' | 'Unassigned cases' | 'Team cases') {
    await this.page.getByRole('tab', {name: tabName, exact: true}).click();
    await this.caseList.waitForLoaded();
  }

  async goToCaseDetail(documentId: string) {
    await this.page.goto(
      `/cases/${USER_CASES_CONFIG.caseDefinitionKey}/document/${documentId}/summary`
    );
    await expect(this.detailTabList).toBeVisible({timeout: 15_000});
  }

  // ─── Case list locators ──────────────────────────────────────────

  get caseList(): CarbonList {
    return new CarbonList(this.page);
  }

  // ─── Case detail locators ────────────────────────────────────────

  get detailTabList(): Locator {
    return this.page.locator('cds-tabs.case-detail-tabs');
  }

  detailTab(name: string): Locator {
    return this.detailTabList.getByRole('tab', {name, exact: true});
  }

  get tabContentContainer(): Locator {
    return this.page.locator('.tab-content-container');
  }

  get progressTabContent(): Locator {
    return this.page.locator('valtimo-case-detail-tab-progress');
  }

  get progressProcessDropdown(): Locator {
    return this.progressTabContent.locator('cds-dropdown').first();
  }

  get progressBpmnSvg(): Locator {
    return this.progressTabContent.locator('svg.djs-container').or(
      this.progressTabContent.locator('.process-history svg')
    );
  }

  get documentsTabContainer(): Locator {
    return this.page.locator(
      'valtimo-case-detail-tab-documents, valtimo-case-detail-tab-s3-documents, valtimo-case-detail-tab-documenten-api-documents'
    );
  }

  // ─── Task list (right panel) ─────────────────────────────────────

  get taskListPanel(): Locator {
    return this.page.locator('valtimo-case-detail-task-list');
  }

  taskTileByName(taskName: string): Locator {
    return this.taskListPanel
      .locator('cds-clickable-tile')
      .filter({has: this.page.locator(`span.task__title:has-text("${taskName}")`)})
      .first();
  }

  get noTasksMessage(): Locator {
    return this.taskListPanel.getByText('All tasks have been completed');
  }

  // ─── "Start" overflow button in the page header ──────────────────

  get startCaseProcessButton(): Locator {
    return this.page.locator('.case-actions button', {hasText: 'Start'}).first();
  }

  startableMenuItem(displayName: string): Locator {
    return this.page.getByRole('menuitem', {name: displayName});
  }

  // ─── Task detail modal ───────────────────────────────────────────

  get taskDetailDialog(): Locator {
    return this.page.getByRole('dialog');
  }

  get formStartButton(): Locator {
    return this.taskDetailDialog.getByRole('button', {name: 'Start', exact: true});
  }

  // ─── Actions ─────────────────────────────────────────────────────

  async openStartProcessMenu() {
    await this.startCaseProcessButton.click();
  }

  async startSubProcess(displayName: string) {
    await this.openStartProcessMenu();
    const item = this.startableMenuItem(displayName);
    await expect(item).toBeVisible();
    await item.click();
  }

  async assignTaskToSelf() {
    await expect(this.page.getByText('Assign this task')).toBeVisible({timeout: 15_000});
    await this.page.getByText('Assign this task').click();
    await this.page.getByRole('combobox', {name: 'Select user'}).click();
    await this.page.getByRole('listbox').getByText('(me)').first().click();
    await this.page.getByRole('combobox', {name: 'Select team'}).click();
    await this.page.getByRole('listbox').getByRole('option').first().click();
    await this.page.getByRole('button', {name: 'Confirm', exact: true}).click();
    await expect(this.page.getByRole('heading', {name: 'Task assigned'})).toBeVisible({
      timeout: 15_000,
    });
  }

  async submitFormStart() {
    await this.formStartButton.click();
  }
}
