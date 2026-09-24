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

import {expect, test, type BrowserContext, type Page} from '@playwright/test';
import {VSelect} from '../../shared/v-select/v-select.utils';

/** A new entry must start on the version its target links, not the newest deployed; `verhuizing:1.0.11` links `inspectie-fotos:1.0.0` while `1.0.1` is newer, so the two differ. */
test.describe('Migration plan editor — new building-block entry version default', () => {
  test.use({storageState: undefined});
  test.skip(
    !process.env.MIGRATION_UI_REPLAY,
    'Set MIGRATION_UI_REPLAY=1 to run — it needs the dev fixtures.'
  );

  const CASE = 'verhuizing';
  const VERSION = '1.0.11';
  const BLOCK = 'inspectie-fotos';
  const LINKED_VERSION = '1.0.0';
  const NEWEST_DEPLOYED = '1.0.1';

  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({browser, baseURL}) => {
    context = await browser.newContext({baseURL, storageState: 'playwright/.auth/uiState.json'});
    page = await context.newPage();
    await page.goto('/');
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('defaults to the linked version, not the newest deployed', async () => {
    test.setTimeout(180_000);

    await page.goto(`/case-management/case/${CASE}/version/${VERSION}/migration/create`);
    await expect(page.locator('.migration-tab__loading')).toHaveCount(0, {timeout: 60_000});

    await page.getByRole('tab', {name: 'Add building block', exact: true}).click();
    const pane = page.getByTestId('caseMigrationAddBuildingBlockTab');
    await pane.getByTestId('caseMigrationAddBuildingBlockButton').first().click();

    const card = pane.locator('.migration-tab__card').last();
    await new VSelect(
      page,
      card.locator('v-select[formcontrolname="buildingBlockKey"]')
    ).selectByLabel(`Inspectiefoto's (${BLOCK})`);

    // The version picker is filled by the key subscription, so read it rather than the plan JSON.
    const version = new VSelect(
      page,
      card.locator('v-select[formcontrolname="buildingBlockVersionTag"]')
    );
    await expect(version.input).toHaveValue(LINKED_VERSION, {timeout: 30_000});
    await expect(version.input).not.toHaveValue(NEWEST_DEPLOYED);
  });
});
