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
import {apiDelete, apiGet, apiPost, apiPostMultipart} from '../../utils/api.utils';
import {FORM_MANAGEMENT_EDIT_TEST_IDS} from '../../constants';
import {FORM_IN_USE_API} from './form-management-config';

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

  // Navigate directly to the forms route — avoids loading the chart-heavy
  // dashboard (+ SSE) via the Admin menu, which crashes the Chromium renderer
  // ("Target crashed") on this heavy list route.
  async goToFormManagement() {
    await this.page.goto('/form-management');
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

  // ─── Delete ───────────────────────────────────────────────────────

  async goToFormEditPage(formName: string) {
    await this.goToFormManagement();
    await this.carbonList.search(formName);
    await this.carbonList.waitForLoaded();
    await this.carbonList.row(formName).click();
    await this.page.waitForURL(/\/form-management\/[0-9a-f-]{36}$/);
    await expect(this.page.getByTestId(FORM_MANAGEMENT_EDIT_TEST_IDS.saveButton)).toBeVisible();
  }

  async deleteFromList(formName: string) {
    await this.carbonList.row(formName).clickAction('Delete');
    await this.confirmDelete();
  }

  async deleteFromEditPage() {
    await this.page.locator('.valtimo-form-management-edit__header .v-overflow-menu__trigger').click();
    await this.page.getByRole('menu').getByRole('menuitem', {name: 'Delete'}).click();
    await this.confirmDelete();
  }

  private async confirmDelete() {
    await this.page.locator('cds-modal').getByRole('button', {name: 'Delete'}).click();
  }

  toasts(text: string | RegExp): Locator {
    return this.page.locator('cds-toast, cds-actionable-notification').filter({hasText: text});
  }

  // ─── API setup / cleanup ──────────────────────────────────────────

  async createGlobalFormViaApi(name: string): Promise<string> {
    const response = await apiPost<{id: string}>(FORM_IN_USE_API.form, {
      name,
      formDefinition: JSON.stringify({display: 'form', components: []}),
    });
    return response.id;
  }

  async deleteGlobalFormViaApi(formId: string) {
    await apiDelete(`${FORM_IN_USE_API.form}/${formId}`);
  }

  async deployGlobalProcessViaApi(key: string, bpmn: Buffer): Promise<string> {
    await apiPostMultipart(FORM_IN_USE_API.processDefinition, {
      file: {name: `${key}.bpmn`, mimeType: 'text/xml', buffer: bpmn},
      processLinks: {name: 'processLinks.json', mimeType: 'application/json', buffer: Buffer.from('[]')},
    });
    const definitions = await apiGet<Array<{processDefinition: {id: string}}>>(
      FORM_IN_USE_API.processDefinitionByKey(key)
    );
    return definitions[definitions.length - 1].processDefinition.id;
  }

  async deleteGlobalProcessViaApi(key: string) {
    try {
      await apiDelete(FORM_IN_USE_API.processDefinitionByKey(key));
    } catch {
      // Already gone, or never deployed.
    }
  }

  async createFormProcessLinkViaApi(
    processDefinitionId: string,
    activityId: string,
    formDefinitionId: string
  ): Promise<string> {
    await apiPost(FORM_IN_USE_API.processLink, {
      processLinkType: 'form',
      processDefinitionId,
      activityId,
      activityType: 'bpmn:UserTask:create',
      formDefinitionId,
    });
    const links = await apiGet<Array<{id: string; activityId: string}>>(
      `${FORM_IN_USE_API.processLink}?processDefinitionId=${encodeURIComponent(processDefinitionId)}`
    );
    const link = links.find(candidate => candidate.activityId === activityId);
    if (!link) throw new Error(`No process link found for ${processDefinitionId} / ${activityId}`);
    return link.id;
  }

  async deleteProcessLinkViaApi(processLinkId: string) {
    await apiDelete(`${FORM_IN_USE_API.processLink}/${processLinkId}`);
  }
}
