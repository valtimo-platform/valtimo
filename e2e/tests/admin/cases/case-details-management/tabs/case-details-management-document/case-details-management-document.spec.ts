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

import {expect, test} from '@playwright/test';
import {CaseDetailsManagementDocumentPage} from './page';

const CASE_IDENTIFIER = 'bezwaar';

test.use({storageState: undefined});

test.describe('Case details management — Document', () => {
  let context;
  let page;
  let documentPage: CaseDetailsManagementDocumentPage;
  let request;

  let draftVersion: string;
  let originalDefinition: Awaited<
    ReturnType<CaseDetailsManagementDocumentPage['fetchDocumentDefinition']>
  >;

  test.beforeAll(async ({browser, baseURL}) => {
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    request = context.request;

    documentPage = new CaseDetailsManagementDocumentPage(page, request);

    await page.goto('/');
    await documentPage.goToCaseManagement(CASE_IDENTIFIER);
    draftVersion = await documentPage.ensureDraftVersionSelected();
    await documentPage.switchToDocumentTab();
    originalDefinition = await documentPage.fetchDocumentDefinition(CASE_IDENTIFIER, draftVersion);
  });

  test.afterAll(async () => {
    // Restore of the original schema
    if (originalDefinition) {
      await documentPage.restoreDocumentDefinitionViaApi(
        CASE_IDENTIFIER,
        draftVersion,
        originalDefinition.schema
      );
    }
    await context.close();
  });

  // ─── 6.46 View JSON Schema ────────────────────────────────────────

  test.describe('6.46 — View JSON Schema', () => {
    test('Editor is visible on the Document tab', async () => {
      await documentPage.assertEditorVisible();
    });

    test('Editor shows the document definition schema content', async () => {
      const schemaTitle = originalDefinition.schema.title as string;
      expect(schemaTitle).toBeTruthy();
      await documentPage.assertEditorContainsSchemaTitle(schemaTitle);
    });

    test('Draft version shows the schema in view mode with edit action available', async () => {
      await documentPage.assertViewMode();
    });

    test.describe('Failure scenarios', () => {
      test('Final version hides the Edit button (schema is read-only)', async () => {
        // Act — switch to a final (non-draft) version
        await documentPage.ensureFinalVersionSelected();
        await documentPage.switchToDocumentTab();

        // Assert — editor is still visible, but the Edit action is hidden
        await documentPage.assertEditorVisible();
        await documentPage.assertEditButtonHidden();

        // Restore draft selection so subsequent tests run against a draft
        await documentPage.ensureDraftVersionSelected();
        await documentPage.switchToDocumentTab();
      });
    });
  });

  // ─── 6.47 Download JSON Schema ────────────────────────────────────

  test.describe('6.47 — Download JSON Schema', () => {
    test('Download button is enabled when the schema is loaded', async () => {
      await documentPage.assertDownloadButtonEnabled();
    });

    test('Download produces a JSON file that matches the current schema', async () => {
      // Act
      const download = await documentPage.triggerDownload();

      // Assert — filename format and file contents
      expect(download.suggestedFilename()).toBe(
        `${originalDefinition.id.blueprintId.blueprintKey}-v${originalDefinition.id.blueprintId.blueprintVersionTag}.json`
      );
      const downloaded = await documentPage.readDownloadedSchema(download);
      expect(downloaded).toEqual(originalDefinition.schema);
    });

    test('6.48, 6.49 — View → edit (remove field) → save → edit (restore) → save → download matches original', async () => {
      // Pick a removable property from the schema
      const properties = originalDefinition.schema.properties as Record<string, unknown> | undefined;
      expect(properties, 'bezwaar schema must expose a `properties` object').toBeTruthy();
      const propertyKey = Object.keys(properties ?? {})[0];
      expect(propertyKey, 'bezwaar schema must contain at least one property').toBeTruthy();

      // Build a trimmed schema without the chosen property
      const trimmedSchema = JSON.parse(JSON.stringify(originalDefinition.schema));
      delete trimmedSchema.properties[propertyKey];

      // Act 1 — edit in UI: remove the property and save
      await documentPage.saveSchema(CASE_IDENTIFIER, draftVersion, trimmedSchema);

      // Assert — API reflects the removal
      const afterRemoval = await documentPage.fetchDocumentDefinition(CASE_IDENTIFIER, draftVersion);
      expect(afterRemoval.schema.properties).not.toHaveProperty(propertyKey);

      // Act 2 — edit in UI: paste the original schema back and save
      await documentPage.saveSchema(CASE_IDENTIFIER, draftVersion, originalDefinition.schema);

      // Assert — API reflects the restore
      const afterRestore = await documentPage.fetchDocumentDefinition(CASE_IDENTIFIER, draftVersion);
      expect(afterRestore.schema).toEqual(originalDefinition.schema);

      // Act 3 — download the restored schema
      const download = await documentPage.triggerDownload();

      // Assert — download filename and contents match the original schema
      expect(download.suggestedFilename()).toBe(
        `${originalDefinition.id.blueprintId.blueprintKey}-v${originalDefinition.id.blueprintId.blueprintVersionTag}.json`
      );
      const downloaded = await documentPage.readDownloadedSchema(download);
      expect(downloaded).toEqual(originalDefinition.schema);
    });
  });
});
