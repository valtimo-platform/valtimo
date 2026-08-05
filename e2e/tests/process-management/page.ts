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

import {
  type APIRequestContext,
  type Locator,
  type Page,
  type Response,
  expect,
} from '@playwright/test';
import path from 'path';
import {
  CONFIRMATION_MODAL_TEST_IDS,
  PROCESS_MANAGEMENT_BUILDER_TEST_IDS,
  PROCESS_MANAGEMENT_LIST_TEST_IDS,
  PROCESS_MANAGEMENT_UPLOAD_TEST_IDS,
} from '../../constants';
import {CarbonList} from '../../shared/carbon-list/carbon-list.utils';
import {CarbonToggle} from '../../shared/carbon-toggle/carbon-toggle.utils';
import {OverflowMenu} from '../../shared/overflow-menu/overflow-menu.utils';
import {apiDelete, apiGet} from '../../utils/api.utils';
import {PROCESS_MANAGEMENT_API, PROCESS_MANAGEMENT_TEXTS} from './process-management-config';

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** One deployed version of a process definition, as returned by the management API. */
export interface ProcessDefinitionResult {
  bpmn20Xml: string;
  draft?: boolean;
  processDefinition: {
    id: string;
    key: string;
    name: string;
    version: number;
    readOnly: boolean;
  };
}

export class ProcessManagementPage {
  readonly carbonList: CarbonList;
  readonly overflowMenu: OverflowMenu;
  private readonly listScope: Locator;

  constructor(
    private readonly page: Page,
    private readonly request: APIRequestContext
  ) {
    this.listScope = page.locator('valtimo-process-management-list');
    this.carbonList = new CarbonList(page, this.listScope);
    this.overflowMenu = new OverflowMenu(page, PROCESS_MANAGEMENT_BUILDER_TEST_IDS.moreButton);
  }

  // ─── List locators ────────────────────────────────────────────────

  get uploadButton() {
    return this.page.getByTestId(PROCESS_MANAGEMENT_LIST_TEST_IDS.uploadButton);
  }

  get createProcessButton() {
    return this.page.getByTestId(PROCESS_MANAGEMENT_LIST_TEST_IDS.createProcessButton);
  }

  // ─── Upload modal locators ────────────────────────────────────────

  get uploadFileUploader() {
    return this.page.getByTestId(PROCESS_MANAGEMENT_UPLOAD_TEST_IDS.fileUploader);
  }

  get uploadSubmitButton() {
    return this.page.getByTestId(PROCESS_MANAGEMENT_UPLOAD_TEST_IDS.submitButton);
  }

  get uploadCancelButton() {
    return this.page.getByTestId(PROCESS_MANAGEMENT_UPLOAD_TEST_IDS.cancelButton);
  }

  // ─── Confirmation modals ──────────────────────────────────────────

  /**
   * Scope a confirmation modal by its heading.
   *
   * Two `valtimo-confirmation-modal`s are reachable from the process list — the
   * row delete modal and the upload "replace existing process" modal — and both
   * render the same `confirmationModal*` test ids. The replace modal is also
   * wrapped in `valtimo-render-in-body`, which moves it to `document.body`, so it
   * cannot be scoped by its owning component either. The heading is the only
   * thing that distinguishes them.
   *
   * The returned locator is the inner `.cds--modal`, not the component host: the
   * host wraps a `position: fixed` modal, so it collapses to a zero-size bounding
   * box and Playwright always reports it as hidden. Carbon toggles open/closed
   * through `visibility` on `.cds--modal`, which `toBeVisible()` reads correctly.
   */
  private confirmationModal(title: string): Locator {
    return this.page
      .locator('valtimo-confirmation-modal')
      .filter({has: this.page.getByRole('heading', {name: title})})
      .locator('.cds--modal');
  }

  get deleteModal() {
    return this.confirmationModal(PROCESS_MANAGEMENT_TEXTS.deleteModalTitle);
  }

  get deleteConfirmButton() {
    return this.deleteModal.getByTestId(CONFIRMATION_MODAL_TEST_IDS.confirmButton);
  }

  get replaceModal() {
    return this.confirmationModal(PROCESS_MANAGEMENT_TEXTS.replaceModalTitle);
  }

