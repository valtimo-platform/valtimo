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
import {CASE_IDENTIFIER, createFormFlowTestData} from './case-details-management-form-flows';
import {CaseDetailsManagementFormFlowsPage} from './page';

test.use({storageState: undefined});

// Tests share a single context/page created in beforeAll and depend on each other
// (create → open → edit → delete). Serial mode keeps them in one group (so
// beforeAll/afterAll run exactly once despite fullyParallel) and skips the remaining
// tests when one fails, instead of cascading "context closed" errors.
test.describe.configure({mode: 'serial'});

test.describe('Case details management — Form Flows', () => {
  let context;
  let page;
  let formFlowsPage: CaseDetailsManagementFormFlowsPage;
  let request;

  // Generate unique test data per run to avoid key collisions
  const formFlowTestData = createFormFlowTestData();

  // Arrange
  test.beforeAll(async ({browser, baseURL}) => {
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    request = context.request;

    formFlowsPage = new CaseDetailsManagementFormFlowsPage(page, request);

    await formFlowsPage.goToCaseManagement(CASE_IDENTIFIER);
    await formFlowsPage.ensureDraftVersionSelected();
    await formFlowsPage.switchToFormFlowsTab();
    await formFlowsPage.cleanupStaleFormFlows();
  });

  test.afterAll(async () => {
    await formFlowsPage.deleteFormFlowViaApi(formFlowTestData.key);
    if (context) await context.close();
  });

  // ─── 6.58 View form flows list ────────────────────────────────────

  test.describe('6.58 — View form flows list', () => {
    test('Form flows list is visible', async () => {
      await expect(formFlowsPage.formFlowsList).toBeVisible();
    });
  });

  // ─── 6.59 Create form flow ────────────────────────────────────────

  test.describe('6.59 — Create form flow', () => {
    test.describe('Success', () => {
      test('Create a form flow', async () => {
        // Act
        await formFlowsPage.createFormFlow(formFlowTestData.key);

        // Assert — creation navigates directly to the form flow editor
        await formFlowsPage.assertEditorPageVisible();
      });
    });
  });

  // ─── 6.60 Edit form flow JSON ─────────────────────────────────────

  test.describe('6.60 — Edit form flow JSON', () => {
    test('Open form flow and see JSON editor', async () => {
      // Navigate back to list first (creation left us on the editor)
      await formFlowsPage.navigateBackToFormFlowsList();

      // Act — open the form flow and switch to the JSON editor tab
      await formFlowsPage.openFormFlow(formFlowTestData.key);
      await formFlowsPage.openJsonEditorTab();

      // Assert — Monaco editor is rendered
      await formFlowsPage.assertEditorVisible();
    });
  });

  // ─── 6.61 Save form flow ───────────────────────────────────────────

  test.describe('6.61 — Save form flow', () => {
    test.describe('Success', () => {
      test('Save button is initially enabled with valid JSON', async () => {
        await expect(formFlowsPage.saveButton).toBeEnabled();
      });

      test('Save form flow with modified JSON', async () => {
        const validFormFlowJson = {
          startStep: 'step1',
          steps: [
            {
              key: 'step1',
              type: {
                name: 'form',
                properties: {definition: 'test-form'},
              },
              nextSteps: [],
              onBack: [],
              onOpen: [],
              onComplete: [],
            },
          ],
        };

        // Act — edit the JSON and save
        await formFlowsPage.editFormFlowJson(validFormFlowJson);
        await expect(formFlowsPage.saveButton).toBeEnabled();
        await formFlowsPage.saveFormFlow(formFlowTestData.key, CASE_IDENTIFIER);

        // Assert — success notification appears
        await formFlowsPage.assertSaveSuccessNotification(formFlowTestData.key);
      });
    });

    test.describe('Failure scenarios', () => {
      test('Saving invalid JSON reveals errors and disables the button until fixed', async () => {
        // Act
        await formFlowsPage.pasteRawTextInEditor('{ this is not valid json }');

        // Assert — validate-on-save: the button stays enabled while modelling, a save attempt
        // on an invalid definition reveals the errors and gates the button on validity
        await expect(formFlowsPage.saveButton).toBeEnabled();
        await formFlowsPage.saveButton.click();
        await expect(formFlowsPage.saveButton).toBeDisabled({timeout: 10_000});

        // Restore valid JSON so subsequent tests (delete) can proceed
        await formFlowsPage.editFormFlowJson({
          startStep: 'step1',
          steps: [
            {
              key: 'step1',
              type: {name: 'form', properties: {definition: 'test-form'}},
              nextSteps: [],
              onBack: [],
              onOpen: [],
              onComplete: [],
            },
          ],
        });
        await expect(formFlowsPage.saveButton).toBeEnabled({timeout: 10_000});
      });
    });
  });

  // ─── 6.62 Visual editor ───────────────────────────────────────────

  test.describe('6.62 — Visual editor', () => {
    test('Visual editor shows the saved steps', async () => {
      // Act — switch from the JSON tab to the visual editor tab
      await formFlowsPage.openVisualEditorTab();

      // Assert — the step saved through the JSON editor is listed and selected; its form key is
      // preserved in the form dropdown even though no form with that name exists. The editor can
      // briefly show a stale definition while the reload after the tab switch settles, so allow
      // a generous timeout.
      await expect(formFlowsPage.visualStepListItems).toHaveCount(1, {timeout: 15_000});
      await expect(formFlowsPage.visualStepListItems.first()).toContainText('step1');
      await expect(formFlowsPage.visualStepKeyInput).toHaveValue('step1');
      await expect(formFlowsPage.visualFormDefinitionDropdown).toContainText('test-form');
    });

    test('Edit a step title in the visual editor and save', async () => {
      // Act
      await formFlowsPage.visualStepTitleInput.fill('First step');
      await expect(formFlowsPage.saveButton).toBeEnabled();
      const response = await formFlowsPage.saveFormFlow(formFlowTestData.key, CASE_IDENTIFIER);

      // Assert
      expect(response.ok()).toBeTruthy();
      await formFlowsPage.assertSaveSuccessNotification(formFlowTestData.key);
    });

    test('Add a step with a transition in the visual editor and save', async () => {
      // Act — add a second step and pick the first available form of the case definition
      await formFlowsPage.addVisualStep();
      await expect(formFlowsPage.visualStepKeyInput).toHaveValue('step-2');
      // The new step is not the start step, so it offers the make-start action
      await expect(formFlowsPage.visualMakeStartStepButton).toBeVisible();
      await formFlowsPage.selectFirstVisualFormDefinition();

      // Act — connect the first step to the new step
      await formFlowsPage.selectVisualStep(0);
      await formFlowsPage.visualAddTransitionButton.click();
      await formFlowsPage.selectVisualTransitionTarget(0, 'step-2');

      await expect(formFlowsPage.saveButton).toBeEnabled();
      const response = await formFlowsPage.saveFormFlow(formFlowTestData.key, CASE_IDENTIFIER);

      // Assert
      expect(response.ok()).toBeTruthy();
      await formFlowsPage.assertSaveSuccessNotification(formFlowTestData.key);

      // Assert — the transition is part of the persisted definition shown in the JSON editor
      await formFlowsPage.openJsonEditorTab();
      await expect(formFlowsPage.monacoEditor).toContainText('step-2');
    });
  });

  // ─── Delete form flow (cleanup) ───────────────────────────────────

  test.describe('Delete form flow', () => {
    test('Navigate back to form flows list', async () => {
      await formFlowsPage.navigateBackToFormFlowsList();
      await formFlowsPage.assertFormFlowExists(formFlowTestData.key);
    });

    test('Delete the created form flow', async () => {
      // Act
      await formFlowsPage.deleteFormFlow(formFlowTestData.key);

      // Assert
      await formFlowsPage.assertFormFlowNotExists(formFlowTestData.key);
    });
  });
});
