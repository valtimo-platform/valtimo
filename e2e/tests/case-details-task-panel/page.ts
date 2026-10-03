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
import {apiDelete, apiPost} from '../../utils/api.utils';

export const TASK_PANEL_CONFIG = {
  /** Case definition whose root process creates user tasks without needing the ZGW stack. */
  caseDefinitionKey: 'auto-assign-test',
  caseDefinitionVersionTag: '1.0.0',
  processDocumentEndpoint: '/api/v1/process-document/operation/new-document-and-start-process',
  documentEndpoint: '/api/v1/document',
} as const;

export class CaseTaskPanelPage {
  constructor(private readonly page: Page) {}

  async createCaseViaApi(): Promise<string> {
    const response = await apiPost<{document: {id: string}}>(
      TASK_PANEL_CONFIG.processDocumentEndpoint,
      {
        processDefinitionKey: TASK_PANEL_CONFIG.caseDefinitionKey,
        request: {
          definition: TASK_PANEL_CONFIG.caseDefinitionKey,
          caseDefinitionKey: TASK_PANEL_CONFIG.caseDefinitionKey,
          caseDefinitionVersionTag: TASK_PANEL_CONFIG.caseDefinitionVersionTag,
          content: {},
        },
      }
    );
    return response.document.id;
  }

  async deleteCaseViaApi(documentId: string) {
    try {
      await apiDelete(`${TASK_PANEL_CONFIG.documentEndpoint}/${documentId}`);
    } catch {
      // Already deleted or permission denied
    }
  }

  async goToCaseDetail(documentId: string) {
    await this.page.goto(
      `/cases/${TASK_PANEL_CONFIG.caseDefinitionKey}/document/${documentId}/summary`
    );
    await expect(this.taskTiles.first()).toBeVisible({timeout: 30_000});
  }

  get taskListPanel(): Locator {
    return this.page.locator('valtimo-case-detail-task-list');
  }

  get taskTiles(): Locator {
    return this.taskListPanel.locator('cds-clickable-tile');
  }

  panelHeadings(name: string): Locator {
    return this.taskListPanel.getByRole('heading', {name, exact: true});
  }

  async fontSize(locator: Locator): Promise<string> {
    return locator.evaluate(element => getComputedStyle(element).fontSize);
  }
}
