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
  AUTO_KEY_INPUT_TEST_IDS,
  BUILDING_BLOCK_MANAGEMENT_CREATE_TEST_IDS,
  BUILDING_BLOCK_MANAGEMENT_LIST_TEST_IDS,
  BUILDING_BLOCK_MANAGEMENT_UPLOAD_TEST_IDS,
  BUILDING_BLOCK_MANAGEMENT_USAGE_UPDATE_TEST_IDS,
  BUILDING_BLOCK_USAGE_UPDATE_SOURCE_KEY_OPTION_TEST_ID_PREFIX,
  BUILDING_BLOCK_USAGE_UPDATE_SOURCE_OPTION_TEST_ID_PREFIX,
  BUILDING_BLOCK_USAGE_UPDATE_TARGET_OPTION_TEST_ID_PREFIX,
} from '../../constants';
import {CarbonList} from '../../shared/carbon-list/carbon-list.utils';
import {apiDelete, apiGet, apiPost} from '../../utils/api.utils';
import {BUILDING_BLOCK_TEXTS} from './building-block-config';

const ARCHIVES_DIR = 'building-block-archives';
const BUILDING_BLOCK_API_URL = '/api/management/v1/building-block';
const USAGE_UPDATE_API_URL = `${BUILDING_BLOCK_API_URL}/usage-update`;
const PROCESS_LINK_API_URL = '/api/v1/process-link';

// DI section required — backend drops elements without a shape
function callActivityBpmn(
  processKey: string,
  activityId: string,
  childKey: string,
  childVersionTag: string
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:camunda="http://camunda.org/schema/1.0/bpmn" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="${processKey}" name="${processKey}" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1"><bpmn:outgoing>Flow_1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:callActivity id="${activityId}" calledElement="${childKey}" camunda:calledElementBinding="versionTag" camunda:calledElementVersionTag="BB:${childKey}:${childVersionTag}">
      <bpmn:extensionElements><camunda:in businessKey="#{buildingBlockDocumentId}" /></bpmn:extensionElements>
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:callActivity>
    <bpmn:endEvent id="EndEvent_1"><bpmn:incoming>Flow_2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="${activityId}" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="${activityId}" targetRef="EndEvent_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="${processKey}">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1"><dc:Bounds x="173" y="102" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="${activityId}_di" bpmnElement="${activityId}"><dc:Bounds x="260" y="80" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1"><dc:Bounds x="412" y="102" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1"><di:waypoint x="209" y="120" /><di:waypoint x="260" y="120" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2"><di:waypoint x="360" y="120" /><di:waypoint x="412" y="120" /></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
}

export interface BuildingBlockVersion {
  versionTag: string;
  final: boolean;
}

export interface BuildingBlockProcessLink {
  activityId: string;
  buildingBlockDefinitionKey: string;
  buildingBlockDefinitionVersionTag: string;
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface BuildingBlockDefinition {
  key: string;
  name: string;
  versionTag: string;
  description: string;
}

export interface CreateBuildingBlockValues {
  name: string;
  versionTag: string;
  description?: string;
}

export class BuildingBlockManagementPage {
  readonly carbonList: CarbonList;
  private readonly listScope: Locator;

  constructor(
    private readonly page: Page,
    private readonly request: APIRequestContext
  ) {
    this.listScope = page.locator('valtimo-building-block-management-list');
    this.carbonList = new CarbonList(page, this.listScope);
  }

  // ─── List locators ────────────────────────────────────────────────

  get uploadButton() {
    return this.carbonList.toolbar.getByTestId(BUILDING_BLOCK_MANAGEMENT_LIST_TEST_IDS.uploadButton);
  }

  get createButton() {
    return this.carbonList.toolbar.getByTestId(BUILDING_BLOCK_MANAGEMENT_LIST_TEST_IDS.createButton);
  }

  // ─── Create modal locators ────────────────────────────────────────

  get createModal() {
    return this.page.locator('valtimo-building-block-management-create-modal');
  }

  get nameInput() {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_CREATE_TEST_IDS.nameInput);
  }