  get replaceCancelButton() {
    return this.replaceModal.getByTestId(CONFIRMATION_MODAL_TEST_IDS.closeButton);
  }

  // ─── Builder locators ─────────────────────────────────────────────

  get builderContainer() {
    return this.page.locator('.bpmn__container');
  }

  get deployButton() {
    return this.page.getByTestId(PROCESS_MANAGEMENT_BUILDER_TEST_IDS.deployButton);
  }

  get validateButton() {
    return this.page.getByTestId(PROCESS_MANAGEMENT_BUILDER_TEST_IDS.validateButton);
  }

  get validationErrors() {
    return this.page.getByTestId(PROCESS_MANAGEMENT_BUILDER_TEST_IDS.validationErrors);
  }

  get readOnlyTag() {
    return this.page.getByTestId(PROCESS_MANAGEMENT_BUILDER_TEST_IDS.readOnlyTag);
  }

  get systemProcessTag() {
    return this.page.getByTestId(PROCESS_MANAGEMENT_BUILDER_TEST_IDS.systemProcessTag);
  }

  /** The Export entry of the builder header's overflow menu (only while open). */
  get exportOption() {
    return this.overflowMenu.option(PROCESS_MANAGEMENT_BUILDER_TEST_IDS.exportButton);
  }

  get draftToggle() {
    return new CarbonToggle(
      this.page.getByTestId(PROCESS_MANAGEMENT_BUILDER_TEST_IDS.draftToggle)
    );
  }

  /** Case-only toggles: they must not render in the standalone builder. */
  get startsCaseToggle() {
    return this.page.getByTestId(PROCESS_MANAGEMENT_BUILDER_TEST_IDS.startsCaseToggle);
  }

  get startableByUserToggle() {
    return this.page.getByTestId(PROCESS_MANAGEMENT_BUILDER_TEST_IDS.startableByUserToggle);
  }

  // ─── Version dropdown ─────────────────────────────────────────────

  get versionDropdown() {
    return this.page.getByTestId(PROCESS_MANAGEMENT_BUILDER_TEST_IDS.versionDropdown);
  }

  /**
   * Carbon renders the disabled state on the dropdown's inner field button rather
   * than on the `cds-dropdown` host, so enabled/disabled has to be asserted here.
   */
  get versionDropdownButton() {
    return this.versionDropdown.getByRole('button').first();
  }

  /**
   * A selectable version in the open dropdown.
   *
   * The items come from an `[items]` binding (plain `ListItem`s), not a template,
   * so they cannot carry test ids — they are matched on their rendered label.
   * Scope to the listbox: the selected value renders the same label outside it.
   */
  versionOption(version: number): Locator {
    return this.versionDropdown
      .getByRole('listbox')
      .getByText(`${PROCESS_MANAGEMENT_TEXTS.versionPrefix}${version}`, {exact: true});
  }

  // ─── BPMN modeler (bpmn-js library DOM, no test ids available) ─────

  get bpmnPalette() {
    return this.page.locator('.djs-palette:visible');
  }

  /**
   * Both the editable modeler and the read-only viewer render
   * `.bpmn__modeler-canvas`; the inactive one sits inside a `display: none`
   * parent, so `:visible` resolves to whichever is currently in use.
   */
  get activeBpmnCanvas() {
    return this.page.locator('.bpmn__modeler-canvas:visible');
  }

  elementShape(elementId: string) {
    return this.activeBpmnCanvas.locator(`g[data-element-id="${elementId}"]`);
  }

  get appendTaskContextPadAction() {
    return this.page.locator('.djs-context-pad [data-action="append.append-task"]');
  }

  get taskShapes() {
    return this.activeBpmnCanvas.locator('g.djs-shape[data-element-id^="Activity_"]');
  }

  // ─── Navigation ───────────────────────────────────────────────────

  /**
   * Navigate straight to the route instead of driving the Admin menu: loading the
   * dashboard first and then opening a heavy admin route crashes the Chromium
   * renderer.
   */
  async goToProcessManagement() {
    await this.page.goto('/processes');
    await this.page.waitForURL(/\/processes$/);
    await this.carbonList.waitForLoaded();
  }

