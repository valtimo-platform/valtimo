import {Page, expect} from '@playwright/test';
import {clearMonacoEditor, pasteToMonacoEditor} from '../../utils/monaco.utils';

const REVERT_LIST_COLUMNS = [
  {test: 'This is a random test'},
  {test2: 'This is a random second test'},
];

export class JsonEditor {
  constructor(private readonly page: Page) {}

  //UI Elements
  get jsonEditorEditButton() {
    return this.page.getByTestId('jsonEditorEditButton');
  }

  get jsonEditorSaveButton() {
    return this.page.getByTestId('jsonEditorSaveButton');
  }

  get jsonEditorCancelButton() {
    return this.page.getByTestId('jsonEditorCancelButton');
  }

  get jsonEditorConfirmationModalConfirmButton() {
    return this.page
      .getByTestId('jsonEditorSaveConfirmationModal')
      .getByTestId('confirmationModalConfirm');
  }

  get jsonEditorConfirmationModalCloseButton() {
    return this.page
      .getByTestId('jsonEditorSaveConfirmationModal')
      .getByTestId('confirmationModalClose');
  }

  get jsonEditorCancelModalConfirmButton() {
    return this.page
      .getByTestId('jsonEditorCancelConfirmationModal')
      .getByTestId('confirmationModalConfirm');
  }

  get jsonEditorCancelModalKeepEditingButton() {
    return this.page
      .getByTestId('jsonEditorCancelConfirmationModal')
      .getByTestId('confirmationModalClose');
  }

  get jsonEditorCancelModalSaveButton() {
    return this.page
      .getByTestId('jsonEditorCancelConfirmationModal')
      .getByTestId('confirmationModalOptional');
  }

  async saveChanges(changes: object) {
    await this.jsonEditorEditButton.click();
    await this.clearColumnsJSON();
    await this.editColumnsViaJSON(changes);
    await this.jsonEditorSaveButton.click();
    await this.jsonEditorConfirmationModalConfirmButton.click();
  }

  async assertKeepEditingChanges(changes: object) {
    await this.jsonEditorEditButton.click();
    await this.clearColumnsJSON();
    await this.editColumnsViaJSON(changes);
    await this.jsonEditorCancelButton.click();
    await this.jsonEditorCancelModalKeepEditingButton.click();
    await expect(this.jsonEditorCancelButton).toBeVisible();
    await this.jsonEditorCancelButton.click();
    await this.jsonEditorCancelModalConfirmButton.click();
  }

  async assertCloseSaveKeepEditing(changes: object) {
    await this.jsonEditorEditButton.click();
    await this.clearColumnsJSON();
    await this.editColumnsViaJSON(changes);
    await this.jsonEditorSaveButton.click();
    await this.jsonEditorConfirmationModalCloseButton.click();
    await expect(this.jsonEditorCancelButton).toBeVisible();
    await this.jsonEditorCancelButton.click();
    await this.jsonEditorCancelModalConfirmButton.click();
  }

  async discardChanges() {
    await this.jsonEditorEditButton.click();
    await this.editColumnsViaJSON(REVERT_LIST_COLUMNS);
    await this.jsonEditorCancelButton.click();
    await this.jsonEditorCancelModalConfirmButton.click();
  }

  async saveChangesWithCancel(changes: object) {
    await this.jsonEditorEditButton.click();
    await this.clearColumnsJSON();
    await this.editColumnsViaJSON(changes);
    await this.jsonEditorCancelButton.click();
    await this.jsonEditorCancelModalSaveButton.click();
  }

  private async editColumnsViaJSON(columnConfig) {
    await pasteToMonacoEditor(this.page, JSON.stringify(columnConfig));
  }

  private async clearColumnsJSON() {
    await clearMonacoEditor(this.page);
  }
}
