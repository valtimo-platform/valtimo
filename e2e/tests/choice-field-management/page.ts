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

import {expect, type Page} from '@playwright/test';
import {CarbonList} from '../../shared/carbon-list/carbon-list.utils';
import * as ApiUtils from '../../utils/api.utils';
import {endpoints} from '../../api/endpoints';

interface ChoiceField {
  id: string;
  keyName: string;
  title: string;
}

interface ChoiceFieldValue {
  id: string;
  name: string;
  value: string;
  sortOrder: number;
  deprecated: boolean;
}

export class ChoiceFieldManagementPage {
  readonly carbonList: CarbonList;

  constructor(private readonly page: Page) {
    this.carbonList = new CarbonList(this.page);
  }

  // ─── Locators ─────────────────────────────────────────────────────

  get keyNameInput() {
    return this.page.locator('#keyName');
  }

  get titleInput() {
    return this.page.locator('#title');
  }

  get nameInput() {
    return this.page.locator('#name');
  }

  get valueInput() {
    return this.page.locator('#value');
  }

  get sortOrderInput() {
    return this.page.locator('#sortOrder');
  }

  get submitButton() {
    return this.page.getByRole('button', {name: 'Submit'});
  }

  get deleteButton() {
    return this.page.getByRole('button', {name: 'Delete'});
  }

  get createButton() {
    return this.page.getByRole('button', {name: /Create new Choice field/}).first();
  }

  get createValueButton() {
    return this.page.getByRole('button', {name: /Create new Choice field value/});
  }

  // ─── Navigation ───────────────────────────────────────────────────

  async goToChoiceFields() {
    const adminButton = this.page.getByRole('button', {name: 'Admin'});
    if ((await adminButton.getAttribute('aria-expanded')) !== 'true') {
      await adminButton.click();
    }
    await this.page
      .locator('[data-testid="sidenav-item-Admin"]')
      .getByRole('link', {name: 'Choice fields'})
      .click();

    await this.page.waitForURL(/\/choice-fields($|\?)/, {timeout: 10_000});
    await this.carbonList.waitForLoaded();
  }

  // ─── Choice Field Actions ─────────────────────────────────────────

  async createChoiceField(keyName: string, title: string) {
    await this.createButton.click();
    await expect(this.keyNameInput).toBeVisible();

    await this.keyNameInput.fill(keyName);
    await this.titleInput.fill(title);
    await this.submitButton.click();

    // After create, navigates to detail page — wait for it
    await this.page.waitForURL(/\/choice-fields\/field\//);
  }

  async editChoiceFieldTitle(newTitle: string) {
    await expect(this.titleInput).toBeVisible();
    await this.titleInput.clear();
    await this.titleInput.fill(newTitle);
    await this.submitButton.click();

    // Wait for the success alert/response
    await this.page.waitForTimeout(500);
  }

  async deleteChoiceField() {
    await this.deleteButton.click();
    // Confirmation banner appears — has "Delete choice field?" text followed by Cancel + Delete
    await this.page.getByText('Delete choice field?').waitFor();
    await this.page.getByRole('button', {name: 'Delete'}).first().click();
    // Navigates back to list
    await this.page.waitForURL(/\/choice-fields$/, {timeout: 10_000});
    await this.carbonList.waitForLoaded();
  }

  // ─── Choice Field Value Actions ───────────────────────────────────

  async createChoiceFieldValue(name: string, value: string, sortOrder: string) {
    await this.createValueButton.click();
    await expect(this.nameInput).toBeVisible();

    await this.nameInput.fill(name);
    await this.valueInput.fill(value);
    await this.sortOrderInput.clear();
    await this.sortOrderInput.fill(sortOrder);
    await this.submitButton.click();

    // After create, navigates back to detail page
    await this.page.waitForURL(/\/choice-fields\/field\/[^/]+$/);
  }

  async editChoiceFieldValue(newValue: string) {
    await expect(this.valueInput).toBeVisible();
    await this.valueInput.clear();
    await this.valueInput.fill(newValue);
    await this.submitButton.click();

    // Wait for the success response
    await this.page.waitForTimeout(500);
  }

  // ─── API Helpers ──────────────────────────────────────────────────

  async createChoiceFieldViaApi(keyName: string, title: string): Promise<ChoiceField> {
    return ApiUtils.apiPost<ChoiceField>(endpoints.choiceField.create, {keyName, title});
  }

  async deleteChoiceFieldViaApi(id: string) {
    try {
      await ApiUtils.apiDelete(endpoints.choiceField.delete(id));
    } catch {
      // May already be deleted
    }
  }

  async getChoiceFieldsViaApi(): Promise<ChoiceField[]> {
    return ApiUtils.apiGet<ChoiceField[]>(endpoints.choiceField.getAll);
  }

  async deleteTestChoiceFieldsViaApi(keyPrefix: string) {
    try {
      const fields = await this.getChoiceFieldsViaApi();
      for (const field of fields) {
        if (field.keyName.startsWith(keyPrefix)) {
          await this.deleteChoiceFieldViaApi(field.id);
        }
      }
    } catch {
      // Fields may not exist
    }
  }

  async getChoiceFieldValuesByKeyViaApi(keyName: string): Promise<ChoiceFieldValue[]> {
    return ApiUtils.apiGet<ChoiceFieldValue[]>(endpoints.choiceField.values(keyName));
  }
}