  get versionInput() {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_CREATE_TEST_IDS.versionInput);
  }

  get descriptionInput() {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_CREATE_TEST_IDS.descriptionInput);
  }

  get keyInput() {
    return this.page.getByTestId(AUTO_KEY_INPUT_TEST_IDS.input);
  }

  get keyEditButton() {
    return this.page.getByTestId(AUTO_KEY_INPUT_TEST_IDS.editButton);
  }

  get createSaveButton() {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_CREATE_TEST_IDS.saveButton);
  }

  get createCancelButton() {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_CREATE_TEST_IDS.cancelButton);
  }

  /**
   * Validation message of the auto-key input. Carbon renders `invalidText`
   * inside its own `cds-label` markup, so there is no project-owned element to
   * hang a test id on — the message is asserted by text, scoped to the modal.
   */
  get duplicateKeyError() {
    return this.createModal.getByText(BUILDING_BLOCK_TEXTS.duplicateKeyError);
  }

  // ─── Upload modal locators ────────────────────────────────────────

  get fileUploader() {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_UPLOAD_TEST_IDS.fileUploader);
  }

  get overwriteWarning() {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_UPLOAD_TEST_IDS.overwriteWarning);
  }

  get overwriteCheckbox() {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_UPLOAD_TEST_IDS.overwriteCheckbox);
  }

  get uploadProgressBar() {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_UPLOAD_TEST_IDS.progressBar);
  }

  get uploadNextButton() {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_UPLOAD_TEST_IDS.nextButton);
  }

  get uploadBackButton() {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_UPLOAD_TEST_IDS.backButton);
  }

  get uploadCancelButton() {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_UPLOAD_TEST_IDS.cancelButton);
  }

  get uploadFinishButton() {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_UPLOAD_TEST_IDS.finishButton);
  }

  // ─── Usage update wizard locators ────────────────────────────

  get updateUsagesButton() {
    return this.carbonList.toolbar.getByTestId(
      BUILDING_BLOCK_MANAGEMENT_LIST_TEST_IDS.updateUsagesButton
    );
  }

  private usageUpdateTestId(id: keyof typeof BUILDING_BLOCK_MANAGEMENT_USAGE_UPDATE_TEST_IDS) {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_USAGE_UPDATE_TEST_IDS[id]);
  }

  get usageUpdateChains() {
    return this.usageUpdateTestId('chain');
  }

  /** A chain of the chains step, identified by a container key on its path. */
  usageUpdateChain(containerKey: string) {
    return this.usageUpdateChains.filter({hasText: containerKey});
  }

  get usageUpdateDifferences() {
    return this.usageUpdateTestId('differences');
  }

  get usageUpdateReview() {
    return this.usageUpdateTestId('review');
  }

  get usageUpdateResult() {
    return this.usageUpdateTestId('result');
  }

  get usageUpdateDraftLinks() {
    return this.usageUpdateTestId('draftLink');
  }

  get usageUpdateNextButton() {
    return this.usageUpdateTestId('nextButton');
  }

  get usageUpdateExecuteButton() {
    return this.usageUpdateTestId('executeButton');
  }

  // ─── Navigation ───────────────────────────────────────────────────

  /**
   * Navigate straight to the route instead of going through the Admin menu:
   * loading the dashboard first crashes the Chromium renderer on heavy admin
   * routes.
   */
  async goToBuildingBlockManagement() {
    const definitionsLoaded = this.waitForDefinitionsResponse();
    await this.page.goto('/building-block-management');
    await this.page.waitForURL(/\/building-block-management$/);
    await this.carbonList.waitForLoaded();
    await definitionsLoaded;
  }

  private waitForDefinitionsResponse() {
    return this.page.waitForResponse(
      res =>
        res.request().method() === 'GET' &&
        new URL(res.url()).pathname.endsWith(BUILDING_BLOCK_API_URL)
    );
  }

  // ─── List assertions ──────────────────────────────────────────────

  async assertListLoaded() {
    await this.carbonList.waitForLoaded();
    await expect(this.carbonList.table).toBeVisible();
    await expect(this.uploadButton).toBeVisible();
    await expect(this.createButton).toBeVisible();
  }

  async assertColumnHeaders(expectedHeaders: readonly string[]) {
    await this.carbonList.assertColumnHeaders(expectedHeaders);
  }

  async readKeyColumn(): Promise<string[]> {
    const cells = await this.carbonList.rows.locator('td:nth-child(2)').allInnerTexts();
    return cells.map(cell => cell.trim());
  }

  /**
   * Locate a row by its key column. Names are not unique — two building blocks
   * may share a name — and substring matching would make a name that is a prefix
   * of another match several rows, so identify rows by their exact key.
   */
  async findRowByKey(key: string) {
    return this.carbonList.searchForRow(key, new RegExp(`^${escapeForRegExp(key)}$`));
  }

  async assertBuildingBlockVisibleByKey(key: string) {
    await this.findRowByKey(key);
  }

  /**
   * Assert the name, key and version tag rendered for a single building block.
   * The version is rendered as a Carbon tag rather than plain cell text.
   */
  async assertBuildingBlockMetadata(definition: {name: string; key: string; versionTag: string}) {
    const row = await this.findRowByKey(definition.key);
    await expect(row.cellByIndex(0)).toHaveText(definition.name);
    await expect(row.cellByIndex(1)).toHaveText(definition.key);
    await row.assertTagCount(1);
    await expect(row.tags).toHaveText(definition.versionTag);
  }

  // ─── Create modal ─────────────────────────────────────────────────

  /**
   * Always reload the list before opening the modal. A Carbon modal resets its
   * reactive form 240 ms after closing, so re-opening a modal within the same
   * page state can have that pending reset wipe the freshly filled form.
   */
  async openCreateModal() {
    await this.goToBuildingBlockManagement();
    await this.createButton.click();
    await expect(this.nameInput).toBeVisible();
    await expect(this.createSaveButton).toBeVisible();
  }

  async fillCreateForm(values: CreateBuildingBlockValues) {
    await this.nameInput.fill(values.name);
    // The key is derived from the name asynchronously — wait for it to land
    // before touching the rest of the form.
    await expect(this.keyInput).not.toHaveValue('');
    await this.versionInput.fill(values.versionTag);

    if (values.description !== undefined) {
      await this.descriptionInput.fill(values.description);
    }
  }

  /** Switch the auto-key input to manual mode and type a key. */
  async enterKeyManually(key: string) {
    await this.keyEditButton.click();
    await expect(this.keyEditButton).not.toBeVisible();
    await this.keyInput.fill(key);
  }

  async saveCreateForm(): Promise<Response> {
    await expect(this.createSaveButton).toBeEnabled();
    const [response] = await Promise.all([
      this.page.waitForResponse(
        res => res.url().endsWith(BUILDING_BLOCK_API_URL) && res.request().method() === 'POST'
      ),
      this.createSaveButton.click(),
    ]);
    return response;
  }

  async closeCreateModal() {
    await this.createCancelButton.click();
    await expect(this.page.locator('.cds--modal.is-visible')).not.toBeVisible();
  }

  async assertOnBuildingBlockDetail(key: string, versionTag: string) {
    await this.page.waitForURL(
      `**/building-block-management/building-block/${key}/version/${versionTag}/general`
    );
  }

  // ─── Upload modal ─────────────────────────────────────────────────

  /** Opens the wizard, which starts on the plugin configuration step. */
  async openUploadModal() {
    await this.goToBuildingBlockManagement();
    await this.uploadButton.click();
    await expect(this.page.getByText(BUILDING_BLOCK_TEXTS.pluginStepTitle).first()).toBeVisible();
  }

  async goToFileSelectStep() {
    await expect(this.uploadNextButton).toBeEnabled();
    await this.uploadNextButton.click();
    await expect(this.fileUploader).toBeVisible();
  }

  async selectArchive(fileName: string) {
    const filePath = path.resolve(process.cwd(), 'assets', ARCHIVES_DIR, fileName);
    await this.fileUploader.locator('input.cds--file-input[type="file"]').setInputFiles(filePath);
  }

  /**
   * Tick the overwrite acknowledgement. The inner label has to be clicked — a
   * click on the `cds-checkbox` host does not emit Carbon's `checkedChange`.
   */
  async acknowledgeOverwriteWarning() {
    await this.overwriteCheckbox.locator('label').click();
  }

  async startUpload(): Promise<Response> {
    await expect(this.uploadNextButton).toBeEnabled();
    const [response] = await Promise.all([
      this.page.waitForResponse(
        res =>
          res.url().includes(`${BUILDING_BLOCK_API_URL}/import`) &&
          res.request().method() === 'POST'
      ),
      this.uploadNextButton.click(),
    ]);
    return response;
  }

  async finishUpload() {
    await expect(this.uploadFinishButton).toBeVisible();
    await this.uploadFinishButton.click();
    await expect(this.page.locator('.cds--modal.is-visible')).not.toBeVisible();
  }

  /** Full happy-path import: plugin step → file select → acknowledge → upload. */
  async importArchive(fileName: string): Promise<Response> {
    await this.openUploadModal();
    await this.goToFileSelectStep();
    await this.selectArchive(fileName);
    await this.acknowledgeOverwriteWarning();
    return this.startUpload();
  }

  async assertUploadSucceeded() {
    await expect(this.uploadProgressBar).toContainText(BUILDING_BLOCK_TEXTS.uploadSuccess);
    await expect(this.uploadProgressBar).toHaveClass(/cds--progress-bar--finished/);
  }

  async assertUploadFailed() {
    await expect(this.uploadProgressBar).toContainText(BUILDING_BLOCK_TEXTS.uploadError);
    await expect(this.uploadProgressBar).toHaveClass(/cds--progress-bar--error/);
    // The failed step only offers "Finish" — no retry, cancel or back.
    await expect(this.uploadFinishButton).toBeVisible();
    await expect(this.uploadCancelButton).not.toBeVisible();
    await expect(this.uploadBackButton).not.toBeVisible();
  }

  // ─── Usage update wizard ─────────────────────────────────────

  async openUsageUpdateWizard() {
    await this.goToBuildingBlockManagement();
    await this.updateUsagesButton.click();
    await expect(this.usageUpdateTestId('sourceKeyComboBox')).toBeVisible();
  }

  /** Step 1: the source is one of the building block versions that are in use. */
  async selectUsageUpdateSource(key: string, versionTag: string) {
    await this.usageUpdateTestId('sourceKeyComboBox').locator('input').fill(key);
    await this.page
      .getByTestId(`${BUILDING_BLOCK_USAGE_UPDATE_SOURCE_KEY_OPTION_TEST_ID_PREFIX}${key}`)
      .click();
    const sourceVersionInput = this.usageUpdateTestId('sourceVersionComboBox').locator('input');
    const autoSelected = await expect(sourceVersionInput)
      .toHaveValue(versionTag, {timeout: 2000})
      .then(() => true)
      .catch(() => false);
    if (!autoSelected) {
      await sourceVersionInput.fill(versionTag);
      await this.page
        .getByTestId(
          `${BUILDING_BLOCK_USAGE_UPDATE_SOURCE_OPTION_TEST_ID_PREFIX}${key}-${versionTag}`
        )
        .click();
      await expect(sourceVersionInput).toHaveValue(versionTag);
    }
    await this.goToNextUsageUpdateStep();
  }

  /** Step 2: another version of the same key. */
  async selectUsageUpdateTarget(versionTag: string) {
    await this.usageUpdateTestId('targetComboBox').locator('input').fill(versionTag);
    await this.page
      .getByTestId(`${BUILDING_BLOCK_USAGE_UPDATE_TARGET_OPTION_TEST_ID_PREFIX}${versionTag}`)
      .click();
    await this.goToNextUsageUpdateStep();
    await expect(this.usageUpdateChains.first()).toBeVisible();
  }

  usageUpdateChainCheckbox(containerKey: string) {
    return this.usageUpdateChain(containerKey).locator('input[type="checkbox"]');
  }

  // Click the label — host click doesn't emit `checkedChange`
  async selectUsageUpdateChain(containerKey: string) {
    await this.usageUpdateChain(containerKey)
      .getByTestId(BUILDING_BLOCK_MANAGEMENT_USAGE_UPDATE_TEST_IDS.chainCheckbox)
      .locator('label')
      .click();
    await expect(this.usageUpdateChainCheckbox(containerKey)).toBeChecked();
  }

  async goToNextUsageUpdateStep() {
    await expect(this.usageUpdateNextButton).toBeEnabled();
    await this.usageUpdateNextButton.click();
  }

  async confirmUsageUpdate() {
    await this.usageUpdateTestId('confirmCheckbox').locator('label').click();
  }

  async executeUsageUpdate(): Promise<Response> {
    await expect(this.usageUpdateExecuteButton).toBeEnabled();
    const [response] = await Promise.all([
      this.page.waitForResponse(
        res =>
          res.url().endsWith(`${USAGE_UPDATE_API_URL}/execute`) &&
          res.request().method() === 'POST'
      ),
      this.usageUpdateExecuteButton.click(),
    ]);
    return response;
  }

  // ─── Usage update fixture API ────────────────────────────────

  async createBuildingBlockViaApi(key: string, versionTag: string) {
    await apiPost(BUILDING_BLOCK_API_URL, {
      key,
      name: key,
      versionTag,
      description: 'Building block created by the e2e building block usage update test.',
    });
  }

  async finalizeBuildingBlockViaApi(key: string, versionTag: string) {
    await apiPost(`${BUILDING_BLOCK_API_URL}/${key}/version/${versionTag}/finalize`, {});
  }

  async createBuildingBlockDraftViaApi(key: string, basedOnVersionTag: string, versionTag: string) {
    await apiPost(`${BUILDING_BLOCK_API_URL}/${key}/version/${basedOnVersionTag}/draft`, {
      versionTag,
    });
  }

  private async getMainProcessDefinitionIdViaApi(key: string, versionTag: string) {
    const processes = await apiGet<{id: string; main: boolean}[]>(
      `${BUILDING_BLOCK_API_URL}/${key}/version/${versionTag}/process-definition`
    );
    const main = processes.find(process => process.main);
    expect(main, `${key} ${versionTag} has a main process definition`).toBeDefined();
    return main!.id;
  }

  // Uses the process editor's multipart endpoint, so the link is stored as in the UI
  async linkMainProcessToBuildingBlockViaApi(
    key: string,
    versionTag: string,
    activityId: string,
    childKey: string,
    childVersionTag: string
  ) {
    // Multipart PUT reuses PLAYWRIGHT_BEARER_TOKEN; api utils refresh it on 401
    const processDefinitionId = await this.getMainProcessDefinitionIdViaApi(key, versionTag);
    const processLinks = [
      {
        processLinkType: 'building-block',
        processDefinitionId,
        activityId,
        activityType: 'bpmn:CallActivity:start',
        buildingBlockDefinitionKey: childKey,
        buildingBlockDefinitionVersionTag: childVersionTag,
        pluginConfigurationMappings: {},
        inputMappings: [],
        outputMappings: [],
      },
    ];
    const response = await this.request.put(
      `${BUILDING_BLOCK_API_URL}/${key}/version/${versionTag}/process-definition/${processDefinitionId}`,
      {
        headers: {Authorization: `Bearer ${process.env.PLAYWRIGHT_BEARER_TOKEN}`},
        multipart: {
          file: {
            name: `${key}.bpmn`,
            mimeType: 'text/xml',
            buffer: Buffer.from(callActivityBpmn(key, activityId, childKey, childVersionTag)),
          },
          processLinks: {
            name: 'processLinks.json',
            mimeType: 'application/json',
            buffer: Buffer.from(JSON.stringify(processLinks)),
          },
          main: {name: 'main.json', mimeType: 'application/json', buffer: Buffer.from('true')},
        },
      }
    );
    expect(response.status(), await response.text()).toBe(204);
  }

  /** The building block process link on `activityId` in the main process of a version. */
  async getBuildingBlockProcessLinkViaApi(
    key: string,
    versionTag: string,
    activityId: string
  ): Promise<BuildingBlockProcessLink | undefined> {
    const processDefinitionId = await this.getMainProcessDefinitionIdViaApi(key, versionTag);
    const links = await apiGet<BuildingBlockProcessLink[]>(
      `${PROCESS_LINK_API_URL}?processDefinitionId=${encodeURIComponent(processDefinitionId)}`
    );
    return links.find(link => link.activityId === activityId);
  }

  async getBuildingBlockVersionsViaApi(key: string): Promise<BuildingBlockVersion[]> {
    const page = await apiGet<{content: BuildingBlockVersion[]}>(
      `${BUILDING_BLOCK_API_URL}/${key}/version?all=true`
    );
    return page.content;
  }

  // ─── API helpers ──────────────────────────────────────────────────

  async getBuildingBlocksViaApi(): Promise<BuildingBlockDefinition[]> {
    return apiGet<BuildingBlockDefinition[]>(BUILDING_BLOCK_API_URL);
  }

  async getBuildingBlockViaApi(key: string, versionTag: string): Promise<BuildingBlockDefinition> {
    return apiGet<BuildingBlockDefinition>(
      `${BUILDING_BLOCK_API_URL}/${key}/version/${versionTag}`
    );
  }

  /**
   * Best-effort cleanup of a building block created during a test.
   *
   * The management API currently exposes no DELETE for building block
   * definitions (`BuildingBlockManagementResource` only serves GET/POST/PUT), so
   * this call fails and is swallowed — building blocks created through the UI
   * stay behind. The helper is kept in place so cleanup starts working as soon
   * as the endpoint is added.
   */
  async deleteBuildingBlockViaApi(key: string, versionTag: string) {
    try {
      await apiDelete(`${BUILDING_BLOCK_API_URL}/${key}/version/${versionTag}`);
    } catch {
      // No DELETE endpoint yet — nothing to do.
    }
  }
}
