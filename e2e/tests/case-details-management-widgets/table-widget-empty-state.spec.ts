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

import {expect, type Locator, type Page, test} from '@playwright/test';
import * as ApiUtils from '../../utils/api.utils';
import {createEmptyTableWidgetTestData} from './case-details-management-widgets';
import {CaseDetailsManagementWidgetsPage} from './page';

test.use({storageState: undefined});

// The tests share one page and one widget, and the message tests build on each other.
test.describe.configure({mode: 'serial'});

test.describe('Table widget empty state', () => {
  let context;
  let page: Page;
  let widgetsPage: CaseDetailsManagementWidgetsPage;
  let emptyCaseId: string;
  let oneRowCaseId: string;

  const data = createEmptyTableWidgetTestData();
  const widgetTabUrl = `/api/management/v1/case-definition/${data.caseDefinitionKey}/version/${data.versionTag}/widget-tab/${data.tabKey}`;

  const tableWidget = {
    type: 'table',
    key: data.widgetKey,
    title: data.widgetTitle,
    icon: null,
    width: 1,
    highContrast: false,
    isCompact: null,
    displayConditions: [],
    actions: [],
    properties: {
      collection: 'doc:children',
      defaultPageSize: 5,
      firstColumnAsTitle: false,
      columns: [
        {
          key: 'name',
          title: data.columnTitles[0],
          value: 'name',
          displayProperties: {type: 'text'},
        },
        {
          key: 'relation',
          title: data.columnTitles[1],
          value: 'relation',
          displayProperties: {type: 'text'},
        },
      ],
    },
  };

  async function replaceTableWidget(widget: Record<string, unknown> | null) {
    const tab = await ApiUtils.apiGet<{widgets: Array<{key: string}>}>(widgetTabUrl);
    const widgets = tab.widgets.filter(w => w.key !== data.widgetKey);
    await ApiUtils.apiPost(widgetTabUrl, {
      caseDefinitionKey: data.caseDefinitionKey,
      caseDefinitionVersionTag: data.versionTag,
      key: data.tabKey,
      widgets: widget ? [...widgets, widget] : widgets,
    });
  }

  async function savedTableProperties(): Promise<Record<string, unknown> | undefined> {
    const tab = await ApiUtils.apiGet<{
      widgets: Array<{key: string; properties: Record<string, unknown>}>;
    }>(widgetTabUrl);
    return tab.widgets.find(w => w.key === data.widgetKey)?.properties;
  }

  async function createCase(children: Array<Record<string, string>>): Promise<string> {
    const response = await ApiUtils.apiPost<{document: {id: string}}>(
      '/api/v1/process-document/operation/new-document-and-start-process',
      {
        processDefinitionKey: data.caseDefinitionKey,
        request: {
          definition: data.caseDefinitionKey,
          caseDefinitionKey: data.caseDefinitionKey,
          caseDefinitionVersionTag: data.versionTag,
          content: {children},
        },
      }
    );
    return response.document.id;
  }

  async function openTableWidget(caseId: string): Promise<Locator> {
    await page.goto(`/cases/${data.caseDefinitionKey}/document/${caseId}/${data.tabKey}`);
    const tile = page
      .locator('.valtimo-widget-table')
      .filter({has: page.locator('.widget-title', {hasText: data.widgetTitle})});
    await expect(tile).toBeVisible({timeout: 30_000});
    return tile;
  }

  function messageCell(tile: Locator): Locator {
    return tile.getByTestId('carbonListNoResults').locator('td').first();
  }

  test.beforeAll(async ({browser, baseURL}) => {
    test.setTimeout(120_000);
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    widgetsPage = new CaseDetailsManagementWidgetsPage(page, context.request);

    await replaceTableWidget(tableWidget);
    emptyCaseId = await createCase([]);
    oneRowCaseId = await createCase([data.child]);
  });

  test.afterAll(async () => {
    await replaceTableWidget(null).catch(() => undefined);
    for (const id of [emptyCaseId, oneRowCaseId].filter(Boolean)) {
      await ApiUtils.apiDelete(`/api/v1/document/${id}`).catch(() => undefined);
    }
    if (context) await context.close();
  });

  test('An empty table shows its columns and one message row, no taller than a one-row table', async () => {
    const oneRowTile = await openTableWidget(oneRowCaseId);
    await expect(oneRowTile.locator('tbody tr', {hasText: data.child.name})).toBeVisible();
    const oneRowHeight = (await oneRowTile.boundingBox())!.height;

    const emptyTile = await openTableWidget(emptyCaseId);
    await expect(messageCell(emptyTile)).toBeVisible();

    await expect(emptyTile.locator('thead th')).toHaveText(data.columnTitles);
    await expect(messageCell(emptyTile)).toHaveText(data.defaultMessage);
    await expect(emptyTile.locator('tbody tr')).toHaveCount(1);
    await expect(emptyTile.locator('valtimo-no-results')).toHaveCount(0);

    const emptyHeight = (await emptyTile.boundingBox())!.height;
    expect(emptyHeight).toBeLessThanOrEqual(oneRowHeight);
  });

  test('The empty table message set in the widget modal is saved and shown on the case', async () => {
    test.setTimeout(90_000);
    await page.goto(
      `/case-management/case/${data.caseDefinitionKey}/version/${data.versionTag}/case-details/widget-tab/${data.tabKey}`
    );
    await widgetsPage.openWidgetEditWizard(data.widgetTitle);
    await widgetsPage.goToTableContentStep();

    await widgetsPage.fillTableNoDataMessage(data.configuredMessage);
    await widgetsPage.goToDisplayConditionsStep();
    await widgetsPage.wizardSaveButton.click();
    await widgetsPage.waitForWizardClosed();

    await expect
      .poll(async () => (await savedTableProperties())?.noDataMessage)
      .toBe(data.configuredMessage);

    const emptyTile = await openTableWidget(emptyCaseId);
    await expect(messageCell(emptyTile)).toHaveText(data.configuredMessage);
    await expect(emptyTile.locator('thead th')).toHaveText(data.columnTitles);
    const tileBox = (await emptyTile.boundingBox())!;
    const cellBox = (await messageCell(emptyTile).boundingBox())!;
    expect(cellBox.x + cellBox.width).toBeLessThanOrEqual(tileBox.x + tileBox.width);
    const lastHeaderBox = (await emptyTile.locator('thead th').last().boundingBox())!;
    expect(lastHeaderBox.x + lastHeaderBox.width).toBeLessThanOrEqual(tileBox.x + tileBox.width);
  });

  test('The saved message is prefilled when the widget is edited, and clearing it removes it', async () => {
    test.setTimeout(90_000);
    await page.goto(
      `/case-management/case/${data.caseDefinitionKey}/version/${data.versionTag}/case-details/widget-tab/${data.tabKey}`
    );
    await widgetsPage.openWidgetEditWizard(data.widgetTitle);
    await widgetsPage.goToTableContentStep();

    await expect(widgetsPage.tableNoDataMessageInput).toHaveValue(data.configuredMessage);

    await widgetsPage.fillTableNoDataMessage('');
    await widgetsPage.goToDisplayConditionsStep();
    await widgetsPage.wizardSaveButton.click();
    await widgetsPage.waitForWizardClosed();

    await expect
      .poll(async () => (await savedTableProperties()) ?? {})
      .not.toHaveProperty('noDataMessage');
    await expect.poll(async () => (await savedTableProperties())?.collection).toBe('doc:children');

    const emptyTile = await openTableWidget(emptyCaseId);
    await expect(messageCell(emptyTile)).toHaveText(data.defaultMessage);
  });
});
