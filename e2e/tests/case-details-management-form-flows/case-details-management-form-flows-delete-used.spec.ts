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

import {APIRequestContext, expect, request as apiRequest, test} from '@playwright/test';
import * as fs from 'fs';
import path from 'path';
import {CarbonList} from '../../shared/carbon-list/carbon-list.utils';
import {expectNotificationMessage} from '../../utils/ui.utils';
import {CASE_IDENTIFIER, createFormFlowTestData} from './case-details-management-form-flows';
import {CaseDetailsManagementFormFlowsPage} from './page';

const PROCESS_KEY = 'e2e-form-flow-delete-process';
const BPMN_ASSET_PATH = path.resolve(__dirname, '../../assets/e2e-form-flow-delete-process.bpmn');

test.use({storageState: undefined});

test.describe.configure({mode: 'serial'});

test.describe('Case details management — Form Flows — delete a form flow that has instances', () => {
  let context;
  let page;
  let formFlowsPage: CaseDetailsManagementFormFlowsPage;
  let api: APIRequestContext;
  let draftVersion: string;

  const formFlowTestData = createFormFlowTestData();
  const managementBase = () =>
    `/api/management/v1/case-definition/${CASE_IDENTIFIER}/version/${draftVersion}`;

  // Arrange: a form flow on the draft, started once through a process start form, so it has an unfinished instance
  test.beforeAll(async ({browser, baseURL}) => {
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    formFlowsPage = new CaseDetailsManagementFormFlowsPage(page, context.request);
    api = await apiRequest.newContext({
      baseURL,
      extraHTTPHeaders: {Authorization: `Bearer ${process.env.PLAYWRIGHT_BEARER_TOKEN}`},
    });

    await formFlowsPage.goToCaseManagement(CASE_IDENTIFIER);
    draftVersion = await formFlowsPage.ensureDraftVersionSelected();
    await api.delete(`${managementBase()}/process-definition/key/${PROCESS_KEY}`);

    const created = await api.post(`${managementBase()}/form-flow-definition`, {
      data: {
        key: formFlowTestData.key,
        startStep: 'step1',
        steps: [{key: 'step1', type: {name: 'form', properties: {definition: ''}}, nextSteps: []}],
      },
    });
    expect(created.ok()).toBeTruthy();

    const deployed = await api.post(`${managementBase()}/process-definition`, {
      multipart: {
        file: {
          name: `${PROCESS_KEY}.bpmn`,
          mimeType: 'text/xml',
          buffer: fs.readFileSync(BPMN_ASSET_PATH),
        },
        processLinks: {
          name: 'processLinks.json',
          mimeType: 'application/json',
          buffer: Buffer.from(
            JSON.stringify([
              {
                processDefinitionId: '',
                activityId: 'StartEvent_1',
                activityType: 'bpmn:StartEvent:start',
                processLinkType: 'form-flow',
                formFlowDefinitionKey: formFlowTestData.key,
              },
            ])
          ),
        },
      },
    });
    expect(deployed.ok()).toBeTruthy();

    const processDefinition = await (
      await api.get(`${managementBase()}/process-definition/key/${PROCESS_KEY}`)
    ).json();
    const startForm = await (
      await api.get(
        `/api/v1/process-definition/${processDefinition.processDefinition.id}/start-form?documentDefinitionName=${CASE_IDENTIFIER}`
      )
    ).json();
    expect(startForm.properties.formFlowInstanceId).toBeTruthy();

    await page.reload();
    await formFlowsPage.switchToFormFlowsTab();
  });

  test.afterAll(async () => {
    await api.delete(`${managementBase()}/process-definition/key/${PROCESS_KEY}`);
    await api.delete(`${managementBase()}/form-flow-definition/${formFlowTestData.key}`);
    await api.dispose();
    if (context) await context.close();
  });

  test('The delete confirmation warns that unfinished instances are deleted too', async () => {
    // Act
    await new CarbonList(page).row(formFlowTestData.key).clickAction('Delete');

    // Assert
    await expect(
      page.getByText(
        'All form flow instances of this definition, including unfinished ones, will also be deleted. This action cannot be undone.'
      )
    ).toBeVisible();
  });

  test('Confirming deletes the form flow', async () => {
    // Act
    await page.getByRole('button', {name: 'Delete'}).click();

    // Assert
    await expectNotificationMessage(page, `${formFlowTestData.key} was deleted successfully`);
    await formFlowsPage.assertFormFlowNotExists(formFlowTestData.key);
    const definition = await api.get(`${managementBase()}/form-flow-definition/${formFlowTestData.key}`);
    expect(definition.ok()).toBeFalsy();
  });
});
