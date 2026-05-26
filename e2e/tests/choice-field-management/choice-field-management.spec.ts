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
import {createChoiceFieldTestData, createChoiceFieldValueTestData} from './choice-field-management-config';
import {ChoiceFieldManagementPage} from './page';
import {CarbonList} from '../../shared/carbon-list/carbon-list.utils';

test.use({storageState: undefined});

// ─── Choice field definition tests ──────────────────────────────────

test.describe('Choice field management — Manage definitions', () => {
  let context;
  let page;
  let choiceFieldPage: ChoiceFieldManagementPage;

  const testData = createChoiceFieldTestData();
  let createdId: string;

  test.beforeAll(async ({browser, baseURL}) => {
    context = await browser.newContext({baseURL: baseURL ?? 'http://localhost:4200'});
    page = await context.newPage();
    choiceFieldPage = new ChoiceFieldManagementPage(page);

    await page.goto('/');

    // Clean up stale test data
    await choiceFieldPage.deleteTestChoiceFieldsViaApi('e2e_test_');

    await choiceFieldPage.goToChoiceFields();
  });

  test.afterAll(async () => {
    // Clean up
    if (createdId) {
      await choiceFieldPage.deleteChoiceFieldViaApi(createdId);
    }
    await choiceFieldPage.deleteTestChoiceFieldsViaApi('e2e_test_');
    await context.close();
  });

  test('Create a new choice field', async () => {
    await choiceFieldPage.createChoiceField(testData.keyName, testData.title);

    // Should be on detail page now
    await expect(page).toHaveURL(/\/choice-fields\/field\//);

    // Extract the ID from the page for cleanup
    const fields = await choiceFieldPage.getChoiceFieldsViaApi();
    const created = fields.find(f => f.keyName === testData.keyName);
    expect(created).toBeTruthy();
    createdId = created!.id;
  });

  test('View choice field in list', async () => {
    await choiceFieldPage.goToChoiceFields();
    const list = new CarbonList(page);
    await list.waitForLoaded();
    await list.search(testData.keyName);
    await expect(list.rows).toHaveCount(1);

    const row = list.row(testData.keyName);
    await row.assertVisible();
  });

  test('Edit choice field title', async () => {
    const list = new CarbonList(page);
    await list.search(testData.keyName);
    await expect(list.rows).toHaveCount(1);

    const row = list.row(testData.keyName);
    await row.click();

    await choiceFieldPage.editChoiceFieldTitle(testData.editedTitle);

    // Navigate back to list and verify
    await choiceFieldPage.goToChoiceFields();
    const updatedList = new CarbonList(page);
    await updatedList.waitForLoaded();

    await updatedList.search(testData.keyName);
    await expect(updatedList.rows).toHaveCount(1);

    const updatedRow = updatedList.row(testData.keyName);
    await updatedRow.assertVisible();
  });

  test('Delete choice field', async () => {
    const list = new CarbonList(page);
    await list.search(testData.keyName);
    await expect(list.rows).toHaveCount(1);

    const row = list.row(testData.keyName);
    await row.click();

    await choiceFieldPage.deleteChoiceField();

    // After delete, search persists. Re-apply filter to verify the row is gone.
    const updatedList = new CarbonList(page);
    await updatedList.search(testData.keyName);
    await updatedList.assertNoResults();

    createdId = ''; // Already deleted
  });
});

// ─── Choice field value tests ───────────────────────────────────────

test.describe('Choice field management — Add/edit/delete choice options', () => {
  let context;
  let page;
  let choiceFieldPage: ChoiceFieldManagementPage;

  const fieldData = createChoiceFieldTestData();
  const valueData = createChoiceFieldValueTestData();
  let choiceFieldId: string;

  test.beforeAll(async ({browser, baseURL}) => {
    context = await browser.newContext({baseURL: baseURL ?? 'http://localhost:4200'});
    page = await context.newPage();
    choiceFieldPage = new ChoiceFieldManagementPage(page);

    await page.goto('/');

    // Clean up stale data and create a choice field via API
    await choiceFieldPage.deleteTestChoiceFieldsViaApi('e2e_test_');
    const created = await choiceFieldPage.createChoiceFieldViaApi(fieldData.keyName, fieldData.title);
    choiceFieldId = created.id;

    // Navigate to the choice field detail page
    await page.goto(`/choice-fields/field/${choiceFieldId}`);
    await page.waitForSelector('valtimo-choice-field-value-list');
  });

  test.afterAll(async () => {
    // Clean up
    await choiceFieldPage.deleteChoiceFieldViaApi(choiceFieldId);
    await choiceFieldPage.deleteTestChoiceFieldsViaApi('e2e_test_');
    await context.close();
  });

  test('Create a new choice field value', async () => {
    await choiceFieldPage.createChoiceFieldValue(valueData.name, valueData.value, valueData.sortOrder);

    // Should be back on the detail page with the value list
    const list = new CarbonList(page);
    await list.waitForLoaded();
    const row = list.row(valueData.name);
    await row.assertVisible();
  });

  test('View value in list', async () => {
    const list = new CarbonList(page);
    await list.waitForLoaded();

    const row = list.row(valueData.name);
    await row.assertVisible();
  });

  test('Edit choice field value', async () => {
    const list = new CarbonList(page);
    const row = list.row(valueData.name);
    await row.click();

    await choiceFieldPage.editChoiceFieldValue(valueData.editedValue);

    // Navigate back to the detail page
    await page.getByRole('link', {name: 'Back', exact: true}).click();
    await page.waitForSelector('valtimo-choice-field-value-list');

    const updatedList = new CarbonList(page);
    await updatedList.waitForLoaded();

    const updatedRow = updatedList.row(valueData.name);
    await updatedRow.assertVisible();
  });
});
