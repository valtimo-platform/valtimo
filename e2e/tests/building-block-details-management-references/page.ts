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

import {type APIRequestContext, type Page, type Response, expect} from '@playwright/test';
import {
  BUILDING_BLOCK_MANAGEMENT_LIST_TEST_IDS,
  BUILDING_BLOCK_MANAGEMENT_REFERENCES_TEST_IDS,
  BUILDING_BLOCK_MANAGEMENT_REFERENCE_UPDATE_TEST_IDS,
  BUILDING_BLOCK_REFERENCE_UPDATE_SOURCE_KEY_OPTION_TEST_ID_PREFIX,
  BUILDING_BLOCK_REFERENCE_UPDATE_SOURCE_OPTION_TEST_ID_PREFIX,
  BUILDING_BLOCK_REFERENCE_UPDATE_TARGET_OPTION_TEST_ID_PREFIX,
  VALUE_PATH_SELECTOR_TEST_IDS,
} from '../../constants';
import {CarbonList} from '../../shared/carbon-list/carbon-list.utils';
import {apiDelete, apiGet, apiPost, apiPut, apiPutMultipart} from '../../utils/api.utils';
import {
  BUILDING_BLOCK_TABS,
  BuildingBlockDetailsPage,
} from '../building-block-details-management/page';

const BUILDING_BLOCK_API_URL = '/api/management/v1/building-block';
const REFERENCE_UPDATE_API_URL = `${BUILDING_BLOCK_API_URL}/reference-update`;
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

type DocumentSchema = {required?: string[]; properties?: Record<string, unknown>};

export class BuildingBlockReferencesPage {
  readonly details: BuildingBlockDetailsPage;
  readonly referencesList: CarbonList;

  constructor(
    private readonly page: Page,
    request: APIRequestContext
  ) {
    this.details = new BuildingBlockDetailsPage(page, request);
    this.referencesList = new CarbonList(
      page,
      page.locator('valtimo-building-block-management-references')
    );
  }

  // ─── References tab & reference update wizard locators ───────────