  async goToProcessBuilder(processKey: string) {
    await this.page.goto(`/processes/${processKey}`);
    await this.page.waitForURL(new RegExp(`/processes/${escapeForRegExp(processKey)}$`));
    await expect(this.builderContainer).toBeVisible();
    await expect(this.bpmnPalette).toBeVisible();
  }

  async goToCreateProcess() {
    await this.goToProcessManagement();
    await this.createProcessButton.click();
    await this.page.waitForURL(/\/processes\/create$/);
    await expect(this.builderContainer).toBeVisible();
    await expect(this.bpmnPalette).toBeVisible();
  }

  // ─── List assertions ──────────────────────────────────────────────

  async assertListLoaded() {
    await this.carbonList.waitForLoaded();
    await expect(this.carbonList.table).toBeVisible();
    await expect(this.uploadButton).toBeVisible();
    await expect(this.createProcessButton).toBeVisible();
  }

  /**
   * `actionItems` on the carbon list appends an unlabelled `<th>` for the row
   * overflow menu, so the empty headers are dropped before comparing.
   */
  async assertColumnHeaders(expectedHeaders: readonly string[]) {
    const headers = await this.carbonList.table.locator('thead th').allInnerTexts();
    expect(headers.map(header => header.trim()).filter(Boolean)).toEqual([...expectedHeaders]);
  }

  /**
   * Locate a row by its Key cell. Names are not unique — and a process created
   * from the empty diagram has no name at all — so rows are identified by key.
   */
  rowByKey(key: string) {
    return this.carbonList.row(new RegExp(`^${escapeForRegExp(key)}$`));
  }

  async assertProcessVisible(key: string) {
    await this.rowByKey(key).assertVisible();
  }

  async assertProcessNotVisible(key: string) {
    await this.rowByKey(key).assertNotVisible();
  }

  async assertProcessMetadata(definition: {name: string; key: string}) {
    const row = this.rowByKey(definition.key);
    await row.assertVisible();
    await expect(row.cellByIndex(0)).toHaveText(definition.name);
    await expect(row.cellByIndex(1)).toHaveText(definition.key);
  }

  async assertProcessHasDraftTag(key: string) {
    await expect(this.rowByKey(key).tags).toContainText(PROCESS_MANAGEMENT_TEXTS.draftTag);
  }

  // ─── Upload modal ─────────────────────────────────────────────────

  /**
   * Reload the list before opening the modal: a Carbon modal resets its reactive
   * form 240 ms after closing, so re-opening within the same page state can let a
   * pending reset wipe the file that was just selected.
   */
  async openUploadModal() {
    await this.goToProcessManagement();
    await this.uploadButton.click();
    await expect(this.uploadSubmitButton).toBeVisible();
  }

  async closeUploadModal() {
    await this.uploadCancelButton.click();
    await expect(this.uploadSubmitButton).not.toBeVisible();
  }

  async selectBpmnFile(fileName: string) {
    const filePath = path.resolve(process.cwd(), 'assets', fileName);
    await this.uploadFileUploader.locator('input[type="file"]').setInputFiles(filePath);
  }

  /**
   * Submit the upload and return the deploy response.
   *
   * Matched on the exact collection path so the `POST .../process-definition/validate`
   * call made elsewhere in the builder can never be picked up instead.
   */
  async submitUpload(): Promise<Response> {
    await expect(this.uploadSubmitButton).toBeEnabled();
    const [response] = await Promise.all([
      this.page.waitForResponse(
        res =>
          new URL(res.url()).pathname === PROCESS_MANAGEMENT_API.processDefinition &&
          res.request().method() === 'POST'
      ),
      this.uploadSubmitButton.click(),
    ]);
    return response;
  }

  /** Full happy-path upload: open modal → select file → submit. */
  async uploadProcess(fileName: string): Promise<Response> {
    await this.openUploadModal();
    await this.selectBpmnFile(fileName);
    return this.submitUpload();
  }

  // ─── Builder actions ──────────────────────────────────────────────

