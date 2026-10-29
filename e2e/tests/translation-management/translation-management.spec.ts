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
import {EN_COLUMN, KEY_COLUMN, Localization, NL_COLUMN, TranslationManagementPage} from './page';
import {
  EXPECTED_COLUMN_TITLES,
  LANGUAGE_KEYS,
  SEEDED,
  SEEDED_CONTENT,
  TRANSLATION_PREFIX,
} from './translation-config';

test.use({storageState: undefined});

test.describe.configure({mode: 'serial'});

/**
 * Covers the `/translation-management` admin page — a single editable table of translation keys
 * with one column per configured language.
 *
 * State handling: translations are global application state and the update endpoint is an upsert
 * of a whole language at a time (there is no delete). `beforeAll` therefore captures the current
 * localizations, merges this suite's keys into them, and `afterAll` writes the captured content
 * back over every language the suite touched.
 */
test.describe('Translation Management', () => {
  let context;
  let page;
  let translationPage: TranslationManagementPage;
  let originalLocalizations: Localization[] = [];

  test.beforeAll(async ({browser, baseURL}) => {
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    translationPage = new TranslationManagementPage(page);

    // Capture the untouched state, then merge the suite's own keys into it so the table has
    // deterministic content without discarding whatever the environment already had.
    originalLocalizations = await translationPage.getLocalizationsViaApi();
    await translationPage.setLocalizationsViaApi(
      LANGUAGE_KEYS.map(languageKey => ({
        languageKey,
        content: {
          ...(originalLocalizations.find(l => l.languageKey === languageKey)?.content ?? {}),
          [TRANSLATION_PREFIX]: SEEDED_CONTENT[languageKey],
        },
      }))
    );

    await page.goto('/');
    await translationPage.goToTranslationManagement();
  });

  test.afterAll(async () => {
    await translationPage.restoreLocalizationsViaApi(originalLocalizations, LANGUAGE_KEYS);

    if (context) await context.close();
  });

  // ─── 14.1–14.3 Viewing ────────────────────────────────────────────

  test.describe('14.1–14.3 — View the translations table', () => {
    test('14.1 · The table lists the configured translations', async () => {
      expect(await translationPage.rowCount()).toBeGreaterThanOrEqual(2);
    });

    test('14.2 · The key column shows the translation keys', async () => {
      const keys = await translationPage.keys();

      expect(keys).toEqual(expect.arrayContaining([SEEDED.alpha, SEEDED.beta]));
    });

    test('14.3 · There is a key column and one column per language', async () => {
      await expect(translationPage.columnTitles).toHaveText(EXPECTED_COLUMN_TITLES);

      // Each seeded row carries the English and Dutch value it was seeded with
      const row = await translationPage.rowIndexForKey(SEEDED.alpha);
      await expect(translationPage.cell(row, EN_COLUMN)).toHaveValue(SEEDED_CONTENT.en.alpha);
      await expect(translationPage.cell(row, NL_COLUMN)).toHaveValue(SEEDED_CONTENT.nl.alpha);
    });
  });

  // ─── 14.4–14.7, 14.11, 14.12 Editing and cancelling ───────────────

  test.describe('14.4–14.7 · 14.11–14.12 — Add a row and cancel the save', () => {
    // Adding a row, filling it and opening the modal is one continuous piece of unsaved form
    // state, so it stays in a single test — splitting it would lose the row between tests.
    test('A new row can be filled in, and cancelling the dialog saves nothing', async () => {
      const key = `${TRANSLATION_PREFIX}.gamma`;

      // 14.4 — Add translation row
      const row = await translationPage.addRow();

      // 14.5, 14.6, 14.7 — key, English and Dutch values
      await translationPage.fillRow(row, [key, 'Gamma English', 'Gamma Nederlands']);
      await expect(translationPage.cell(row, KEY_COLUMN)).toHaveValue(key);
      await expect(translationPage.cell(row, EN_COLUMN)).toHaveValue('Gamma English');
      await expect(translationPage.cell(row, NL_COLUMN)).toHaveValue('Gamma Nederlands');

      // 14.11 — the confirmation dialog offers cancel, save, and save-with-reload
      await translationPage.openSaveModal();
      await expect(translationPage.modalHeading).toHaveText('Save translations');
      await expect(translationPage.modalContent).toContainText('page reload');
      await expect(translationPage.modalCancelButton).toHaveText('Cancel');
      await expect(translationPage.modalSaveButton).toHaveText('Save');
      await expect(translationPage.modalSaveAndReloadButton).toHaveText('Save and reload');

      // 14.12 — cancelling leaves the row in the form but persists nothing
      await translationPage.cancelSave();
      await expect(translationPage.cell(row, KEY_COLUMN)).toHaveValue(key);
      expect(await translationPage.translationViaApi('en', key)).toBeUndefined();

      // Drop the unsaved row so the next test starts from the persisted state
      await translationPage.deleteRow(row);
    });
  });

  // ─── 14.9 Save ────────────────────────────────────────────────────

  test.describe('14.9 — Save translations', () => {
    test('Saving without a reload persists the new translation', async () => {
      const key = `${TRANSLATION_PREFIX}.delta`;

      const row = await translationPage.addRow();
      await translationPage.fillRow(row, [key, 'Delta English', 'Delta Nederlands']);

      await translationPage.openSaveModal();
      await translationPage.confirmSave();

      // Assert — stored for both languages, and the form is pristine again
      expect(await translationPage.translationViaApi('en', key)).toBe('Delta English');
      expect(await translationPage.translationViaApi('nl', key)).toBe('Delta Nederlands');
      await expect(translationPage.saveButton).toBeDisabled();
    });
  });

  // ─── 14.10 Save and reload ────────────────────────────────────────

  test.describe('14.10 — Save and reload the application', () => {
    test('Saving with a reload persists the translation and re-renders the page', async () => {
      test.setTimeout(90_000);
      const key = `${TRANSLATION_PREFIX}.epsilon`;

      const row = await translationPage.addRow();
      await translationPage.fillRow(row, [key, 'Epsilon English', 'Epsilon Nederlands']);

      await translationPage.openSaveModal();
      await translationPage.confirmSaveAndReload();

      // Assert — persisted, and the reloaded page shows the row it was saved with
      expect(await translationPage.translationViaApi('en', key)).toBe('Epsilon English');
      const reloadedRow = await translationPage.rowIndexForKey(key);
      expect(reloadedRow).toBeGreaterThanOrEqual(0);
      await expect(translationPage.cell(reloadedRow, NL_COLUMN)).toHaveValue('Epsilon Nederlands');
    });
  });

  // ─── 14.8 Delete ──────────────────────────────────────────────────

  test.describe('14.8 — Delete translation row', () => {
    test('Deleting a row and saving removes the translation', async () => {
      const row = await translationPage.rowIndexForKey(SEEDED.beta);
      expect(row, `seeded key ${SEEDED.beta} should be in the table`).toBeGreaterThanOrEqual(0);

      await translationPage.deleteRow(row);
      await translationPage.openSaveModal();
      await translationPage.confirmSave();

      // Assert — gone from the table and from both languages
      expect(await translationPage.keys()).not.toContain(SEEDED.beta);
      expect(await translationPage.translationViaApi('en', SEEDED.beta)).toBeUndefined();
      expect(await translationPage.translationViaApi('nl', SEEDED.beta)).toBeUndefined();
    });
  });

  // ─── Failure scenarios ────────────────────────────────────────────

  test.describe('Failure scenarios', () => {
    test('14.12a · Save is disabled while nothing has been changed', async () => {
      await translationPage.reload();

      await expect(translationPage.saveButton).toBeDisabled();
    });

    test('14.12b · An incomplete row keeps Save disabled until every column is filled', async () => {
      const key = `${TRANSLATION_PREFIX}.incomplete`;

      // Act — an empty row is not a change the form will accept
      const row = await translationPage.addRow();
      await expect(translationPage.saveButton).toBeDisabled();

      // ...nor is a row with only a key...
      await translationPage.cell(row, KEY_COLUMN).fill(key);
      await expect(translationPage.saveButton).toBeDisabled();

      // ...nor one still missing its Dutch translation
      await translationPage.cell(row, EN_COLUMN).fill('Incomplete English');
      await expect(translationPage.saveButton).toBeDisabled();

      // Completing the row finally enables Save
      await translationPage.cell(row, NL_COLUMN).fill('Incomplete Nederlands');
      await expect(translationPage.saveButton).toBeEnabled();

      // Assert — nothing was persisted along the way
      expect(await translationPage.translationViaApi('en', key)).toBeUndefined();

      await translationPage.deleteRow(row);
    });
  });
});
