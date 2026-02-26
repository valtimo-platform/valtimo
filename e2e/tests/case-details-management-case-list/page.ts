import {APIRequestContext, Page, expect} from '@playwright/test';
import {clearMonacoEditor, pasteToMonacoEditor} from '../../utils/monaco.utils';

export interface UploadCaseOptions {
  archiveName?: string;
}

export class CaseDetailsManagementCaseListPage {
  constructor(private readonly page: Page, private readonly request: APIRequestContext) {}

  // UI Elements
  get versionSelectDropdown() {
    return this.page.getByTestId('caseVersionSelectDropdown');
  }

  get listColumnsTab() {
    return this.page.locator('#caseManagementListColumns-header');
  }

  get searchFieldsTab() {
    return this.page.getByTestId('caseManagementListSearchFields');
  }

  get listTab() {
    return this.page.locator('#case-list-header');
  }

  get caseListColumnsList() {
    return this.page.getByTestId('caseListColumnsList');
  }

  get addListColumnButton() {
    return this.page.getByTestId('caseManagementAddListColumn');
  }

  get titleInput() {
    return this.page.getByTestId('listColumnTitle');
  }

  get keyInput() {
    return this.page.getByTestId('listColumnKey');
  }

  get valuePathSelectorToggle() {
    return this.page
      .getByTestId('listColumnValuePathSelector')
      .getByTestId('valuePathSelectorToggle')
      .locator('.cds--toggle__switch');
  }

  get valuePathSelectorInput() {
    return this.page
      .getByTestId('listColumnValuePathSelector')
      .getByTestId('valuePathSelectorInput');
  }

  get valuePathSelectorPath() {
    return this.page
      .getByTestId('listColumnValuePathSelector')
      .getByTestId('valueValuePathSelectorPath');
  }

  get displayTypeDropdown() {
    return this.page.getByTestId('listColumnDisplayType');
  }

  get tagAmount() {
    return this.page.getByTestId('listColumnTagAmount');
  }

  get dateFormat() {
    return this.page.getByTestId('listColumnDateFormat');
  }

  get sortableCheckbox() {
    return this.page.getByTestId('listColumnSortableCheckbox');
  }

  get defaultSortDropdown() {
    return this.page.getByTestId('listColumnDefaultSort');
  }

  get exportableToggle() {
    return this.page.getByTestId('listColumnExportable').locator('.cds--toggle__switch');
  }

  get listColumnCancelButton() {
    return this.page.getByTestId('listColumnCancelButton');
  }

  get listColumnSaveButton() {
    return this.page.getByTestId('listColumnSaveButton');
  }

  get confirmationModalCloseButton() {
    return this.page
      .getByTestId('listColumnConfirmationModal')
      .getByTestId('confirmationModalClose');
  }

  get confirmationModalConfirmButton() {
    return this.page
      .getByTestId('listColumnConfirmationModal')
      .getByTestId('confirmationModalConfirm');
  }

  get switchViewButton() {
    return this.page.getByTestId('listColumnSwitchView');
  }

  get listColumnJSONEditor() {
    return this.page.getByTestId('listColumnJSONEditor');
  }

  getMultiInputKeyInput(index: number) {
    return this.page.getByTestId('listColumnMultiInput').getByTestId(`keyValueKeyInput-${index}`);
  }

  getMultiInputValueInput(index: number) {
    return this.page.getByTestId('listColumnMultiInput').getByTestId(`keyValueValueInput-${index}`);
  }

  getMultiInputDeleteButton(index: number) {
    return this.page
      .getByTestId('listColumnMultiInput')
      .getByTestId(`multiInputDeleteButton-${index}`);
  }

  getMultiInputAddButton(index: number) {
    return this.page
      .getByTestId('listColumnMultiInput')
      .getByTestId(`multiInputAddButton-${index}`);
  }

  // Navigation
  async goToCaseDetailsManagementCaseList(caseIdentifier: string) {
    console.log('Navigate to Case Details Management...');
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

  async checkColumnsExisting(columnKeys: string[]) {
    for (let key of columnKeys) {
      await expect(this.page.locator(`td[title="${key}"]`)).toBeTruthy();
    }
  }
}
