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
import {CaseDetailsDecisionsPage} from './page';
import {expectNotificationMessage} from '../../utils/ui.utils';

const CASE_KEY = 'bezwaar';
const UPLOADED_DECISION_KEY = 'e2e-test-decision';

test.use({storageState: undefined});

test.describe('Case details - Decision tables tab', () => {
  let context;
  let page;
  let request;
  let decisionsPage: CaseDetailsDecisionsPage;
  let draftVersion: string;

  test.beforeAll(async ({browser, baseURL}) => {
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    request = context.request;

    decisionsPage = new CaseDetailsDecisionsPage(page, request);

    await page.goto('/');
    draftVersion = await decisionsPage.goToCaseDecisions(CASE_KEY);

    // Remove any stale decision from a previous aborted run so the upload step can succeed
    await decisionsPage.deleteDecisionViaApi(CASE_KEY, draftVersion, UPLOADED_DECISION_KEY);
  });

  test.afterAll(async () => {
    await decisionsPage.deleteDecisionViaApi(CASE_KEY, draftVersion, UPLOADED_DECISION_KEY);
    await context.close();
  });

  test.describe('6.39 — View linked decision tables', () => {
    test('Decision tables list is visible and loaded', async () => {
      await decisionsPage.assertListLoaded();
    });

    test('Upload button is visible in the toolbar', async () => {
      await expect(decisionsPage.uploadButton).toBeVisible();
    });
  });

  test.describe('6.40 — Upload decision table', () => {
    test('Can open and cancel the upload modal without side effects', async () => {
      await decisionsPage.openUploadModal();
      // Submit is disabled until a .dmn file is selected
      await expect(decisionsPage.uploadModalSubmitButton).toBeDisabled();

      // Close the modal via the X close button so the next test starts clean
      await page.getByRole('button', {name: 'Close modal'}).click();
      await expect(decisionsPage.uploadModalSubmitButton).not.toBeVisible();
    });

    test('Can upload a DMN file — modal closes and the decision appears in the list', async () => {
      await decisionsPage.uploadDmnFile();

      await decisionsPage.assertDecisionVisible(UPLOADED_DECISION_KEY);
    });
  });

  test.describe('6.41, 6.42, 6.43, 6.44 — Open editor and manage DMN', () => {
    const DEFAULT_INPUT_LABEL = 'Input value';
    const DEFAULT_OUTPUT_LABEL = 'Result';
    const DEFAULT_RULE_COUNT = 2;

    test('6.41 — Clicking a decision opens the modeler and the table view shows the DMN', async () => {
      await decisionsPage.clickDecisionRow(UPLOADED_DECISION_KEY);
      await page.waitForURL(/\/decisions\/[^/]+$/);

      await expect(decisionsPage.modelerContainer).toBeVisible();
      await expect(decisionsPage.deployButton).toBeVisible();
      await expect(decisionsPage.backButton).toBeVisible();
      await decisionsPage.switchToDecisionTableView();

      // Structure from the seeded DMN: 1 input column, 1 output column, 2 rules
      await expect(decisionsPage.inputColumnHeader(DEFAULT_INPUT_LABEL)).toBeVisible();
      await expect(decisionsPage.outputColumnHeader(DEFAULT_OUTPUT_LABEL)).toBeVisible();
      await expect(decisionsPage.ruleRows).toHaveCount(DEFAULT_RULE_COUNT);
    });

    test('6.42 — Can change the DMN hit policy via the dropdown', async () => {
      await expect(decisionsPage.hitPolicyDisplay).toContainText('Unique');

      await decisionsPage.selectHitPolicyOption('First');

      await expect(decisionsPage.hitPolicyDisplay).toContainText('First');
    });

    test('6.43 — Can add an input column via the "+" button', async () => {
      const initialCount = await decisionsPage.inputColumnHeaders.count();

      await decisionsPage.clickAddInputColumn();

      await expect(decisionsPage.inputColumnHeaders).toHaveCount(initialCount + 1);
    });

    test('6.44 — Can add a rule row via the footer "+" button', async () => {
      const initialCount = await decisionsPage.ruleRows.count();

      await decisionsPage.clickAddRule();

      await expect(decisionsPage.ruleRows).toHaveCount(initialCount + 1);
    });
  });

  test.describe('6.45 — Save decision table', () => {
    test('Can save the decision — shows success notification', async () => {
      await decisionsPage.saveDecision();
      await expectNotificationMessage(page, 'deployed successfully');
    });

    test('Can navigate back to the decisions list and the saved decision is still listed', async () => {
      await decisionsPage.navigateBackFromModeler();

      await decisionsPage.assertDecisionVisible(UPLOADED_DECISION_KEY);
    });

    test('Deleting the decision removes it from the list', async () => {
      // Delete via API
      await decisionsPage.deleteDecisionViaApi(CASE_KEY, draftVersion, UPLOADED_DECISION_KEY);
      await decisionsPage.reloadList();
      await decisionsPage.assertDecisionNotVisible(UPLOADED_DECISION_KEY);
    });
  });
});
