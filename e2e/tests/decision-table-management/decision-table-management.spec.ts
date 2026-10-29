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
import {createDecisionTestData, SEEDED_DECISION_KEY} from './decision-table-management';
import {DecisionTableManagementPage} from './page';

test.use({storageState: undefined});

// Tests share one context/page created in beforeAll. Serial mode keeps them in a single group
// (so beforeAll/afterAll run once) and skips the rest when one fails.
test.describe.configure({mode: 'serial'});

/**
 * Covers the standalone `/decision-tables` admin page — decision tables that are *not* linked to a
 * case or building block definition. The case-scoped equivalent is Feature 6E.
 *
 * Nothing here deploys a decision table. Deployment is the step that persists a definition, and a
 * standalone decision table cannot be removed again: the list's Delete row action calls the
 * case-scoped endpoint and is disabled outside a case context (asserted below). A deploying test
 * would therefore permanently add a definition on every run. Creating and editing are covered up
 * to — but not including — the deploy click; deployment itself is covered case-scoped in 6.40.
 */
test.describe('Decision table management', () => {
  let context;
  let page;
  let decisionPage: DecisionTableManagementPage;

  const testData = createDecisionTestData();

  test.beforeAll(async ({browser, baseURL}) => {
    context = await browser.newContext({baseURL});
    page = await context.newPage();

    decisionPage = new DecisionTableManagementPage(page, context.request);

    await page.goto('/');
    await decisionPage.goToDecisionTables();
  });

  test.afterAll(async () => {
    // No cleanup needed: these tests never deploy, so nothing is persisted.
    if (context) await context.close();
  });

  // ─── 8.1 View decision tables overview ────────────────────────────

  test.describe('8.1 — View decision tables overview', () => {
    test('Overview list is visible', async () => {
      await expect(decisionPage.decisionList).toBeVisible();
    });

    test('List shows the Key, Name and Version columns', async () => {
      await decisionPage.assertColumnHeaders(['Key', 'Name', 'Version']);
    });

    test('List matches the decision definitions from the API', async () => {
      // The list shows the latest version per key
      await decisionPage.assertListMatchesApi();
    });

    test('Seeded decision table is listed', async () => {
      await decisionPage.assertDecisionVisible(SEEDED_DECISION_KEY);
    });
  });

  // ─── 8.3 Edit decision table ──────────────────────────────────────

  test.describe('8.3 — Edit decision table', () => {
    test('Open an existing decision table in the DMN modeler', async () => {
      test.setTimeout(60_000);

      // Act
      await decisionPage.openDecisionInModeler(SEEDED_DECISION_KEY);

      // Assert — the modeler mounted, is editable, and offers a deploy action
      await expect(decisionPage.modelerCanvas).toBeVisible();
      await expect(decisionPage.readOnlyTag).toHaveCount(0);
      await expect(decisionPage.deployButton).toBeEnabled();
      // The table's own content is rendered, not an empty diagram
      await expect(decisionPage.modeler).toContainText('betrokkene-type mapping');

      // Leave without deploying
      await decisionPage.goToDecisionTables();
    });
  });

  // ─── 8.2 Create decision table ────────────────────────────────────

  test.describe('8.2 — Create decision table', () => {
    /**
     * Kept as one test: the create modal is transient state, and submitting it navigates to the
     * modeler. Splitting would lose the modal between blocks.
     */
    test('Create a decision table and land in the DMN modeler', async () => {
      test.setTimeout(60_000);

      // Act
      await decisionPage.openCreateModal();
      await decisionPage.nameInput.fill(testData.name);
      await decisionPage.addInputVariable(testData.inputVariable, testData.inputVariableLabel);
      await decisionPage.submitCreateModal();

      // Assert — an empty, editable table is opened in the modeler, ready to be deployed
      await expect(decisionPage.modelerCanvas).toBeVisible();
      await expect(decisionPage.deployButton).toBeVisible();
      expect(page.url()).toContain('/decision-tables/edit/create');

      // Leave without deploying, so nothing is persisted
      await decisionPage.goToDecisionTables();
      await expect(decisionPage.decisionList).toBeVisible();
    });
  });

  // ─── Failure scenarios ────────────────────────────────────────────

  test.describe('Failure scenarios', () => {
    test('Cannot submit the create modal without a name', async () => {
      await decisionPage.openCreateModal();

      // Assert — the name is required
      await expect(decisionPage.nameInput).toHaveValue('');
      await expect(decisionPage.createSubmitButton).toBeDisabled();

      // Filling it in enables the submit
      await decisionPage.nameInput.fill(testData.name);
      await expect(decisionPage.createSubmitButton).toBeEnabled();

      // Clearing it disables it again, and nothing is created
      await decisionPage.nameInput.fill('');
      await expect(decisionPage.createSubmitButton).toBeDisabled();

      await decisionPage.visibleModal.getByRole('button', {name: 'Cancel'}).click();
      await expect(decisionPage.visibleModal).toHaveCount(0);
    });

    test('Upload stays disabled until a DMN file is selected', async () => {
      await decisionPage.uploadButton.click();
      await expect(decisionPage.uploadSubmitButton).toBeDisabled();

      await decisionPage.visibleModal.getByRole('button', {name: 'Cancel'}).click();
      await expect(decisionPage.visibleModal).toHaveCount(0);
    });

    test('Delete is offered but disabled for standalone decision tables', async () => {
      // Deleting is only implemented for case-scoped decision tables, so the action is present
      // in the row menu but disabled here. This is why no test in this file deploys anything.
      await decisionPage.openRowMenu(SEEDED_DECISION_KEY);

      await expect(decisionPage.menuItem(SEEDED_DECISION_KEY, 'Edit')).toBeEnabled();
      await expect(decisionPage.menuItem(SEEDED_DECISION_KEY, 'Delete')).toBeDisabled();

      await page.keyboard.press('Escape');
    });
  });
});
