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
import {generateId} from '../../utils/dataGenerator';
import {
  DOCUMENT_TEXTS,
  EDITED_FIELD,
  INVALID_SCHEMA_TEXT,
  SEARCH_TERMS,
  SEED_FIELDS,
  SEED_FIELD_TYPES,
  TEST_BUILDING_BLOCK,
  buildEditedSchema,
  buildSeedSchema,
} from './building-block-document-config';
import {BuildingBlockDocumentPage} from './page';

test.use({storageState: undefined});

test.describe('Building block management — document tab', () => {
  let context;
  let page;
  let request;
  let documentPage: BuildingBlockDocumentPage;

  const uniqueId = generateId();
  const buildingBlockKey = `${TEST_BUILDING_BLOCK.keyPrefix}-${uniqueId}`;
  const buildingBlockName = `${TEST_BUILDING_BLOCK.namePrefix} ${uniqueId}`;
  const versionTag = TEST_BUILDING_BLOCK.versionTag;
  const seedSchema = buildSeedSchema(buildingBlockKey);

  test.beforeAll(async ({browser, baseURL}) => {
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    request = context.request;

    documentPage = new BuildingBlockDocumentPage(page, request);

    await documentPage.createBuildingBlockViaApi({
      key: buildingBlockKey,
      name: buildingBlockName,
      versionTag,
      description: TEST_BUILDING_BLOCK.description,
    });

    await page.goto('/');
  });

  /**
   * Reset the schema before every test. Several tests save changes — one replaces
   * the document wholesale — and the embedded JSON editor also keeps an unsaved
   * buffer, so each test needs the seeded schema back to be independent of the
   * order it runs in.
   */
  test.beforeEach(async () => {
    await documentPage.setDocumentSchemaViaApi(buildingBlockKey, versionTag, seedSchema);
  });

  test.afterAll(async () => {
    // The building block cannot be removed: the management API has no DELETE for
    // building block definitions (see `deleteBuildingBlockViaApi`). It stays
    // behind until that endpoint exists.
    await documentPage.deleteBuildingBlockViaApi(buildingBlockKey, versionTag);

    await context.close();
  });

  test.describe('13.23, 13.26, 13.27 — View the document structure', () => {
    test('13.23 — Document tab renders the schema and all of its fields', async () => {
      await documentPage.goToDocumentTab(buildingBlockKey, versionTag);

      await documentPage.assertValueVisible(`${buildingBlockKey}.schema`);

      for (const field of Object.values(SEED_FIELDS)) {
        await documentPage.assertFieldVisible(field.name);
      }
    });

    test('13.26 — Field types are shown for every field', async () => {
      await documentPage.goToDocumentTab(buildingBlockKey, versionTag);

      await documentPage.assertFieldTypesVisible(SEED_FIELD_TYPES);
    });

    test('13.27 — Field descriptions are shown for every field', async () => {
      await documentPage.goToDocumentTab(buildingBlockKey, versionTag);

      await documentPage.assertFieldDescriptionsVisible(
        Object.values(SEED_FIELDS).map(field => field.description)
      );
    });
  });

  test.describe('13.28 — Search and filter document fields', () => {
    test('13.28 — Searching a field name highlights its matches', async () => {
      await documentPage.goToDocumentTab(buildingBlockKey, versionTag);
      const editor = documentPage.schemaEditor;

      await editor.openSearch();

      // A field that occurs once in the schema.
      await editor.search(SEARCH_TERMS.singleMatch);
      await expect(editor.searchHighlights).toHaveCount(1);
      expect(await editor.searchResultCount()).toBe(SEARCH_TERMS.singleMatchCount);

      // A term that occurs in a field name and in a description.
      await editor.search(SEARCH_TERMS.multipleMatches);
      await expect(editor.searchHighlights).toHaveCount(2);
      expect(await editor.searchResultCount()).toBe(SEARCH_TERMS.multipleMatchesCount);

      await editor.closeSearch();
    });

    test.describe('Failure scenarios', () => {
      test('Searching a term that does not occur reports no matches', async () => {
        await documentPage.goToDocumentTab(buildingBlockKey, versionTag);
        const editor = documentPage.schemaEditor;

        await editor.openSearch();
        await editor.search(SEARCH_TERMS.noMatch);

        await expect(editor.searchHighlights).toHaveCount(0);
        expect(await editor.searchResultCount()).toBe(SEARCH_TERMS.noMatchCount);

        await editor.closeSearch();
      });
    });
  });

  test.describe('13.25, 13.29 — Manage required fields', () => {
    test('13.25 — Required fields panel groups checkboxes per object level', async () => {
      await documentPage.goToDocumentTab(buildingBlockKey, versionTag);
      const editor = documentPage.schemaEditor;

      await editor.openRequiredFieldsPanel();

      await expect(editor.requiredFieldsPanel).toContainText(
        DOCUMENT_TEXTS.requiredFieldsPanelTitle
      );
      // Root properties and the nested object each get their own group.
      await expect(editor.requiredFieldsPanel).toContainText(DOCUMENT_TEXTS.rootObjectLevel);
      await expect(editor.requiredFieldsPanel).toContainText(SEED_FIELDS.address.name);

      // The checkboxes reflect the `required` list of the seeded schema.
      await editor.assertRequiredFieldChecked(SEED_FIELDS.applicantName.name);
      await editor.assertRequiredFieldNotChecked(SEED_FIELDS.applicantAge.name);
      await editor.assertRequiredFieldNotChecked(SEED_FIELDS.address.name, SEED_FIELDS.street.name);
    });

    test('13.25, 13.29 — Marking a field required is saved to the document', async () => {
      await documentPage.goToDocumentTab(buildingBlockKey, versionTag);
      const editor = documentPage.schemaEditor;

      await editor.openRequiredFieldsPanel();
      await editor.toggleRequiredField(SEED_FIELDS.applicantAge.name);

      await editor.assertRequiredFieldChecked(SEED_FIELDS.applicantAge.name);

      const response = await documentPage.saveDocument(buildingBlockKey, versionTag);
      expect(response.status()).toBe(200);

      const stored = await documentPage.getDocumentSchemaViaApi(buildingBlockKey, versionTag);
      expect(stored.required).toEqual(
        expect.arrayContaining([SEED_FIELDS.applicantName.name, SEED_FIELDS.applicantAge.name])
      );
    });

    test('13.25, 13.29 — Unmarking a field required is saved to the document', async () => {
      await documentPage.goToDocumentTab(buildingBlockKey, versionTag);
      const editor = documentPage.schemaEditor;

      await editor.openRequiredFieldsPanel();
      await editor.toggleRequiredField(SEED_FIELDS.applicantName.name);

      await editor.assertRequiredFieldNotChecked(SEED_FIELDS.applicantName.name);

      const response = await documentPage.saveDocument(buildingBlockKey, versionTag);
      expect(response.status()).toBe(200);

      const stored = await documentPage.getDocumentSchemaViaApi(buildingBlockKey, versionTag);
      expect(stored.required ?? []).not.toContain(SEED_FIELDS.applicantName.name);
    });
  });

  test.describe('13.24, 13.29 — Edit and save the document structure', () => {
    test('13.24, 13.29 — Edits made in the JSON editor are saved', async () => {
      await documentPage.goToDocumentTab(buildingBlockKey, versionTag);
      const editor = documentPage.schemaEditor;

      await editor.replaceContent(buildEditedSchema(buildingBlockKey));

      const response = await documentPage.saveDocument(buildingBlockKey, versionTag);
      expect(response.status()).toBe(200);

      const stored = await documentPage.getDocumentSchemaViaApi(buildingBlockKey, versionTag);
      expect(stored.properties).toHaveProperty(EDITED_FIELD.name);
      expect(stored.properties[EDITED_FIELD.name]).toMatchObject({
        type: EDITED_FIELD.type,
        description: EDITED_FIELD.description,
      });
      // The replaced schema no longer holds the seeded fields.
      expect(stored.properties).not.toHaveProperty(SEED_FIELDS.applicantName.name);

      // Saving reloads the editor in tree mode with the stored document.
      await documentPage.goToDocumentTab(buildingBlockKey, versionTag);
      await documentPage.assertFieldVisible(EDITED_FIELD.name);
      await documentPage.assertValueVisible(EDITED_FIELD.description);
    });

    test.describe('Failure scenarios', () => {
      test('Save stays disabled until the document is changed', async () => {
        await documentPage.goToDocumentTab(buildingBlockKey, versionTag);

        await expect(documentPage.schemaEditor.saveButton).toBeDisabled();
      });

      test('Invalid JSON cannot be saved and leaves the document untouched', async () => {
        await documentPage.goToDocumentTab(buildingBlockKey, versionTag);
        const editor = documentPage.schemaEditor;

        const before = await documentPage.getDocumentSchemaViaApi(buildingBlockKey, versionTag);

        await editor.replaceContent(INVALID_SCHEMA_TEXT);

        // The editor reports the parse error and offers to repair it.
        await expect(editor.parseError).toBeVisible();
        await expect(editor.autoRepairButton).toBeVisible();

        // Unparseable content never marks the schema valid, so saving stays off.
        await expect(editor.saveButton).toBeDisabled();

        const after = await documentPage.getDocumentSchemaViaApi(buildingBlockKey, versionTag);
        expect(after).toEqual(before);
      });

      /**
       * Runs last: finalizing a version is irreversible, and the tests above need
       * the version to still be a draft.
       */
      test('The document of a finalized version cannot be edited', async () => {
        await documentPage.finalizeVersionViaApi(buildingBlockKey, versionTag);

        await documentPage.goToDocumentTab(buildingBlockKey, versionTag);
        const editor = documentPage.schemaEditor;

        // The schema is still readable...
        await documentPage.assertFieldVisible(SEED_FIELDS.applicantName.name);

        // ...but nothing can be saved and the required fields are locked.
        await expect(editor.saveButton).toBeDisabled();

        await editor.openRequiredFieldsPanel();
        await expect(
          editor.requiredFieldCheckbox(SEED_FIELDS.applicantAge.name).locator('input')
        ).toBeDisabled();
      });
    });
  });
});
