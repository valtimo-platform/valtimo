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
import {randomUUID} from 'crypto';
import * as fs from 'fs';
import {endpoints} from '../../api/endpoints';
import {apiPost} from '../../utils/api.utils';
import {
  ALL_VARIABLES,
  BPMN_ASSET_PATH,
  DENIED_VARIABLES,
  DEPLOY_URL,
  GLOBALS_EXPECTATION,
  MANAGEMENT_DELETE_URL,
  MAP_EXPECTATIONS,
  PROCESS_KEY,
  START_VARIABLES,
  UNDEFINED_OR_DENIED_VARIABLES,
} from './script-sandbox-config';

test.use({storageState: undefined});

test.describe.configure({mode: 'serial'});

test.describe('Script sandbox', () => {
  let api: APIRequestContext;
  let instanceId: string;
  let variables: Record<string, string>;

  // Arrange: deploy the probe process and start it, so the script task runs and the user task keeps it alive
  test.beforeAll(async ({baseURL}) => {
    api = await apiRequest.newContext({
      baseURL,
      extraHTTPHeaders: {Authorization: `Bearer ${process.env.PLAYWRIGHT_BEARER_TOKEN}`},
    });
    await api.delete(MANAGEMENT_DELETE_URL);

    const deployed = await api.post(DEPLOY_URL, {
      multipart: {
        file: {
          name: `${PROCESS_KEY}.bpmn`,
          mimeType: 'text/xml',
          buffer: fs.readFileSync(BPMN_ASSET_PATH),
        },
      },
    });
    expect(deployed.ok()).toBeTruthy();

    const started = await api.post(
      endpoints.processDefinition.startByKeyAndBusinessKey(PROCESS_KEY, randomUUID()),
      {data: START_VARIABLES}
    );
    expect(started.status()).toBe(200);
    const body = await started.json();
    instanceId = body.id ?? body.processInstance?.id;
    expect(instanceId).toBeTruthy();

    variables = await apiPost<Record<string, string>>(
      endpoints.processInstance.variables(instanceId),
      ALL_VARIABLES
    );
  });

  test.afterAll(async () => {
    if (instanceId) await api.post(endpoints.processInstance.delete(instanceId));
    await api.delete(MANAGEMENT_DELETE_URL);
    await api.dispose();
  });

  test.describe('Scripts can still use collections', () => {
    for (const [name, expected] of Object.entries(MAP_EXPECTATIONS)) {
      test(`${name} works`, async () => {
        expect(variables[name]).toBe(expected);
      });
    }
  });

  test.describe('Sandbox still blocks escapes', () => {
    test('engine globals are not defined', async () => {
      expect(variables.engineGlobals).toBe(GLOBALS_EXPECTATION.engineGlobals);
    });

    for (const name of DENIED_VARIABLES) {
      test(`${name} is denied`, async () => {
        expect(variables[name]).toBe('denied');
      });
    }

    for (const name of UNDEFINED_OR_DENIED_VARIABLES) {
      test(`${name} is undefined or denied`, async () => {
        expect(['undefined', 'denied']).toContain(variables[name]);
      });
    }
  });
});
