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
  BUILDING_BLOCK_MANAGEMENT_PROCESSES_TEST_IDS,
  BUILDING_BLOCK_MANAGEMENT_PROCESS_UPLOAD_TEST_IDS,
  CONFIRMATION_MODAL_TEST_IDS,
  PROCESS_LINK_PANEL_TEST_IDS,
  PROCESS_MANAGEMENT_BUILDER_TEST_IDS,
  ZAKEN_API_CREATE_ZAAK_ACTION_TEST_IDS,
} from '../../constants';
import {BpmnModeler} from '../../shared/bpmn-modeler/bpmn-modeler.utils';
import {CarbonList, CarbonListRow} from '../../shared/carbon-list/carbon-list.utils';
import {CarbonToggle} from '../../shared/carbon-toggle/carbon-toggle.utils';
import {ProcessLinkWizard} from '../../shared/process-link-wizard/process-link-wizard.utils';
import {apiDelete, apiGet, apiPost} from '../../utils/api.utils';
import {BUILDING_BLOCK_PLUGIN_API} from './building-block-plugins-config';
import {
  BUILDING_BLOCK_PROCESS_API,
  BUILDING_BLOCK_PROCESS_TEXTS,
} from './building-block-processes-config';

/** One process definition of a building block version, as the management API returns it. */
export interface BuildingBlockProcessDefinition {
  id: string;
  key: string;
  name: string | null;
  versionTag: string;
  main: boolean;
  draft: boolean;
}

/**
 * A stored process link. Inside a building block the link points at a plugin
 * *definition* — `pluginConfigurationId` stays null and `referenceType` is
 * `BUILDING_BLOCK`, because the configuration is only bound later, when a case
 * links to the building block.
 */
export interface ProcessLink {
  id: string;
  processDefinitionId: string;
  activityId: string;
  activityType: string;
  processLinkType: string;
  pluginConfigurationId: string | null;
  referenceType: string;
  pluginDefinitionKey: string;
  pluginActionDefinitionKey: string;
  actionProperties: Record<string, unknown>;
}

