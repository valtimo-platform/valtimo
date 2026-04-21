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

import {APIRequestContext, Download, expect, Page} from '@playwright/test';
import {
  CASE_MANAGEMENT_DOCUMENT_TEST_IDS,
  JSON_EDITOR_TEST_IDS,
} from '../../constants';
import {endpoints} from '../../api/endpoints';
import {apiGet, apiPut} from '../../utils/api.utils';
import {
  ensureDraftVersionSelected,
  ensureFinalVersionSelected,
} from '../../utils/version.utils';
import {JsonEditor} from '../../shared/json-editor/json-editor.utils';
import {waitForResponse} from '../../components/request';

interface BlueprintId {
  blueprintKey: string;
  blueprintType: 'CASE' | 'BUILDING_BLOCK';
  blueprintVersionTag: string;
}

interface DocumentDefinition {
  id: {
    name: string;
    blueprintId: BlueprintId;
  };
  schema: Record<string, any>;
  createdOn: string;
  readOnly: boolean;
}

export class CaseDetailsManagementDocumentPage {
  readonly jsonEditor: JsonEditor;

  constructor(
    private readonly page: Page,
    private readonly request: APIRequestContext
  ) {
    this.jsonEditor = new JsonEditor(page);
  }

  // ─── Navigation ───────────────────────────────────────────────────

  async goToCaseManagement(caseIdentifier: string) {
    await this.page.getByRole('button', {name: 'Admin'}).click();
    await this.page.getByRole('link', {name: 'Cases'}).click();
    await this.page.waitForSelector('valtimo-carbon-list');
    await this.page.locator(`tr:has(td:has-text("${caseIdentifier}"))`).click();
  }

  async switchToDocumentTab() {
    await this.page.getByRole('tab', {name: 'Document'}).click();
    await expect(this.editor).toBeVisible();
  }

  async ensureDraftVersionSelected(): Promise<string> {
    return ensureDraftVersionSelected(this.page);
  }

  async ensureFinalVersionSelected(): Promise<string> {
    return ensureFinalVersionSelected(this.page);
  }

  // ─── UI Elements ──────────────────────────────────────────────────

  get editor() {
    return this.page.locator('valtimo-editor');
  }

  get monacoEditor() {
    return this.page.locator('.monaco-editor').first();
  }

  get editButton() {
    return this.page.getByTestId(JSON_EDITOR_TEST_IDS.editButton);
  }

  get saveButton() {
    return this.page.getByTestId(JSON_EDITOR_TEST_IDS.saveButton);
  }

  get cancelButton() {
    return this.page.getByTestId(JSON_EDITOR_TEST_IDS.cancelButton);
  }

  get downloadButton() {
    return this.page.getByTestId(CASE_MANAGEMENT_DOCUMENT_TEST_IDS.downloadButton);
  }

  // ─── API ──────────────────────────────────────────────────────────

  async fetchDocumentDefinition(
    caseDefinitionKey: string,
    versionTag: string
  ): Promise<DocumentDefinition> {
    return apiGet<DocumentDefinition>(
      endpoints.caseDefinition.documentDefinition(caseDefinitionKey, versionTag)
    );
  }

  async restoreDocumentDefinitionViaApi(
    caseDefinitionKey: string,
    versionTag: string,
    schema: Record<string, any>
  ) {
    try {
      await apiPut(
        endpoints.caseDefinition.documentDefinition(caseDefinitionKey, versionTag),
        {definition: JSON.stringify(schema)}
      );
    } catch {
      // Best-effort restore; swallow errors so afterAll can finish cleanly.
    }
  }

  // ─── Edit / Save ──────────────────────────────────────────────────

  async saveSchema(
    caseDefinitionKey: string,
    versionTag: string,
    schema: Record<string, any>
  ) {
    const url = endpoints.caseDefinition.documentDefinition(caseDefinitionKey, versionTag);
    const [response] = await Promise.all([
      waitForResponse(this.page, 'PUT', url),
      this.jsonEditor.saveChanges(schema),
    ]);
    return response;
  }

  // ─── Download ─────────────────────────────────────────────────────

  async triggerDownload(): Promise<Download> {
    const [download] = await Promise.all([
      this.page.waitForEvent('download'),
      this.downloadButton.click(),
    ]);
    return download;
  }

  async readDownloadedSchema(download: Download): Promise<Record<string, any>> {
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    const content = Buffer.concat(chunks).toString('utf-8');
    return JSON.parse(content);
  }

  // ─── Assertions ───────────────────────────────────────────────────

  async assertEditorVisible() {
    await expect(this.editor).toBeVisible();
    await expect(this.monacoEditor).toBeVisible();
  }

  async assertEditorContainsSchemaTitle(expectedTitle: string) {
    await expect(this.monacoEditor).toContainText(expectedTitle);
  }

  async assertViewMode() {
    await expect(this.editButton).toBeVisible();
    await expect(this.saveButton).toHaveCount(0);
    await expect(this.cancelButton).toHaveCount(0);
  }

  async assertEditButtonHidden() {
    await expect(this.editButton).toHaveCount(0);
  }

  async assertDownloadButtonEnabled() {
    await expect(this.downloadButton).toBeVisible();
    await expect(this.downloadButton).toBeEnabled();
  }
}
