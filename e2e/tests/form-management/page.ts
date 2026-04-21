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

import {type APIRequestContext, type Locator, type Page, expect} from '@playwright/test';
import {CarbonList} from '../../shared/carbon-list/carbon-list.utils';

export class FormManagementPage {
  readonly carbonList: CarbonList;
  private readonly formListScope: Locator;

  constructor(
    private readonly page: Page,
    private readonly request: APIRequestContext
  ) {
    this.formListScope = page.locator('valtimo-form-management-list');
    this.carbonList = new CarbonList(page, this.formListScope);
  }

  // ─── Navigation ────────────────────────────────────────────────────

  async goToFormManagement() {
    await this.page.getByRole('button', {name: 'Admin'}).click();
    await this.page.getByRole('link', {name: 'Forms', exact: true}).click();
    await this.page.waitForURL(/\/form-management$/);
    await this.carbonList.waitForLoaded();
  }

  // ─── List assertions ──────────────────────────────────────────────

  async assertListLoaded() {
    await this.carbonList.waitForLoaded();
    await expect(this.carbonList.table).toBeVisible();
  }

  async assertFormVisible(formName: string) {
    const row = this.carbonList.row(formName);
    await row.assertVisible();
  }

  async assertFormNotVisible(formName: string) {
    const row = this.carbonList.row(formName);
    await row.assertNotVisible();
  }
}