export function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class BuildingBlockProcessesPage {
  readonly carbonList: CarbonList;
  readonly modeler: BpmnModeler;
  readonly linkWizard: ProcessLinkWizard;

  constructor(
    private readonly page: Page,
    private readonly request: APIRequestContext
  ) {
    this.carbonList = new CarbonList(
      page,
      page.locator('valtimo-building-block-management-processes')
    );
    this.modeler = new BpmnModeler(page);
    this.linkWizard = new ProcessLinkWizard(page);
  }

  // ─── Processes tab locators ───────────────────────────────────────

  get uploadButton(): Locator {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_PROCESSES_TEST_IDS.uploadButton);
  }

  get createButton(): Locator {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_PROCESSES_TEST_IDS.createButton);
  }

  // ─── Upload modal locators ────────────────────────────────────────

  get uploadFileUploader(): Locator {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_PROCESS_UPLOAD_TEST_IDS.fileUploader);
  }

  get uploadSubmitButton(): Locator {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_PROCESS_UPLOAD_TEST_IDS.submitButton);
  }

  get uploadCancelButton(): Locator {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_PROCESS_UPLOAD_TEST_IDS.cancelButton);
  }

  // ─── Confirmation modal ───────────────────────────────────────────

  /**
   * Scope a confirmation modal by its heading.
   *
   * Two `valtimo-confirmation-modal`s are reachable from the Processes tab — the
   * row delete modal and the upload "replace existing process" modal — and both
   * render the same `confirmationModal*` test ids. The replace modal is wrapped in
   * `valtimo-render-in-body`, which moves it to `document.body`, so it cannot be
   * scoped by its owning component either. The heading is the only thing that
   * distinguishes them.
   *
   * The returned locator is the inner `.cds--modal` rather than the component
   * host: the host wraps a `position: fixed` modal, so it collapses to a
   * zero-size bounding box and Playwright always reports it as hidden.
   */
  private confirmationModal(title: string): Locator {
    return this.page
      .locator('valtimo-confirmation-modal')
      .filter({has: this.page.getByRole('heading', {name: title})})
      .locator('.cds--modal');
  }

  get deleteModal(): Locator {
    return this.confirmationModal(BUILDING_BLOCK_PROCESS_TEXTS.deleteModalTitle);
  }

  get deleteConfirmButton(): Locator {
    return this.deleteModal.getByTestId(CONFIRMATION_MODAL_TEST_IDS.confirmButton);
  }

  // ─── Builder locators ─────────────────────────────────────────────

  /** Labelled "Save" in the UI; it deploys the diagram. */
  get saveButton(): Locator {
    return this.page.getByTestId(PROCESS_MANAGEMENT_BUILDER_TEST_IDS.deployButton);
  }

  get draftToggle(): CarbonToggle {
    return new CarbonToggle(this.page.getByTestId(PROCESS_MANAGEMENT_BUILDER_TEST_IDS.draftToggle));
  }

  /** The Valtimo-owned "Process link" group inside the bpmn-js properties panel. */
  get createProcessLinkButton(): Locator {
    return this.page.getByTestId(PROCESS_LINK_PANEL_TEST_IDS.createButton);
  }

  /** Replaces the create button once the selected step carries a link. */
  get editProcessLinkButton(): Locator {
    return this.page.getByTestId(PROCESS_LINK_PANEL_TEST_IDS.editButton);
  }

  get unlinkProcessLinkButton(): Locator {
    return this.page.getByTestId(PROCESS_LINK_PANEL_TEST_IDS.unlinkButton);
  }

  get processLinkModal(): Locator {
    return this.page.locator('valtimo-process-link-modal');
  }

  // ─── Navigation ───────────────────────────────────────────────────

  processesTabUrl(key: string, versionTag: string) {
    return `/building-block-management/building-block/${key}/version/${versionTag}/process-definition`;
  }

  /**
   * Navigate straight to the route instead of driving the Admin menu: loading the
   * dashboard first and then opening a heavy admin route crashes the Chromium
   * renderer.
   */
  async goToProcessesTab(key: string, versionTag: string) {
    await this.page.goto(this.processesTabUrl(key, versionTag));
    await this.page.waitForURL(
      new RegExp(`/version/${escapeForRegExp(versionTag)}/process-definition$`)
    );
    await this.carbonList.waitForLoaded();
    await expect(this.carbonList.table).toBeVisible();
  }

  /** Open one process definition of the building block in the BPMN modeler. */
  async goToProcessBuilder(key: string, versionTag: string, processDefinitionId: string) {
    await this.page.goto(`${this.processesTabUrl(key, versionTag)}/${processDefinitionId}`);
    await this.modeler.waitForLoaded();
  }

  // ─── List ─────────────────────────────────────────────────────────

  /**
   * Locate a row by its Key cell. Names are not unique — and a process created
   * from the empty diagram has no name at all — so rows are identified by key.
   */
  rowByKey(key: string): CarbonListRow {
    return this.carbonList.row(new RegExp(`^${escapeForRegExp(key)}$`));
  }

  /**
   * `actionItems` on the carbon list appends an unlabelled `<th>` for the row
   * overflow menu, so the empty headers are dropped before comparing.
   */
  async assertColumnHeaders(expectedHeaders: readonly string[]) {
    const headers = await this.carbonList.table.locator('thead th').allInnerTexts();
    expect(headers.map(header => header.trim()).filter(Boolean)).toEqual([...expectedHeaders]);
  }

  async assertProcessMetadata(definition: {name: string; key: string}) {
    const row = this.rowByKey(definition.key);
    await row.assertVisible();
    await expect(row.cellByIndex(0)).toHaveText(definition.name);
    await expect(row.cellByIndex(1)).toHaveText(definition.key);
  }

  async assertProcessTag(key: string, tag: string) {
    await expect(this.rowByKey(key).tags).toContainText(tag);
  }

  async assertProcessHasNoTags(key: string) {
    await expect(this.rowByKey(key).tags).toHaveCount(0);
  }

  /** Open a row's overflow menu and read which actions it offers. */
  async readRowActions(key: string): Promise<string[]> {
    const row = this.rowByKey(key);
    await row.openActionMenu();
    const labels = await this.page.getByRole('menu').getByRole('menuitem').allInnerTexts();
    return labels.map(label => label.trim());
  }

  async closeRowActionMenu() {
    await this.page.keyboard.press('Escape');
    await expect(this.page.getByRole('menu')).not.toBeVisible();
  }

  // ─── Upload ───────────────────────────────────────────────────────

  async openUploadModal() {
    await expect(this.uploadButton).toBeEnabled();
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
   * Submit the upload and return the deploy response. Matched on the exact
   * collection path so the `POST .../process-definition/validate` call the
   * builder makes elsewhere can never be picked up instead.
   */
  async submitUpload(key: string, versionTag: string): Promise<Response> {
    await expect(this.uploadSubmitButton).toBeEnabled();
    const [response] = await Promise.all([
      this.page.waitForResponse(
        res =>
          new URL(res.url()).pathname ===
            BUILDING_BLOCK_PROCESS_API.processDefinitions(key, versionTag) &&
          res.request().method() === 'POST'
      ),
      this.uploadSubmitButton.click(),
    ]);
    return response;
  }

  /** Full happy-path upload: open the modal, pick the file, submit. */
  async uploadProcess(key: string, versionTag: string, fileName: string): Promise<Response> {
    await this.openUploadModal();
    await this.selectBpmnFile(fileName);
    const response = await this.submitUpload(key, versionTag);
    await this.carbonList.waitForLoaded();
    return response;
  }

  // ─── Create ───────────────────────────────────────────────────────

  async goToCreateProcess(key: string, versionTag: string) {
    await expect(this.createButton).toBeEnabled();
    await this.createButton.click();
    await this.page.waitForURL(/\/process-definition\/create$/);
    await this.modeler.waitForLoaded();
  }

  /**
   * Deploy the diagram currently open in the builder.
   *
   * The Save button POSTs a new definition on the `create` route and PUTs an
   * existing one otherwise, so both methods are accepted. Only a *draft* deploy
   * goes straight through: a non-draft one is validated first and, when the
   * diagram has warnings, waits on a "Process has warnings" confirmation.
   */
  async saveProcess(key: string, versionTag: string): Promise<Response> {
    await expect(this.saveButton).toBeEnabled();
    const [response] = await Promise.all([
      this.page.waitForResponse(
        res =>
          new URL(res.url()).pathname.startsWith(
            BUILDING_BLOCK_PROCESS_API.processDefinitions(key, versionTag)
          ) && ['POST', 'PUT'].includes(res.request().method())
      ),
      this.saveButton.click(),
    ]);
    return response;
  }

  /**
   * Mark the diagram as a draft, which skips validation on save. Without it the
   * seeded diagrams — a bare start/end event pair — trip the "None start event
   * has no process link or form" warning and the save waits on a confirmation.
   */
  async enableDraft() {
    await this.draftToggle.enable();
  }

  // ─── Row actions ──────────────────────────────────────────────────

  async markProcessAsMain(
    key: string,
    versionTag: string,
    processKey: string,
    processDefinitionId: string
  ): Promise<Response> {
    const [response] = await Promise.all([
      this.page.waitForResponse(
        res =>
          new URL(res.url()).pathname ===
            BUILDING_BLOCK_PROCESS_API.main(key, versionTag, processDefinitionId) &&
          res.request().method() === 'POST'
      ),
      this.rowByKey(processKey).clickAction(BUILDING_BLOCK_PROCESS_TEXTS.markAsMainAction),
    ]);
    await this.carbonList.waitForLoaded();
    return response;
  }

  async openDeleteConfirmation(processKey: string) {
    await this.rowByKey(processKey).clickAction(BUILDING_BLOCK_PROCESS_TEXTS.deleteAction);
    await expect(this.deleteModal).toBeVisible();
  }

  async confirmDelete(
    key: string,
    versionTag: string,
    processDefinitionId: string
  ): Promise<Response> {
    const [response] = await Promise.all([
      this.page.waitForResponse(
        res =>
          new URL(res.url()).pathname ===
            BUILDING_BLOCK_PROCESS_API.processDefinition(key, versionTag, processDefinitionId) &&
          res.request().method() === 'DELETE'
      ),
      this.deleteConfirmButton.click(),
    ]);
    await this.carbonList.waitForLoaded();
    return response;
  }

  // ─── Process link modal ───────────────────────────────────────────

  /** Open the process link wizard from the panel's "Process link" group. */
  async openProcessLinkModalFromPanel() {
    await this.modeler.expandGroup('Process link');
    await expect(this.createProcessLinkButton).toBeVisible();
    await this.createProcessLinkButton.click();
    await expect(
      this.processLinkModal.getByRole('heading', {
        name: BUILDING_BLOCK_PROCESS_TEXTS.processLinkModalHeading,
      })
    ).toBeVisible();
  }

  async closeProcessLinkModal() {
    await this.processLinkModal.getByRole('button', {name: 'Cancel'}).click();
    await expect(
      this.processLinkModal.getByRole('heading', {
        name: BUILDING_BLOCK_PROCESS_TEXTS.processLinkModalHeading,
      })
    ).not.toBeVisible();
  }

  /**
   * Select a step and open the link wizard for it in one go — every plugin test
   * starts this way.
   */
  async openLinkWizardForStep(
    key: string,
    versionTag: string,
    processDefinitionId: string,
    elementId: string
  ) {
    await this.goToProcessBuilder(key, versionTag, processDefinitionId);
    await this.modeler.selectElement(elementId);
    await this.openProcessLinkModalFromPanel();
  }

  // ─── Plugin action configuration ──────────────────────────────────

  /**
   * A required property of the "Create zaak" action. The test id sits on the
   * `v-input` host, so the field itself is one level down — the inner `<input>`
   * carries no `name` attribute of its own.
   */
  private createZaakInput(testId: string): Locator {
    return this.page.getByTestId(testId).locator('input');
  }

  get createZaakRsinInput(): Locator {
    return this.createZaakInput(ZAKEN_API_CREATE_ZAAK_ACTION_TEST_IDS.rsin);
  }

  get createZaakZaaktypeUrlInput(): Locator {
    return this.createZaakInput(ZAKEN_API_CREATE_ZAAK_ACTION_TEST_IDS.zaaktypeUrl);
  }

  /** Fill both required properties of the "Create zaak" action. */
  async fillCreateZaakProperties(values: {rsin: string; zaaktypeUrl: string}) {
    await this.createZaakRsinInput.fill(values.rsin);
    await this.createZaakZaaktypeUrlInput.fill(values.zaaktypeUrl);
  }

  // ─── Process link API ─────────────────────────────────────────────

  /**
   * Process links stored for a process definition.
   *
   * A link made in the modeler only lives in memory until the diagram is saved,
   * and saving deploys a *new* definition — so this is always read with the id
   * the save produced, never the one the wizard was opened on.
   */
  async getProcessLinksViaApi(processDefinitionId: string): Promise<ProcessLink[]> {
    return apiGet<ProcessLink[]>(BUILDING_BLOCK_PLUGIN_API.processLinks(processDefinitionId));
  }

  /** Plugin definitions the backend offers for an activity type. */
  async getPluginDefinitionsViaApi(activityType: string): Promise<{key: string}[]> {
    return apiGet<{key: string}[]>(BUILDING_BLOCK_PLUGIN_API.pluginDefinitions(activityType));
  }

  // ─── API helpers ──────────────────────────────────────────────────

  async createBuildingBlockViaApi(definition: {
    key: string;
    name: string;
    versionTag: string;
    description: string;
  }) {
    return apiPost(BUILDING_BLOCK_PROCESS_API.buildingBlock, definition);
  }

  async finalizeVersionViaApi(key: string, versionTag: string) {
    try {
      await apiPost(
        `${BUILDING_BLOCK_PROCESS_API.buildingBlock}/${key}/version/${versionTag}/finalize`,
        {}
      );
    } catch {
      // Already final.
    }
  }

  async getProcessesViaApi(
    key: string,
    versionTag: string
  ): Promise<BuildingBlockProcessDefinition[]> {
    return apiGet<BuildingBlockProcessDefinition[]>(
      BUILDING_BLOCK_PROCESS_API.processDefinitions(key, versionTag)
    );
  }

  async getMainProcessViaApi(
    key: string,
    versionTag: string
  ): Promise<BuildingBlockProcessDefinition> {
    const processes = await this.getProcessesViaApi(key, versionTag);
    const main = processes.find(process => process.main);
    expect(main, 'the building block has a main process definition').toBeDefined();
    return main!;
  }

  /**
   * Latest definition for a process key. Saving a diagram deploys a new version,
   * so the id changes on every save and has to be re-read before it is used.
   */
  async getProcessByKeyViaApi(
    key: string,
    versionTag: string,
    processKey: string
  ): Promise<BuildingBlockProcessDefinition | undefined> {
    const processes = await this.getProcessesViaApi(key, versionTag);
    return processes.filter(process => process.key === processKey).pop();
  }

  async deleteProcessViaApi(key: string, versionTag: string, processDefinitionId: string) {
    try {
      await apiDelete(
        BUILDING_BLOCK_PROCESS_API.processDefinition(key, versionTag, processDefinitionId)
      );
    } catch {
      // Already gone, or it is the main process and cannot be removed.
    }
  }

  /**
   * Remove every process definition this suite added, i.e. all of them except the
   * one generated together with the building block. The main definition cannot be
   * deleted, so `keepKey` is skipped.
   */
  async deleteAddedProcessesViaApi(key: string, versionTag: string, keepKey: string) {
    let processes: BuildingBlockProcessDefinition[] = [];
    try {
      processes = await this.getProcessesViaApi(key, versionTag);
    } catch {
      return;
    }

    for (const process of processes) {
      if (process.key === keepKey || process.main) continue;
      await this.deleteProcessViaApi(key, versionTag, process.id);
    }
  }

  /**
   * Best-effort cleanup of the building block itself.
   *
   * The management API exposes no DELETE for building block definitions
   * (`BuildingBlockManagementResource` only serves GET/POST/PUT), so this call
   * fails and is swallowed — the building block stays behind. The helper is kept
   * so cleanup starts working as soon as the endpoint is added.
   */
  async deleteBuildingBlockViaApi(key: string, versionTag: string) {
    try {
      await apiDelete(`${BUILDING_BLOCK_PROCESS_API.buildingBlock}/${key}/version/${versionTag}`);
    } catch {
      // No DELETE endpoint yet — nothing to do.
    }
  }
}
