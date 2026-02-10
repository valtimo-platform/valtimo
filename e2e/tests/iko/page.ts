import {expect, Page} from '@playwright/test';
import {apiDelete} from '../../utils/api.utils';
import {endpoints} from '../../api/endpoints';
import {
  IkoPropertyField,
  serverConfiguration,
  viewConfiguration,
} from './iko-config';

export class IkoPage {
  constructor(private readonly page: Page) {}

  // UI Elements — Server
  get addApiConfigButton() {
    return this.page.getByTestId('ikoApiAddButton');
  }

  get apiTitleInput() {
    return this.page.getByTestId('ikoApiTitleInput');
  }

  get apiSaveButton() {
    return this.page.getByTestId('ikoApiSaveButton');
  }

  get apiCancelButton() {
    return this.page.getByTestId('ikoApiCancelButton');
  }

  // UI Elements — View
  get addViewButton() {
    return this.page.getByTestId('ikoViewsAddButton');
  }

  get viewTitleInput() {
    return this.page.getByTestId('ikoViewTitleInput');
  }

  get viewSaveButton() {
    return this.page.getByTestId('ikoViewSaveButton');
  }

  get viewCancelButton() {
    return this.page.getByTestId('ikoViewCancelButton');
  }

  // Navigation
  async goToIkoManagement() {
    console.log('Navigate to IKO Management...');
    await this.page.getByRole('button', {name: 'Admin'}).click();
    await this.page.getByRole('link', {name: 'IKO'}).click();
    await this.page.waitForSelector('valtimo-carbon-list');
  }

  // Server operations
  async openServerModal() {
    await this.addApiConfigButton.click();
    await expect(this.apiTitleInput).toBeVisible();
  }

  async fillPropertyFields(fields: IkoPropertyField[]) {
    for (const field of fields) {
      const input = this.page.getByTestId(field.testId);
      await expect(input).toBeVisible();
      await input.fill(field.value);
    }
  }

  async fillServerForm() {
    await this.apiTitleInput.fill(serverConfiguration.title);
    await this.fillPropertyFields(serverConfiguration.propertyFields);
  }

  async saveServerConfiguration() {
    await expect(this.apiSaveButton).toBeEnabled();
    await this.apiSaveButton.click();
  }

  // View operations
  async clickServerRow(title: string) {
    await this.page.getByRole('cell', {name: title}).click();
    await this.page.waitForSelector('valtimo-carbon-list');
  }

  async openViewModal() {
    await this.addViewButton.first().click();
    await expect(this.viewTitleInput).toBeVisible();
  }

  async fillViewForm() {
    await this.viewTitleInput.fill(viewConfiguration.title);
    await this.fillPropertyFields(viewConfiguration.propertyFields);
  }

  async saveViewConfiguration() {
    await expect(this.viewSaveButton).toBeEnabled();
    await this.viewSaveButton.click();
  }

  // Assertions
  async assertServerExists(title: string) {
    await expect(this.page.getByRole('cell', {name: title})).toBeVisible();
  }

  async assertViewExists(title: string) {
    await expect(this.page.getByRole('cell', {name: title})).toBeVisible();
  }

  // Cleanup (API)
  async deleteTestView() {
    try {
      await apiDelete(endpoints.iko.deleteView(viewConfiguration.key));
    } catch (e) {
      console.log('View cleanup skipped (may not exist):', e);
    }
  }

  async deleteTestServer() {
    try {
      await apiDelete(endpoints.iko.deleteRepositoryConfig(serverConfiguration.key));
    } catch (e) {
      console.log('Server cleanup skipped (may not exist):', e);
    }
  }

  async cleanupAll() {
    // Delete child before parent
    await this.deleteTestView();
    await this.deleteTestServer();
  }
}
