import {APIRequestContext, expect, Page} from '@playwright/test';
import {CarbonList} from '../../shared/carbon-list/carbon-list.utils';

export class CaseDetailsManagementSearchFieldsPage {
  constructor(
    private readonly page: Page,
    private readonly request: APIRequestContext
  ) {}

  // Navigation tabs
  get searchFieldsTab() {
    return this.page.locator('#caseManagementListSearchFields-header');
  }

  get listTab() {
    return this.page.locator('#case-list-header');
  }

  // Version dropdown
  get versionSelectDropdown() {
    return this.page.getByTestId('caseVersionSelectDropdown');
  }

  // Toolbar buttons (data-test-id → getByTestId)
  get switchViewButton() {
    return this.page.getByTestId('case-management-search-fields-switch-view');
  }

  get addSearchFieldButton() {
    return this.page.getByTestId('case-management-search-add');
  }

  // JSON editor
  get searchFieldJSONEditor() {
    return this.page.locator('valtimo-json-editor');
  }

  // Search fields list
  get searchFieldsList() {
    return this.page.getByTestId('searchFieldsList');
  }

  // Modal form fields (v-input/v-select render as data-testid → locator)
  get titleInput() {
    return this.page.locator('[data-testid="case-management-search-title"]');
  }

  get keyInput() {
    return this.page.locator('[data-testid="case-management-search-key"]');
  }

  get dataTypeDropdown() {
    return this.page.locator('[data-testid="case-management-search-dataTypes"]');
  }

  get fieldTypeDropdown() {
    return this.page.locator('[data-testid="case-management-search-fieldTypes"]');
  }

  get matchTypeDropdown() {
    return this.page.locator('[data-testid="case-management-search-matchTypes"]');
  }

  // Value path selector (uses data-test-id on inner elements)
  get valuePathSelectorToggle() {
    return this.page
      .locator('valtimo-value-path-selector')
      .getByTestId('valuePathSelectorToggle')
      .locator('.cds--toggle__switch');
  }

  get valuePathSelectorInput() {
    return this.page.locator('valtimo-value-path-selector').getByTestId('valuePathSelectorInput');
  }

  // Modal buttons (data-test-id → getByTestId)
  get saveButton() {
    return this.page.getByTestId('case-management-search-save');
  }

  get cancelButton() {
    return this.page.getByTestId('case-management-search-close');
  }

  // Navigation
  async goToCaseDetailsManagement(caseIdentifier: string) {
    await this.page.getByRole('button', {name: 'Admin'}).click();
    await this.page.getByRole('link', {name: 'Cases'}).click();
    await this.page.waitForSelector('valtimo-carbon-list');
    await this.page.locator(`tr:has(td:has-text("${caseIdentifier}"))`).click();
    await this.listTab.click();
  }

  async switchCaseVersionViaDropdown(caseVersion: string) {
    await this.versionSelectDropdown.click();
    await this.page.getByRole('listbox').getByTestId(`caseVersion${caseVersion}`).click();
  }

  // Dropdown selection helper
  async selectDropdownItem(dropdownLocator: ReturnType<Page['locator']>, itemText: string) {
    await dropdownLocator.click();
    await this.page.getByRole('listbox').getByText(itemText, {exact: true}).click();
  }

  // UI CRUD helpers
  async createSearchField(field: {
    key: string;
    title?: string;
    path: string;
    dataType: string;
    fieldType: string;
    matchType?: string;
  }) {
    await this.addSearchFieldButton.click();

    if (field.title) {
      await this.titleInput.fill(field.title);
    }

    await this.keyInput.fill(field.key);

    await this.valuePathSelectorToggle.click();
    await this.valuePathSelectorInput.fill(field.path);

    await this.selectDropdownItem(this.dataTypeDropdown, field.dataType);

    await this.selectDropdownItem(this.fieldTypeDropdown, field.fieldType);

    if (field.matchType) {
      const matchTypeVisible = await this.matchTypeDropdown.isVisible();
      if (matchTypeVisible) {
        await this.selectDropdownItem(this.matchTypeDropdown, field.matchType);
      }
    }

    await this.saveButton.click();
  }

  async editSearchFieldTitle(fieldKey: string, newTitle: string) {
    await this.page.locator(`tr:has(td[title="${fieldKey}"])`).click();
    await this.titleInput.clear();
    await this.titleInput.fill(newTitle);
    await this.saveButton.click();
  }

  async deleteSearchField(fieldKey: string) {
    const list = new CarbonList(this.page);
    const row = list.row(fieldKey);
    await row.clickAction('Delete');
    await this.page.getByRole('button', {name: 'Delete', exact: true}).click();
  }

  // Assertions
  async assertSearchFieldExists(fieldKey: string) {
    await expect(this.page.locator(`td[title="${fieldKey}"]`).first()).toBeVisible();
  }

  async assertSearchFieldNotExists(fieldKey: string) {
    await expect(this.page.locator(`td[title="${fieldKey}"]`)).toHaveCount(0);
  }

  async assertSaveButtonDisabled() {
    await expect(this.saveButton).toBeDisabled();
  }

  async checkSearchFieldsExisting(keys: string[]) {
    for (const key of keys) {
      await expect(this.page.locator(`td[title="${key}"]`)).toBeTruthy();
    }
  }
}