  async appendTaskToStartEvent(startEventId: string) {
    const startEvent = this.elementShape(startEventId);
    await expect(startEvent).toBeVisible();
    await startEvent.click();

    await expect(this.appendTaskContextPadAction).toBeVisible();
    await this.appendTaskContextPadAction.click();
    await this.page.keyboard.press('Escape');
  }

  /** Save an existing process definition; returns the PUT response. */
  async saveProcess(): Promise<Response> {
    await expect(this.deployButton).toBeEnabled();
    const [response] = await Promise.all([
      this.page.waitForResponse(
        res =>
          new URL(res.url()).pathname === PROCESS_MANAGEMENT_API.processDefinition &&
          res.request().method() === 'PUT'
      ),
      this.deployButton.click(),
    ]);
    return response;
  }

  /** Deploy a brand-new process definition; returns the POST response. */
  async deployNewProcess(): Promise<Response> {
    await expect(this.deployButton).toBeEnabled();
    const [response] = await Promise.all([
      this.page.waitForResponse(
        res =>
          new URL(res.url()).pathname === PROCESS_MANAGEMENT_API.processDefinition &&
          res.request().method() === 'POST'
      ),
      this.deployButton.click(),
    ]);
    return response;
  }

  /**
   * Click Save and wait for the validation round-trip that precedes a non-draft
   * deploy, returning the validation response. Used to assert that an invalid
   * diagram is stopped before it is ever deployed.
   */
  async saveExpectingValidation(): Promise<Response> {
    await expect(this.deployButton).toBeEnabled();
    const [response] = await Promise.all([
      this.page.waitForResponse(
        res =>
          new URL(res.url()).pathname === PROCESS_MANAGEMENT_API.validate &&
          res.request().method() === 'POST'
      ),
      this.deployButton.click(),
    ]);
    return response;
  }

  async validateProcess(): Promise<Response> {
    await expect(this.validateButton).toBeEnabled();
    const [response] = await Promise.all([
      this.page.waitForResponse(
        res =>
          new URL(res.url()).pathname === PROCESS_MANAGEMENT_API.validate &&
          res.request().method() === 'POST'
      ),
      this.validateButton.click(),
    ]);
    return response;
  }

  async openVersionDropdown() {
    await expect(this.versionDropdownButton).toBeEnabled();
    await this.versionDropdownButton.click();
    await expect(this.versionDropdown.getByRole('listbox')).toBeVisible();
  }

  async selectVersion(version: number) {
    await this.openVersionDropdown();
    const option = this.versionOption(version);
    await expect(option).toBeVisible();
    await option.click();
    await expect(this.versionDropdownButton).toContainText(
      `${PROCESS_MANAGEMENT_TEXTS.versionPrefix}${version}`
    );
  }

  // ─── Delete ───────────────────────────────────────────────────────

  async deleteProcess(key: string): Promise<Response> {
    await this.rowByKey(key).clickAction('Delete');
    await expect(this.deleteConfirmButton).toBeVisible();

    const [response] = await Promise.all([
      this.page.waitForResponse(
        res =>
          new URL(res.url()).pathname === PROCESS_MANAGEMENT_API.byKey(key) &&
          res.request().method() === 'DELETE'
      ),
      this.deleteConfirmButton.click(),
    ]);
    return response;
  }

  // ─── API helpers ──────────────────────────────────────────────────

  /** Every unlinked process definition, one entry per deployed version. */
  async getProcessesViaApi(): Promise<ProcessDefinitionResult[]> {
    return apiGet<ProcessDefinitionResult[]>(PROCESS_MANAGEMENT_API.processDefinition);
  }

  /** All deployed versions of a single process definition key. */
  async getProcessVersionsViaApi(key: string): Promise<ProcessDefinitionResult[]> {
    try {
      return await apiGet<ProcessDefinitionResult[]>(PROCESS_MANAGEMENT_API.byKey(key));
    } catch {
      // The key has no deployed versions.
      return [];
    }
  }

  /**
   * Best-effort cleanup. Deleting an unlinked process definition removes every
   * version of the key at once, so one call is enough per key.
   */
  async deleteProcessViaApi(key: string) {
    try {
      await apiDelete(PROCESS_MANAGEMENT_API.byKey(key));
    } catch {
      // Already gone, or never deployed.
    }
  }
}
