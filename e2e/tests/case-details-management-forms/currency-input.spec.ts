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

const CASE_KEY = 'bezwaar';
const CURRENCY_FORM_NAME = `aaa-e2e-currency-form-${Date.now()}`;
const EUROS_FIELD = {label: 'E2E Euros', key: 'e2eEuros'};
const CENTS_FIELD = {label: 'E2E Cents', key: 'e2eCents'};

test.use({storageState: undefined});

test.describe('Currency field input in a rendered form', () => {
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

    draftVersion = await formsPage.goToCaseForms(CASE_KEY);
    await formsPage.deleteFormByNameViaApi(CASE_KEY, draftVersion, CURRENCY_FORM_NAME);

    const formId = await formsPage.createFormWithCurrencyFieldsViaApi(
      CASE_KEY,
      draftVersion,
      CURRENCY_FORM_NAME,
      [EUROS_FIELD, CENTS_FIELD]
    );
    await formsPage.goToFormEditPage(CASE_KEY, draftVersion, formId);
    await formsPage.switchToOutputTab();
  });

  test.afterAll(async () => {
    await formsPage.deleteFormByNameViaApi(CASE_KEY, draftVersion, CURRENCY_FORM_NAME);
    await context.close();
  });

  test('Typed digits are whole euros, formatted once the field loses focus', async () => {
    const input = formsPage.previewCurrencyInputByLabel(EUROS_FIELD.label);
    await expect(input).toBeVisible();

    await input.click();
    await input.pressSequentially('51', {delay: 100});

    await expect(input).toHaveValue('51');
    await expect(formsPage.outputJsonView).toContainText(
      new RegExp(`"${EUROS_FIELD.key}":\\s*51(?![\\d.])`)
    );

    await input.press('Tab');

    await expect(input).toHaveValue(/^€\s51,00$/);
  });

  test('The comma starts the cents', async () => {
    const input = formsPage.previewCurrencyInputByLabel(CENTS_FIELD.label);
    await expect(input).toBeVisible();

    await input.click();
    await input.pressSequentially('5,1', {delay: 100});

    await expect(input).toHaveValue('5,1');
    await expect(formsPage.outputJsonView).toContainText(
      new RegExp(`"${CENTS_FIELD.key}":\\s*5\\.1(?![\\d.])`)
    );
  });
});
