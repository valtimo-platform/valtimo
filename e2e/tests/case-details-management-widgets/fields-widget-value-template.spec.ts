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
import {apiDelete, apiPost} from '../../utils/api.utils';
import {createValueTemplateTestData} from './case-details-management-widgets';
import {CaseDetailsManagementWidgetsPage} from './page';

test.use({storageState: 'playwright/.auth/uiState.json'});

// The tests share one page and run in order.
test.describe.configure({mode: 'serial'});

test.describe('Case details management — Widgets — several values in one field', () => {
  let context;
  let page;
  let widgetsPage: CaseDetailsManagementWidgetsPage;
  let draftVersion: string;
  let widgetTabKey: string;
  let documentId: string | undefined;

  const testData = createValueTemplateTestData();
  const caseKey = testData.caseDefinitionKey;

  test.beforeAll(async ({browser, baseURL}) => {
    test.setTimeout(120_000);
    context = await browser.newContext({
      baseURL: baseURL ?? 'http://localhost:4200',
      storageState: 'playwright/.auth/uiState.json',
    });
    page = await context.newPage();
    widgetsPage = new CaseDetailsManagementWidgetsPage(page, context.request);

    await widgetsPage.goToCaseManagement(caseKey);
    draftVersion = await widgetsPage.ensureDraftVersionSelected();
    await widgetsPage.goToWidgetTab(testData.widgetTabName);
    widgetTabKey = widgetsPage.getWidgetTabKeyFromUrl();

    await widgetsPage.removeTestWidgetsViaApi(
      caseKey,
      draftVersion,
      widgetTabKey,
      'E2e Template Widget'
    );
  });

  test.afterAll(async () => {
    await widgetsPage.removeTestWidgetsViaApi(
      caseKey,
      draftVersion,
      widgetTabKey,
      'E2e Template Widget'
    );
    if (documentId) {
      await apiDelete(`/api/v1/document/${documentId}`).catch(() => undefined);
    }
    if (context) await context.close();
  });

  test('The value tooltip explains how to combine several values', async () => {
    await widgetsPage.openFieldsWidgetContentStep();

    const tooltip = await widgetsPage.openValueTooltip();
    await expect(tooltip).toContainText('To show several values in one field');

    await widgetsPage.wizardCancelButton.click();
    await widgetsPage.waitForWizardClosed();
    // A wizard reopened on the same page can reset to its first step mid-click; start fresh.
    await page.reload();
    await page.waitForSelector('valtimo-widget-management-editor');
  });

  test('A template entered in the wizard shows the combined value on a case', async () => {
    await widgetsPage.addFieldsWidget({
      title: testData.widgetTitle,
      fieldTitle: testData.fieldTitle,
      valuePath: testData.template,
      manualValue: true,
    });
    await widgetsPage.assertWidgetVisible(testData.widgetTitle);

    await expect
      .poll(async () => {
        const widgets = await widgetsPage.getWidgetsViaApi(caseKey, draftVersion, widgetTabKey);
        const widget = widgets.find(w => w.title === testData.widgetTitle) as
          {properties: {columns: Array<Array<{value: string}>>}} | undefined;
        return widget?.properties.columns[0][0].value;
      })
      .toBe(testData.template);

    const created = await apiPost<{document: {id: string}}>(
      '/api/v1/process-document/operation/new-document-and-start-process',
      {
        processDefinitionKey: caseKey,
        request: {
          definition: caseKey,
          caseDefinitionKey: caseKey,
          caseDefinitionVersionTag: draftVersion,
          content: testData.document,
        },
      }
    );
    documentId = created.document.id;

    await page.goto(`/cases/${caseKey}/document/${documentId}/${widgetTabKey}`);

    const widget = page
      .locator('valtimo-widget-field')
      .filter({has: page.getByRole('heading', {name: testData.widgetTitle})});
    const field = widget
      .locator('.valtimo-widget-field__field')
      .filter({has: page.locator('label', {hasText: testData.fieldTitle})});

    await expect(field.locator('.valtimo-widget-field__field-value')).toHaveText(
      testData.expectedValue
    );
  });
});