  /** On the building block management list, not the references tab. */
  get updateReferencesButton() {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_LIST_TEST_IDS.updateReferencesButton);
  }

  /** A row of the references tab, identified by its container key. */
  referenceRow(containerKey: string) {
    return this.referencesList.rows.filter({hasText: containerKey});
  }

  /** The "Go to" link of a references tab row. */
  referenceLink(containerKey: string) {
    return this.referenceRow(containerKey).getByTestId(
      BUILDING_BLOCK_MANAGEMENT_REFERENCES_TEST_IDS.referenceLink
    );
  }

  private referenceUpdateTestId(
    id: keyof typeof BUILDING_BLOCK_MANAGEMENT_REFERENCE_UPDATE_TEST_IDS
  ) {
    return this.page.getByTestId(BUILDING_BLOCK_MANAGEMENT_REFERENCE_UPDATE_TEST_IDS[id]);
  }

  get referenceUpdateChains() {
    return this.referenceUpdateTestId('chain');
  }

  /** A chain of the chains step, identified by the exact key of its top container. */
  referenceUpdateChain(topContainerKey: string) {
    return this.page.locator(
      `[data-test-id="${BUILDING_BLOCK_MANAGEMENT_REFERENCE_UPDATE_TEST_IDS.chain}"][data-top-container="${topContainerKey}"]`
    );
  }

  /** A reason a chain cannot be updated, by backend reason code — independent of the UI language. */
  referenceUpdateChainReason(topContainerKey: string, reasonCode: string) {
    return this.referenceUpdateChain(topContainerKey)
      .getByTestId(BUILDING_BLOCK_MANAGEMENT_REFERENCE_UPDATE_TEST_IDS.chainNotUpdatable)
      .locator(`[data-reason-code="${reasonCode}"]`);
  }

  get referenceUpdateDifferences() {
    return this.referenceUpdateTestId('differences');
  }

  get referenceUpdateInputMappings() {
    return this.referenceUpdateTestId('inputMapping');
  }

  get referenceUpdateInputPathInvalid() {
    return this.referenceUpdateTestId('inputPathInvalid');
  }

  get referenceUpdateReview() {
    return this.referenceUpdateTestId('review');
  }

  get referenceUpdateReviewDraftsToCreate() {
    return this.referenceUpdateTestId('reviewDraftsToCreate');
  }

  get referenceUpdateReviewDraftsToModify() {
    return this.referenceUpdateTestId('reviewDraftsToModify');
  }

  get referenceUpdateReviewLinksToRepoint() {
    return this.referenceUpdateTestId('reviewLinksToRepoint');
  }

  get referenceUpdateResult() {
    return this.referenceUpdateTestId('result');
  }

  get referenceUpdateDraftLinks() {
    return this.referenceUpdateTestId('draftLink');
  }

  get referenceUpdateCreatedDraftLinks() {
    return this.referenceUpdateTestId('resultDraftsCreated').getByTestId(
      BUILDING_BLOCK_MANAGEMENT_REFERENCE_UPDATE_TEST_IDS.draftLink
    );
  }

  get referenceUpdateModifiedDraftLinks() {
    return this.referenceUpdateTestId('resultDraftsModified').getByTestId(
      BUILDING_BLOCK_MANAGEMENT_REFERENCE_UPDATE_TEST_IDS.draftLink
    );
  }

  get referenceUpdateRemainingReferences() {
    return this.referenceUpdateTestId('remainingReferences');
  }

  get referenceUpdateNextButton() {
    return this.referenceUpdateTestId('nextButton');
  }

  get referenceUpdateExecuteButton() {
    return this.referenceUpdateTestId('executeButton');
  }

  // ─── Navigation ───────────────────────────────────────────────────

  async goToReferencesTab(key: string, versionTag: string) {
    await this.details.goToTab(key, versionTag, BUILDING_BLOCK_TABS.references);
    await this.referencesList.waitForLoaded();
  }

  // ─── Reference update wizard ─────────────────────────────────────

  /** Opens the wizard from the building block list and completes the source step. */
  async openReferenceUpdateWizard(key: string, versionTag: string) {
    await this.page.goto('/building-block-management');
    await expect(this.updateReferencesButton).toBeEnabled();
    await this.updateReferencesButton.click();

    await this.referenceUpdateTestId('sourceKeyComboBox').locator('input').fill(key);
    await this.page
      .getByTestId(`${BUILDING_BLOCK_REFERENCE_UPDATE_SOURCE_KEY_OPTION_TEST_ID_PREFIX}${key}`)
      .click();

    // Only referenced version is preselected
    const versionInput = this.referenceUpdateTestId('sourceVersionComboBox').locator('input');
    await expect(versionInput).toBeEnabled();
    if ((await versionInput.inputValue()) !== versionTag) {
      await versionInput.fill(versionTag);
      await this.page
        .getByTestId(
          `${BUILDING_BLOCK_REFERENCE_UPDATE_SOURCE_OPTION_TEST_ID_PREFIX}${key}-${versionTag}`
        )
        .click();
    }

    await this.goToNextReferenceUpdateStep();
    await expect(this.referenceUpdateTestId('targetKeyComboBox')).toBeVisible();
  }

  /** Target step: another building block as target. */
  async selectReferenceUpdateTargetKey(key: string) {
    await this.referenceUpdateTestId('targetKeyComboBox').locator('input').fill(key);
    await this.page
      .getByRole('option', {name: new RegExp(key)})
      .first()
      .click();
  }

  /** Target step: another version of the same key. */
  async selectReferenceUpdateTarget(versionTag: string) {
    await this.referenceUpdateTestId('targetComboBox').locator('input').fill(versionTag);
    await this.page
      .getByTestId(`${BUILDING_BLOCK_REFERENCE_UPDATE_TARGET_OPTION_TEST_ID_PREFIX}${versionTag}`)
      .click();
    await this.goToNextReferenceUpdateStep();
    await expect(this.referenceUpdateChains.first()).toBeVisible();
  }

  referenceUpdateChainCheckbox(containerKey: string) {
    return this.referenceUpdateChain(containerKey).locator('input[type="checkbox"]');
  }

  // Click the label — host click doesn't emit `checkedChange`
  async selectReferenceUpdateChain(containerKey: string) {
    await this.referenceUpdateChain(containerKey)
      .getByTestId(BUILDING_BLOCK_MANAGEMENT_REFERENCE_UPDATE_TEST_IDS.chainCheckbox)
      .locator('label')
      .click();
    await expect(this.referenceUpdateChainCheckbox(containerKey)).toBeChecked();
  }

  /** Step 3: type a source path for the only required input, in manual mode. */
  async enterReferenceUpdateInputPath(inputPath: string) {
    const mapping = this.referenceUpdateInputMappings.first();
    const input = mapping.getByTestId(VALUE_PATH_SELECTOR_TEST_IDS.input);
    if (!(await input.isVisible())) {
      await mapping
        .getByTestId(VALUE_PATH_SELECTOR_TEST_IDS.toggle)
        .locator('.cds--toggle__switch')
        .click();
    }
    await input.fill(inputPath);
  }

  async goToNextReferenceUpdateStep() {
    await expect(this.referenceUpdateNextButton).toBeEnabled();
    await this.referenceUpdateNextButton.click();
  }

  async closeReferenceUpdateWizard() {
    await this.referenceUpdateTestId('closeButton').click();
    await expect(this.referenceUpdateTestId('closeButton')).toBeHidden();
  }

  async cancelReferenceUpdateWizard() {
    await this.referenceUpdateTestId('cancelButton').click();
    await expect(this.referenceUpdateTestId('cancelButton')).toBeHidden();
  }

  async confirmReferenceUpdate() {
    await this.referenceUpdateTestId('confirmCheckbox').locator('label').click();
  }

  async executeReferenceUpdate(): Promise<Response> {
    await expect(this.referenceUpdateExecuteButton).toBeEnabled();
    const [response] = await Promise.all([
      this.page.waitForResponse(
        res =>
          res.url().endsWith(`${REFERENCE_UPDATE_API_URL}/execute`) &&
          res.request().method() === 'POST'
      ),
      this.referenceUpdateExecuteButton.click(),
    ]);
    return response;
  }

  // ─── Reference update fixture API ────────────────────────────────

  async createBuildingBlockViaApi(key: string, versionTag: string) {
    await apiPost(BUILDING_BLOCK_API_URL, {
      key,
      name: key,
      versionTag,
      description: 'Building block created by the e2e building block reference update test.',
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

  /** Adds a required string field to the document of a draft version. */
  async addRequiredDocumentFieldViaApi(key: string, versionTag: string, field: string) {
    const url = `${BUILDING_BLOCK_API_URL}/${key}/version/${versionTag}/document`;
    const schema = await apiGet<DocumentSchema>(url);
    await apiPut(url, {
      ...schema,
      required: [...(schema.required ?? []), field],
      properties: {...(schema.properties ?? {}), [field]: {type: 'string'}},
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
    await apiPutMultipart(
      `${BUILDING_BLOCK_API_URL}/${key}/version/${versionTag}/process-definition/${processDefinitionId}`,
      {
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
      }
    );
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

  /** Best-effort: no building block DELETE endpoint exists yet, so this is swallowed. */
  async deleteBuildingBlockViaApi(key: string, versionTag: string) {
    try {
      await apiDelete(`${BUILDING_BLOCK_API_URL}/${key}/version/${versionTag}`);
    } catch {
      // No DELETE endpoint yet — nothing to do.
    }
  }
}
