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
import path from 'path';
import {
  BB_MAPPINGS_TEST_IDS,
  VALUE_PATH_SELECTOR_TEST_IDS,
} from '../../constants';
import {CarbonList} from '../../shared/carbon-list/carbon-list.utils';
import {apiDelete} from '../../utils/api.utils';
import {ensureDraftVersionSelected} from '../../utils/version.utils';

const BPMN_ASSET_PATH = path.resolve(__dirname, '../../assets/e2e-test-process.bpmn');

export class CaseDetailsProcessLinksPage {
  readonly carbonList: CarbonList;
  private readonly processListScope: Locator;

  constructor(
    private readonly page: Page,
    private readonly request: APIRequestContext
  ) {
    this.processListScope = page.locator('valtimo-process-management-list');
    this.carbonList = new CarbonList(page, this.processListScope);
  }

  // ─── Navigation + process setup ───────────────────────────────────

  async goToCaseProcesses(caseKey: string): Promise<string> {
    await this.page.getByRole('button', {name: 'Admin'}).click();
    await this.page.getByRole('link', {name: 'Cases'}).click();
    await this.page.waitForSelector('valtimo-carbon-list');
    await this.page.locator(`tr:has(td:has-text("${caseKey}"))`).click();
    await this.page.waitForURL(/\/case-management\/case\//);

    const draftVersion = await ensureDraftVersionSelected(this.page);

    await this.page.getByRole('tab', {name: 'Processes'}).click();
    await this.page.waitForURL(/\/processes/);
    await this.carbonList.waitForLoaded();

    return draftVersion;
  }

  async uploadTestProcess() {
    const uploadButton = this.carbonList.toolbar.getByRole('button').filter({hasText: /^$/}).first();
    await uploadButton.click();
    const modal = this.page.locator('valtimo-process-management-upload cds-modal');
    const submit = modal.getByRole('button', {name: 'Upload', exact: true});
    const fileInput = modal.locator('input[type="file"]');
    await fileInput.setInputFiles(BPMN_ASSET_PATH);
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(submit).not.toBeVisible();
    await this.carbonList.waitForLoaded();
  }

  async openProcessInBuilder(processName: string) {
    const row = this.carbonList.row(processName);
    await row.click();
    await this.page.waitForURL(/\/processes\/[^/]+$/);
    await expect(this.page.locator('.bpmn__container')).toBeVisible();

    await this.page.waitForFunction(
      () => !!(window as any).processManagementEditorService?.selectionProcessDefinition
    );
  }

  async openProcessLinkModal(options: {
    elementId?: string;
    elementType?: string;
    activityListenerType?: string;
    name?: string;
  } = {}) {
    const params = {
      elementId: options.elementId ?? 'StartEvent_1',
      elementType: options.elementType ?? 'bpmn:StartEvent',
      activityListenerType: options.activityListenerType ?? 'bpmn:StartEvent:start',
      name: options.name ?? 'Start',
    };

    await this.page.evaluate(p => {
      const service = (window as any).processManagementEditorService;
      const selected = service.selectionProcessDefinition;
      service.sendOpenProcessLinkModalEvent(
        {
          modalParams: {
            processDefinitionKey: selected.key,
            processDefinitionId: selected.id,
            element: {
              id: p.elementId,
              type: p.elementType,
              activityListenerType: p.activityListenerType,
              name: p.name,
            },
          },
        },
        () => {}
      );
    }, params);

    await expect(this.modalFooter).toBeVisible();
  }

  async openProcessLinkModalForStartEvent(startEventId: string = 'StartEvent_1') {
    await this.openProcessLinkModal({elementId: startEventId});
    // StartEvent has multiple link types → chooser step is the first one shown
    await expect(this.typeChooserDescription).toBeVisible();
  }

  async openProcessLinkModalForServiceTask(elementId: string = 'StartEvent_1') {
    await this.openProcessLinkModal({
      elementId,
      elementType: 'bpmn:ServiceTask',
      activityListenerType: 'bpmn:ServiceTask:start',
      name: 'Service task',
    });
    await expect(this.selectPluginConfigurationComponent).toBeVisible();
  }

  async openProcessLinkModalForCallActivity(elementId: string = 'StartEvent_1') {
    await this.openProcessLinkModal({
      elementId,
      elementType: 'bpmn:CallActivity',
      activityListenerType: 'bpmn:CallActivity:start',
      name: 'Call activity',
    });
    await expect(this.typeChooserDescription).toBeVisible();
  }

  async clearInMemoryProcessLinks() {
    await this.page.evaluate(() => {
      const service = (window as any).processManagementEditorService;
      if (service?.setProcessLinksForSelectedDefinition) {
        service.setProcessLinksForSelectedDefinition([]);
      }
    });
  }

  // ─── Modal locators ───────────────────────────────────────────────

  get modal() {
    return this.page.locator('valtimo-process-link-modal cds-modal');
  }

  get typeChooserDescription() {
    return this.page.locator('valtimo-choose-process-link-type');
  }

  typeButton(label: 'Form' | 'FormFlow' | 'Plugin' | 'Building block') {
    return this.typeChooserDescription.getByRole('button', {name: label, exact: true});
  }

  // Form step
  get selectFormComponent() {
    return this.page.locator('valtimo-select-form');
  }

  get formComboBox() {
    return this.selectFormComponent.locator('cds-combo-box');
  }

  // Form-flow step
  get selectFormFlowComponent() {
    return this.page.locator('valtimo-select-form-flow');
  }

  get formFlowComboBox() {
    return this.selectFormFlowComponent.locator('cds-combo-box');
  }

  // Plugin configuration step
  get selectPluginConfigurationComponent() {
    return this.page.locator('valtimo-select-plugin-configuration');
  }

  // Plugin action step
  get selectPluginActionComponent() {
    return this.page.locator('valtimo-select-plugin-action');
  }

  // Building block selection step (6.18 / 6.19)
  get selectBuildingBlockComponent() {
    return this.page.locator('valtimo-select-building-block');
  }

  get buildingBlockRows() {
    return this.selectBuildingBlockComponent.locator('cds-list-row');
  }

  buildingBlockRow(name: string) {
    return this.buildingBlockRows.filter({hasText: name}).first();
  }

  get buildingBlockListHeader() {
    return this.selectBuildingBlockComponent.locator('cds-list-header');
  }

  get configureBBPluginsComponent() {
    return this.page.locator('valtimo-configure-building-block-plugins');
  }

  get bbVersionComboBox() {
    return this.configureBBPluginsComponent.locator('.version-select cds-combo-box');
  }

  get bbPluginRows() {
    return this.configureBBPluginsComponent.locator('.plugin-row');
  }

  bbPluginRowByLabel(pluginLabel: string) {
    return this.configureBBPluginsComponent
      .locator('.plugin-row')
      .filter({has: this.page.locator('.plugin-label', {hasText: pluginLabel})})
      .first();
  }

  get bbPluginDependenciesNotification() {
    return this.configureBBPluginsComponent.locator(
      '.configure-building-block-plugins__warning cds-notification'
    );
  }

  // Building block — configure-mappings step (6.22-6.31)
  get configureBBMappingsComponent() {
    return this.page.locator('valtimo-configure-building-block-mappings');
  }

  get bbMappingsInputSection() {
    return this.page.getByTestId(BB_MAPPINGS_TEST_IDS.inputSection);
  }

  get bbMappingsOutputSection() {
    return this.page.getByTestId(BB_MAPPINGS_TEST_IDS.outputSection);
  }

  get bbMappingsAddInputButton() {
    return this.page.getByTestId(BB_MAPPINGS_TEST_IDS.addInputButton);
  }

  get bbMappingsAddOutputButton() {
    return this.page.getByTestId(BB_MAPPINGS_TEST_IDS.addOutputButton);
  }

  get bbMappingsInputRows() {
    return this.page.getByTestId(BB_MAPPINGS_TEST_IDS.inputRow);
  }

  get bbMappingsOutputRows() {
    return this.page.getByTestId(BB_MAPPINGS_TEST_IDS.outputRow);
  }

  /** All required indicator markers (*) shown on non-deletable required input rows. */
  get bbMappingsRequiredIndicators() {
    return this.page.getByTestId(BB_MAPPINGS_TEST_IDS.inputRequiredIndicator);
  }

  /** Required-target read-only labels ("doc:applicantName" etc) on required rows. */
  get bbMappingsRequiredTargetLabels() {
    return this.page.getByTestId(BB_MAPPINGS_TEST_IDS.inputRequiredTargetLabel);
  }

  get bbMappingsLastInputRow() {
    return this.bbMappingsInputRows.last();
  }

  /** The value-path-selector toggle (dropdown ↔ manual) inside a given row. */
  valuePathSelectorToggle(row: Locator) {
    return row.getByTestId(VALUE_PATH_SELECTOR_TEST_IDS.toggle);
  }

  /** The value-path-selector combo-box (dropdown mode). */
  valuePathSelectorCombo(row: Locator) {
    return row.getByTestId(VALUE_PATH_SELECTOR_TEST_IDS.path);
  }

  /** The value-path-selector plain text input (manual mode). */
  valuePathSelectorInput(row: Locator) {
    return row.getByTestId(VALUE_PATH_SELECTOR_TEST_IDS.input);
  }

  /** Target v-select wrapper inside a given input row (6.25). */
  inputTargetSelectWrapper(row: Locator) {
    return row.getByTestId(BB_MAPPINGS_TEST_IDS.inputTargetSelectWrapper);
  }

  async clickAddInputMapping() {
    await expect(this.bbMappingsAddInputButton).toBeVisible();
    await this.bbMappingsAddInputButton.click();
  }

  async clickAddOutputMapping() {
    await expect(this.bbMappingsAddOutputButton).toBeVisible();
    await this.bbMappingsAddOutputButton.click();
  }

  outputSourceSelectWrapper(row: Locator) {
    return row.getByTestId(BB_MAPPINGS_TEST_IDS.outputSourceSelectWrapper);
  }

  inputDeleteButton(row: Locator) {
    return row.getByTestId(BB_MAPPINGS_TEST_IDS.inputDeleteButton);
  }

  outputDeleteButton(row: Locator) {
    return row.getByTestId(BB_MAPPINGS_TEST_IDS.outputDeleteButton);
  }

  get bbMappingsLastOutputRow() {
    return this.bbMappingsOutputRows.last();
  }

  async fillValuePathSelectorManual(row: Locator, path: string) {
    const toggle = this.valuePathSelectorToggle(row);
    await expect(toggle).toBeVisible();
    // When toggle is ON (dropdown mode), clicking switches to manual (OFF)
    const switchControl = toggle.getByRole('switch');
    if (await switchControl.isChecked()) {
      await toggle.locator('.cds--toggle__switch').click();
      await expect(switchControl).not.toBeChecked();
    }
    const input = this.valuePathSelectorInput(row);
    await expect(input).toBeVisible();
    await input.fill(path);
  }

  async fillRequiredInputMappings() {
    const indicators = await this.bbMappingsRequiredIndicators.count();
    for (let i = 0; i < indicators; i++) {
      const row = this.bbMappingsInputRows.nth(i);
      await this.fillValuePathSelectorManual(row, `doc:bbTestSource${i}`);
    }
  }

  private get modalFooter() {
    return this.page.locator('cds-modal-footer');
  }

  get nextButton() {
    return this.modalFooter.getByRole('button', {name: 'Next', exact: true});
  }

  get completeButton() {
    return this.modalFooter.getByRole('button', {name: 'Complete', exact: true});
  }

  get backButton() {
    return this.modalFooter.getByRole('button', {name: 'Go back', exact: true});
  }

  get cancelModalButton() {
    return this.modalFooter.getByRole('button', {name: 'Cancel', exact: true});
  }

  // ─── Interactions ─────────────────────────────────────────────────

  async chooseLinkType(type: 'Form' | 'FormFlow' | 'Plugin' | 'Building block') {
    await this.typeButton(type).click();
  }

  async selectFormByName(formName: string) {
    await expect(this.formComboBox).toBeVisible();
    await this.formComboBox.click();
    await this.page
      .getByRole('listbox')
      .locator('[role="option"]')
      .filter({hasText: formName})
      .first()
      .click();
  }

  async selectFormFlowByKey(flowKey: string) {
    await expect(this.formFlowComboBox).toBeVisible();
    await this.formFlowComboBox.click();
    await this.page
      .getByRole('listbox')
      .locator('[role="option"]')
      .filter({hasText: flowKey})
      .first()
      .click();
  }

  async selectPluginConfigurationByTitle(title: string) {
    await expect(this.selectPluginConfigurationComponent).toBeVisible();
    // Carbon's cds-list-row renders the radio input with `cds--visually-hidden`
    // (a11y-compliant hidden input). Playwright refuses to interact with hidden
    // elements by default — use `force: true` to click the radio directly.
    const row = this.selectPluginConfigurationComponent
      .locator('cds-list-row')
      .filter({hasText: title})
      .first();
    await row.locator('input[type="radio"]').click({force: true});
  }

  async selectBuildingBlockByName(name: string) {
    await expect(this.selectBuildingBlockComponent).toBeVisible();
    const row = this.buildingBlockRow(name);
    await expect(row).toBeVisible();
    await row.locator('input[type="radio"]').click({force: true});
  }

  private async selectComboBoxOption(combo: Locator, optionText: string) {
    await combo.click();
    await this.page
      .getByRole('listbox')
      .locator('[role="option"]')
      .filter({hasText: optionText})
      .first()
      .click();
  }

  /** 6.20 — pick a version from the Choose-building-block-version combo. */
  async selectBBVersion(version: string) {
    await expect(this.bbVersionComboBox).toBeVisible();
    await this.selectComboBoxOption(this.bbVersionComboBox, version);
  }

  /**
   * 6.21 — assign a plugin configuration for a specific plugin-mapping row.
   * `pluginLabel` matches the visible label on the left (e.g. "Zaken API").
   */
  async selectBBPluginConfiguration(pluginLabel: string, configName: string) {
    const row = this.bbPluginRowByLabel(pluginLabel);
    await expect(row).toBeVisible();
    const combo = row.locator('cds-combo-box');
    await this.selectComboBoxOption(combo, configName);
  }

  async selectPluginActionByLabel(label: string) {
    await expect(this.selectPluginActionComponent).toBeVisible();
    await this.selectPluginActionComponent
      .locator('cds-selection-tile')
      .filter({hasText: label})
      .first()
      .click();
  }

  async clickNext() {
    await expect(this.nextButton).toBeEnabled();
    await this.nextButton.click();
  }

  async clickComplete() {
    await expect(this.completeButton).toBeEnabled();
    await this.completeButton.click();
  }

  async cancelModal() {
    await this.cancelModalButton.click();
    await expect(this.modal).toHaveAttribute('ng-reflect-open', 'false');
    await this.page.waitForTimeout(300);
  }

  async waitForModalClosed() {
    await expect(this.modal).toHaveAttribute('ng-reflect-open', 'false', {timeout: 10_000});
    await this.page.waitForTimeout(300);
  }

  // ─── Assertions ───────────────────────────────────────────────────

  async assertLinkExists(activityId: string) {
    const exists = await this.page.evaluate(id => {
      const service = (window as any).processManagementEditorService;
      const links = service?.processLinksForSelectedDefinition || [];
      return links.some((l: {activityId: string}) => l.activityId === id);
    }, activityId);
    expect(exists, `expected a process link for activity "${activityId}"`).toBe(true);
  }

  // ─── API cleanup ──────────────────────────────────────────────────

  async deleteProcessViaApi(caseKey: string, version: string, processKey: string) {
    try {
      await apiDelete(
        `/api/management/v1/case-definition/${caseKey}/version/${version}/process-definition/key/${processKey}`
      );
    } catch {
      // Ignore — process may not exist
    }
  }
}
