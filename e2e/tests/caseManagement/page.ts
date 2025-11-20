import { Page, expect } from '@playwright/test';
import { smartStep } from '../../../utils/smartStep';
import { waitForResponse } from '../../../components/request';
import { endpoints } from '../../../api/endpoints';
import { apiGet, apiDelete, apiPost } from '../../../utils/api.utils';

export class CaseDefinitionPage {
  private readonly addButton;
  private readonly table;

  constructor(private readonly page: Page) {
    this.addButton = page.getByRole('button', { name: 'Create' });
    this.table = page.locator('table'); // assuming tabular list of case types
  }

  /** Navigate to Admin ▸ Cases */
  async goto() {
    return smartStep('case', 'navigate', 'UI', async () => {
      await this.page.goto('/');
      await this.page.getByRole('button', { name: 'Admin' }).click();
      await this.page.getByRole('link', { name: 'Cases' }).click();
       // await this.page.locator('valtimo-carbon-list__toolbar')
      await expect(this.page.locator('.valtimo-carbon-list__toolbar').getByRole('button', { name: 'Create' })).toBeVisible()
    });
  }

  /** Create a new case definition (optionally with description) */
  async createCaseDefinition(key: string, opts?: { description?: string }) {
    return smartStep('case', 'create', 'UI', async () => {
      await this.addButton.click();
      await this.page.getByPlaceholder('Name').fill(key);
      await this.page.getByPlaceholder('version').fill('0.0.1');
      if (opts?.description) {
        await this.page.getByPlaceholder('Description').fill(opts.description);
      }
      await this.page.getByRole('button', { name: 'save' }).click();
    });
  }

  async assertByTitle(name: string) {
    return smartStep('case', 'Assert title is visible and matches set title', 'validate', async () => {
      await this.page.waitForTimeout(4000)
      await this.page.waitForSelector('h2.page-title', { state: 'visible' });
      const title = this.page.locator('h2.page-title');
      await expect(title).toHaveText(name);
    });
  }

  /** Open detail view for a case definition */
  async openCaseDefinition(key: string) {
    return smartStep('case', 'navigate detail', 'UI', async () => {
      await this.table.getByText(key, { exact: true }).click();
    });
  }

  /** Toggle the 'Case handler' setting (and optionally auto-assign) */
  async enableCaseHandler(autoAssign = false) {
    return smartStep('case', 'enable handler toggle', 'UI', async () => {
      await this.page.getByRole('switch', { name: 'Case type can have a handler' }).click();
      if (autoAssign) {
        const autoToggle = this.page.getByRole('switch', { name: /Automatically assign/i });
        await expect(autoToggle).toBeEnabled();
        await autoToggle.click();
      }
    });
  }

  /** Toggle and fill out external start form info */
  async configureExternalStartForm(url: string, description: string) {
    return smartStep('case', 'enable external form', 'UI', async () => {
      await this.page.getByRole('switch', { name: 'External start form enabled' }).click();
      await this.page.getByPlaceholder('Input a valid URL').fill(url);
      await this.page.getByPlaceholder('A short description of the external start form').fill(description);
    });
  }

  /** Select a process from dropdown (for upload linkage) */
  async linkUploadProcess(processName: string) {
    return smartStep('case', 'link upload process', 'UI', async () => {
      const dropdown = this.page.getByRole('combobox', { name: /Choose which process/i });
      await dropdown.click();
      await this.page.getByText(processName, { exact: true }).click();
    });
  }

  /** Save the case definition changes */
  async saveGeneralSettings(key: string) {
    return smartStep('case', 'save changes', 'UI', async () => {
      await this.page.getByRole('button', { name: 'Save' }).click();
    });
  }

  /** Delete the case via the UI overflow menu */
  async deleteCaseDefinition(key: string) {
    return smartStep('case', 'delete', 'UI', async () => {
      await this.page.getByRole('button', { name: 'Overflow' }).click();
      await this.page.getByRole('menuitem', { name: 'Delete' }).click();
      await Promise.all([
        waitForResponse(this.page, 'DELETE', endpoints.caseDefinition.delete(key)),
        this.page.getByRole('button', { name: 'Delete' }).click(),
      ]);
    });
  }

  /** Validate a case is not present in the table */
  async assertCaseNotExists(key: string) {
    return smartStep('case', 'validate not-exist', 'UI', async () => {
      const exists = await this.table.getByText(key, { exact: true }).isVisible();
      expect(exists).toBe(false);
    });
  }
}
