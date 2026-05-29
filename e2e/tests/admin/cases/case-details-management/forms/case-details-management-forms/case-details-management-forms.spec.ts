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
import {CaseDetailsFormsPage} from './page';
import {expectNotificationMessage} from '../../../../../../utils/ui.utils';

const CASE_KEY = 'bezwaar';
const TEST_FORM_NAME = `aaa-e2e-test-form-${Date.now()}`;
const TEST_COMPONENT_LABEL = 'E2E Text Field';

test.use({storageState: undefined});

test.describe('Case details - Forms tab', () => {
  let context;
  let page;
  let request;
  let formsPage: CaseDetailsFormsPage;
  let draftVersion: string;

  test.beforeAll(async ({browser, baseURL}) => {
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    request = context.request;

    formsPage = new CaseDetailsFormsPage(page, request);

    await page.goto('/');
    draftVersion = await formsPage.goToCaseForms(CASE_KEY);

    // Clean up stale test form from previous runs so the create step can succeed
    await formsPage.deleteFormByNameViaApi(CASE_KEY, draftVersion, TEST_FORM_NAME);
  });

  test.afterAll(async () => {
    // Final cleanup — remove the test form if the UI delete step didn't run
    await formsPage.deleteFormByNameViaApi(CASE_KEY, draftVersion, TEST_FORM_NAME);
    await context.close();
  });

  test.describe('6.52, 6.53, 6.54, 6.57 — Create, build, configure and save form', () => {
    test('6.52 — Create form opens the builder with the given name', async () => {
      await formsPage.openCreateModal();
      await formsPage.submitCreateModalWithName(TEST_FORM_NAME);

      // Save button is present on the newly created (empty) form
      await expect(formsPage.saveFormButton).toBeVisible();
    });

    test('6.53, 6.54 — Drag a text-field component into the form and configure its label', async () => {
      await formsPage.dragComponentIntoForm('textfield');
      await formsPage.configureAndSaveComponent(TEST_COMPONENT_LABEL);

      await expect(formsPage.placedComponents('textfield')).toHaveCount(1);
      await expect(formsPage.componentLabel(TEST_COMPONENT_LABEL)).toBeVisible();
    });

    test('6.57 — Save form persists changes, shows success notification, and returns to the list', async () => {
      await formsPage.saveForm();

      await expectNotificationMessage(page, 'deployed');

      // Saving navigates back to the case Forms list
      await page.waitForURL(/\/forms$/);
      await formsPage.carbonList.waitForLoaded();

      const persisted = await formsPage.findFormByNameViaApi(
        CASE_KEY,
        draftVersion,
        TEST_FORM_NAME
      );
      expect(persisted, 'saved form should be persisted via API').toBeTruthy();

      const definition = await formsPage.fetchFormDefinitionViaApi(
        CASE_KEY,
        draftVersion,
        persisted!.id
      );
      expect(definition.formDefinition.components?.some(c => c.label === TEST_COMPONENT_LABEL))
        .toBe(true);
    });

    test.describe('Failure scenarios', () => {
      test('Submit button is disabled on an empty name', async () => {
        await formsPage.openCreateModal();
        await expect(formsPage.createModalSubmitButton).toBeDisabled();

        // Close the modal via its Cancel button so the next describe starts on the list
        await page.getByRole('dialog').getByRole('button', {name: 'Cancel'}).click();
        await expect(formsPage.createModalNameInput).not.toBeVisible();
      });
    });
  });

  test.describe('6.55, 6.56 — JSON editor and form preview', () => {
    const EDITOR_FORM_NAME = `aaa-e2e-editor-form-${Date.now()}`;
    const PREVIEW_VALUE = 'preview-value';

    test.beforeAll(async () => {
      // Remove any stale form from prior tests
      await formsPage.deleteFormByNameViaApi(CASE_KEY, draftVersion, EDITOR_FORM_NAME);
      const formId = await formsPage.createFormWithTextFieldViaApi(
        CASE_KEY,
        draftVersion,
        EDITOR_FORM_NAME,
        TEST_COMPONENT_LABEL
      );
      await formsPage.goToFormEditPage(CASE_KEY, draftVersion, formId);
    });

    test.afterAll(async () => {
      await formsPage.deleteFormByNameViaApi(CASE_KEY, draftVersion, EDITOR_FORM_NAME);
    });

    test('6.55 — JSON editor tab shows the current form definition JSON', async () => {
      await formsPage.switchToJsonEditorTab();
      await expect(formsPage.monacoViewLines).toContainText('textfield');
      await expect(formsPage.monacoViewLines).toContainText(TEST_COMPONENT_LABEL);
    });

    test('6.56 — Output tab renders a live preview and reflects typed values in the output JSON', async () => {
      await formsPage.switchToOutputTab();

      // The text-field we added is rendered as an actual input in the preview
      const previewInput = formsPage.previewInputByLabel(TEST_COMPONENT_LABEL);
      await expect(previewInput).toBeVisible();

      // Typing into the preview updates the output JSON shown below the form
      await previewInput.fill(PREVIEW_VALUE);
      await expect(formsPage.outputJsonView).toContainText(PREVIEW_VALUE);
    });
  });
});
