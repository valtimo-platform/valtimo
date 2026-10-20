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

import {expect, Locator, Page, Response} from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import {apiDelete, apiGet, apiPost, apiPostMultipart, apiPut} from '../../utils/api.utils';
import {
  isProcessStartPermission,
  RESTRICTED_PROCESS_START_PERMISSIONS,
  WIDGET_PROCESS_ACCESS_CONFIG as CONFIG,
} from './widget-process-access-config';

interface RolePermission {
  resourceType: string;
  actions: string[];
}

export class WidgetProcessAccessPage {
  private originalPermissions: RolePermission[] | null = null;

  constructor(private readonly page: Page) {}

  // ─── API helpers ─────────────────────────────────────────────────

  /** Importing an already imported final version is skipped by the backend, so this is idempotent. */
  async importCaseDefinition() {
    const buffer = fs.readFileSync(
      path.resolve(__dirname, '../../assets/case-import-archives', CONFIG.archive)
    );
    await apiPostMultipart(CONFIG.importEndpoint, {
      file: {name: CONFIG.archive, mimeType: 'application/zip', buffer},
    });
  }

  async createCaseViaApi(status: string): Promise<string> {
    const response = await apiPost<{document: {id: string}}>(CONFIG.newCaseEndpoint, {
      processDefinitionKey: CONFIG.caseProcessKey,
      request: {
        definition: CONFIG.caseDefinitionKey,
        caseDefinitionKey: CONFIG.caseDefinitionKey,
        caseDefinitionVersionTag: CONFIG.caseDefinitionVersionTag,
        content: {status},
      },
    });
    return response.document.id;
  }

  /** Changes the case data; the case process then sets the internal status named in it. */
  async changeStatusViaApi(documentId: string, status: string) {
    await apiPost(CONFIG.modifyCaseEndpoint, {
      processDefinitionKey: CONFIG.caseProcessKey,
      request: {documentId, content: {status}},
    });
  }

  async deleteCaseViaApi(documentId: string) {
    try {
      await apiDelete(`${CONFIG.documentEndpoint}/${documentId}`);
    } catch {
      // Already deleted
    }
  }

  /** Replaces the role's rights to start processes with the issue's status-conditioned rule. */
  async restrictProcessStartRights() {
    const permissions = await apiGet<RolePermission[]>(
      CONFIG.rolePermissionsEndpoint(CONFIG.roleKey)
    );
    this.originalPermissions = permissions;
    await apiPut(CONFIG.rolePermissionsEndpoint(CONFIG.roleKey), [
      ...permissions.filter(permission => !isProcessStartPermission(permission)),
      ...RESTRICTED_PROCESS_START_PERMISSIONS,
    ]);
  }

  async restoreProcessStartRights() {
    if (this.originalPermissions) {
      await apiPut(CONFIG.rolePermissionsEndpoint(CONFIG.roleKey), this.originalPermissions);
      this.originalPermissions = null;
    }
  }

  // ─── Navigation ──────────────────────────────────────────────────

  /**
   * Opens the case on its widget tab and waits until both the Start menu and the widget have
   * received the case's startable items, so an absent button is a decision, not a page still loading.
   */
  async goToWidgetTab(documentId: string) {
    const startableItemsLoaded = this.waitForStartableItems(2);
    await this.page.goto(
      `/cases/${CONFIG.caseDefinitionKey}/document/${documentId}/${CONFIG.widgetTabKey}`
    );
    await expect(this.widget).toBeVisible({timeout: 15_000});
    await startableItemsLoaded;
  }

  waitForStartableItems(count: number): Promise<void> {
    return new Promise(resolve => {
      let seen = 0;
      const onResponse = (response: Response) => {
        if (response.url().includes(CONFIG.startableItemsEndpoint) && response.ok()) {
          seen++;
          if (seen >= count) {
            this.page.off('response', onResponse);
            resolve();
          }
        }
      };
      this.page.on('response', onResponse);
    });
  }

  // ─── Locators ────────────────────────────────────────────────────

  get widget(): Locator {
    return this.page.locator('valtimo-widget-field', {hasText: CONFIG.widgetTitle});
  }

  get widgetProcessButton(): Locator {
    return this.widget.getByRole('button', {name: CONFIG.widgetButtonName});
  }

  get startButton(): Locator {
    return this.page.locator('.case-actions button', {hasText: 'Start'}).first();
  }

  get startMenuItem(): Locator {
    return this.page.getByRole('menuitem', {name: CONFIG.supportingProcessName});
  }

  /** The supporting process's start dialog, which both Start and the widget button open. */
  get startDialogTitle(): Locator {
    return this.page.getByRole('dialog').getByText(CONFIG.supportingProcessName);
  }
}
