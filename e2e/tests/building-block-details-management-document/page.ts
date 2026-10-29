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

import {type APIRequestContext, type Page, type Response, expect} from '@playwright/test';
import {BUILDING_BLOCK_MANAGEMENT_DETAIL_ACTIONS_TEST_IDS} from '../../constants';
import {SchemaEditor} from '../../shared/schema-editor/schema-editor.utils';
import {apiDelete, apiGet, apiPost, apiPut} from '../../utils/api.utils';

const BUILDING_BLOCK_API_URL = '/api/management/v1/building-block';

export interface BuildingBlockDefinition {
  key: string;
  name: string;
  versionTag: string;
  description: string;
  final: boolean;
}

export type DocumentSchema = Record<string, any>;

export class BuildingBlockDocumentPage {
  readonly schemaEditor: SchemaEditor;

  constructor(
    private readonly page: Page,
    private readonly request: APIRequestContext
  ) {
    this.schemaEditor = new SchemaEditor(page);
  }

  // ─── Navigation ───────────────────────────────────────────────────

  get versionDropdown() {
    return this.page.getByTestId(
      BUILDING_BLOCK_MANAGEMENT_DETAIL_ACTIONS_TEST_IDS.versionSelectDropdown
    );
  }

  documentUrl(key: string, versionTag: string) {
    return `/building-block-management/building-block/${key}/version/${versionTag}/document`;
  }

  /**
   * Navigate straight to the document tab. Each test re-navigates rather than
   * reusing editor state: the embedded JSON editor keeps its mode, search box and
   * unsaved buffer between interactions, and a reload is the only way to get a
   * predictable starting point.
   */
  async goToDocumentTab(key: string, versionTag: string) {
    await this.page.goto(this.documentUrl(key, versionTag));
    await this.page.waitForURL(new RegExp(`/version/${versionTag}/document$`));
    await expect(this.versionDropdown).toBeVisible();
    await this.schemaEditor.waitForLoaded();
  }

  // ─── Assertions ───────────────────────────────────────────────────

  /** Assert the tree view renders a property name. */
  async assertFieldVisible(fieldName: string) {
    await expect(this.schemaEditor.keys.filter({hasText: fieldName}).first()).toBeVisible();
    expect(await this.schemaEditor.keyTexts()).toContain(fieldName);
  }

  /** Assert the tree view renders a value — a field type or a description. */
  async assertValueVisible(value: string) {
    expect(await this.schemaEditor.valueTexts()).toContain(value);
  }

  async assertFieldTypesVisible(types: readonly string[]) {
    const values = await this.schemaEditor.valueTexts();
    for (const type of types) {
      expect(values, `field type "${type}" is not rendered`).toContain(type);
    }
  }

  async assertFieldDescriptionsVisible(descriptions: readonly string[]) {
    const values = await this.schemaEditor.valueTexts();
    for (const description of descriptions) {
      expect(values, `description "${description}" is not rendered`).toContain(description);
    }
  }

  // ─── Save ─────────────────────────────────────────────────────────

  /** Save the editor contents and wait for the document PUT to come back. */
  async saveDocument(key: string, versionTag: string): Promise<Response> {
    const [response] = await Promise.all([
      this.page.waitForResponse(
        res =>
          res.url().includes(`${BUILDING_BLOCK_API_URL}/${key}/version/${versionTag}/document`) &&
          res.request().method() === 'PUT'
      ),
      this.schemaEditor.save(),
    ]);
    return response;
  }

  // ─── API helpers ──────────────────────────────────────────────────

  async createBuildingBlockViaApi(definition: {
    key: string;
    name: string;
    versionTag: string;
    description: string;
  }): Promise<BuildingBlockDefinition> {
    return apiPost<BuildingBlockDefinition>(BUILDING_BLOCK_API_URL, definition);
  }

  async getDocumentSchemaViaApi(key: string, versionTag: string): Promise<DocumentSchema> {
    return apiGet<DocumentSchema>(
      `${BUILDING_BLOCK_API_URL}/${key}/version/${versionTag}/document`
    );
  }

  async setDocumentSchemaViaApi(
    key: string,
    versionTag: string,
    schema: DocumentSchema
  ): Promise<void> {
    await apiPut(`${BUILDING_BLOCK_API_URL}/${key}/version/${versionTag}/document`, schema);
  }

  async finalizeVersionViaApi(key: string, versionTag: string): Promise<void> {
    await apiPost(`${BUILDING_BLOCK_API_URL}/${key}/version/${versionTag}/finalize`, {});
  }

  /**
   * Best-effort cleanup of the building block created for this suite.
   *
   * The management API exposes no DELETE for building block definitions
   * (`BuildingBlockManagementResource` only serves GET/POST/PUT), so this call
   * fails and is swallowed — the building block stays behind. The helper is kept
   * so cleanup starts working as soon as the endpoint is added.
   */
  async deleteBuildingBlockViaApi(key: string, versionTag: string) {
    try {
      await apiDelete(`${BUILDING_BLOCK_API_URL}/${key}/version/${versionTag}`);
    } catch {
      // No DELETE endpoint yet — nothing to do.
    }
  }
}
