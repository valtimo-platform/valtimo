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
import {CASE_IDENTIFIER, HEADER_WIDGET_FIXTURE} from './case-details-management-header';
import {CaseDetailsManagementHeaderPage} from './page';

test.use({storageState: undefined});

test.describe('Case details management — Header widgets', () => {
  let context;
  let page;
  let headerPage: CaseDetailsManagementHeaderPage;
  let draftVersion: string;
  let originalWidget: object | null;

  test.beforeAll(async ({browser, baseURL}) => {
    test.setTimeout(60_000);
    context = await browser.newContext({baseURL});
    page = await context.newPage();

    headerPage = new CaseDetailsManagementHeaderPage(page, context.request);

    await page.goto('/');
    await headerPage.goToCaseManagement(CASE_IDENTIFIER);
    draftVersion = await headerPage.ensureDraftVersionSelected();

    // Save existing header widget state so we can restore it in afterAll
    originalWidget = await headerPage.getHeaderWidgetViaApi(CASE_IDENTIFIER, draftVersion);
  });

  test.afterAll(async () => {
    // Restore original widget state
    if (originalWidget) {
      await headerPage.createHeaderWidgetViaApi(CASE_IDENTIFIER, draftVersion, originalWidget);
    } else {
      await headerPage.deleteHeaderWidgetViaApi(CASE_IDENTIFIER, draftVersion);
    }

    await context.close();
  });

  // ─── 6.85 View header widgets — with configured widget ────────────

  test.describe('6.85 — View header widgets — with configured widget', () => {
    test('Ensure header widget exists via API', async () => {
      const existing = await headerPage.getHeaderWidgetViaApi(CASE_IDENTIFIER, draftVersion);
      if (!existing) {
        await headerPage.createHeaderWidgetViaApi(
          CASE_IDENTIFIER,
          draftVersion,
          HEADER_WIDGET_FIXTURE
        );
      }
    });

    test('Navigate to Header tab', async () => {
      await headerPage.switchToCaseDetailsHeader();
    });

    test('Widget management panel is visible', async () => {
      await headerPage.assertWidgetManagementVisible();
    });

    test('Widget list is visible', async () => {
      await headerPage.assertWidgetListVisible();
    });

    test('Configured widget is displayed in the list', async () => {
      await headerPage.assertWidgetRowCount(1);
    });

    test('Widget type tag shows "Fields"', async () => {
      await headerPage.assertWidgetTypeTag('Fields');
    });
  });

  // ─── 6.85 Failure scenarios ───────────────────────────────────────

  test.describe('Failure scenarios — view', () => {
    test('Add widget button is disabled when a widget already exists (single-widget mode)', async () => {
      await headerPage.assertToolbarAddWidgetButtonDisabled();
    });
  });

  // ─── 6.85 View header widgets — empty state ───────────────────────

  test.describe('6.85 — View header widgets — empty state', () => {
    test('Remove existing header widget via API and reload', async () => {
      await headerPage.deleteHeaderWidgetViaApi(CASE_IDENTIFIER, draftVersion);
      await page.reload();
      await headerPage.switchToCaseDetailsHeader();
    });

    test('Widget management panel is visible in empty state', async () => {
      await headerPage.assertWidgetManagementVisible();
    });

    test('Empty state message is displayed when no widget is configured', async () => {
      await headerPage.assertEmptyStateVisible();
    });

    test('Add widget button is enabled when no widget exists', async () => {
      await headerPage.assertEmptyStateAddWidgetButtonEnabled();
    });
  });

  // ─── 6.86 Add header widget ───────────────────────────────────────

  test.describe('6.86 — Add header widget', () => {
    test.describe('Success', () => {
      test('Open the add widget wizard', async () => {
        await headerPage.openAddWidgetWizard();
        await headerPage.assertWizardOpen();
      });

      test('Wizard shows "Create widget" heading', async () => {
        await expect(headerPage.wizardHeading).toContainText('Create widget');
      });

      test('Next button is disabled before selecting a widget type', async () => {
        await headerPage.assertWizardNextDisabled();
      });

      test('Select the "Fields" widget type', async () => {
        await headerPage.selectFieldsWidgetType();
        await headerPage.assertWizardNextEnabled();
      });

      test('Click Next to go to content step', async () => {
        await headerPage.clickNext();
      });

      test('Save button is disabled before configuring content', async () => {
        await headerPage.assertWizardNextDisabled();
      });

      test('Fill in field content and save', async () => {
        await headerPage.fillFieldContent('E2e Header Field', 'doc:voornaam');
        await headerPage.clickSave();
      });

      test('Wizard closes after save', async () => {
        await headerPage.assertWizardClosed();
      });

      test('Widget appears in the list', async () => {
        await headerPage.assertWidgetRowCount(1);
      });

      test('Widget type shows "Fields" in the list', async () => {
        await headerPage.assertWidgetTypeTag('Fields');
      });

      test('Add widget button is now disabled (single-widget mode)', async () => {
        await headerPage.assertToolbarAddWidgetButtonDisabled();
      });
    });

    test.describe('Delete the added widget', () => {
      test('Delete header widget via API and reload', async () => {
        await headerPage.deleteHeaderWidgetViaApi(CASE_IDENTIFIER, draftVersion);
        await page.reload();
        await headerPage.switchToCaseDetailsHeader();
        await headerPage.assertEmptyStateVisible();
      });
    });

    test.describe('Cancel', () => {
      test('Open wizard and cancel without saving', async () => {
        await headerPage.openAddWidgetWizard();
        await headerPage.assertWizardOpen();
        await headerPage.cancelWizard();
      });

      test('Wizard closes on cancel', async () => {
        await headerPage.assertWizardClosed();
      });

      test('No widget was created', async () => {
        await headerPage.assertEmptyStateVisible();
      });
    });

    test.describe('Failure scenarios — add', () => {
      test('Cannot proceed past type step without selecting a type', async () => {
        await headerPage.openAddWidgetWizard();
        await headerPage.assertWizardNextDisabled();
      });

      test('Cannot save without configuring field content', async () => {
        await headerPage.selectFieldsWidgetType();
        await headerPage.clickNext();
        // Save button should be disabled because no field content is configured
        await headerPage.assertWizardNextDisabled();
      });

      test('Clean up — cancel the open wizard', async () => {
        await headerPage.cancelWizard();
        await headerPage.assertWizardClosed();
      });
    });
  });
});
