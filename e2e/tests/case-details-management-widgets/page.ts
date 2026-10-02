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

import {type APIRequestContext, expect, type Page} from '@playwright/test';
import * as ApiUtils from '../../utils/api.utils';
import {CarbonList} from '../../shared/carbon-list/carbon-list.utils';
import {JsonEditor} from '../../shared/json-editor/json-editor.utils';
import {ensureDraftVersionSelected} from '../../utils/version.utils';
import {
  WIDGET_EDITOR_TEST_IDS,
  WIDGET_WIZARD_TEST_IDS,
  WIDGET_WIZARD_TYPE_TEST_IDS,
  WIDGET_WIZARD_WIDTH_TEST_IDS,
  WIDGET_WIZARD_DENSITY_TEST_IDS,
  WIDGET_WIZARD_APPEARANCE_TEST_IDS,
  WIDGET_CONTENT_FIELDS_TEST_IDS,
  WIDGET_DIVIDER_MODAL_TEST_IDS,
  VALUE_PATH_SELECTOR_DROPDOWN_VALUE_TEST_IDS,
} from '../../constants';
import {fillValuePathManually} from '../../utils/value-path-selector.utils';

/** A single display condition as stored on a widget. */
export interface WidgetDisplayCondition {
  path: string;
  operator: string;
  value: string;
}

export interface WidgetConfigResponse {
  widgets: Array<{
    title: string;
    key: string;
    displayConditions?: WidgetDisplayCondition[];
    [k: string]: unknown;
  }>;
}

export class CaseDetailsManagementWidgetsPage {
  constructor(
    private readonly page: Page,
    private readonly request: APIRequestContext
  ) {}

  // ─── Navigation ───────────────────────────────────────────────────

  async goToCaseManagement(caseIdentifier: string) {
    await this.page.goto('/case-management');
    await this.page.waitForSelector('valtimo-carbon-list');
    await this.page.locator(`tr:has(td:has-text("${caseIdentifier}"))`).click();
  }

  async ensureDraftVersionSelected(): Promise<string> {
    return ensureDraftVersionSelected(this.page);
  }

  async goToWidgetTab() {
    await this.page.getByRole('tab', {name: 'Case details'}).click();
    await this.page.getByRole('tab', {name: 'Tabs'}).click();
    await this.page.getByRole('cell', {name: 'Widgets', exact: true}).click();
    await this.page.waitForSelector('valtimo-widget-management-editor');
  }

  /**
   * Extracts the widget tab key from the current page URL.
   * URL pattern: /case-management/case/{key}/version/{version}/case-details/widget-tab/{tabKey}
   */
  getWidgetTabKeyFromUrl(): string {
    const match = this.page.url().match(/\/widget-tab\/([^/]+)/);
    if (!match) {
      throw new Error(`Could not extract widget tab key from URL: ${this.page.url()}`);
    }
    return match[1];
  }

  // ─── Widget Wizard ────────────────────────────────────────────────

  get addWidgetButton() {
    return this.page.getByTestId(WIDGET_EDITOR_TEST_IDS.addWidgetButton);
  }

  get wizardNextButton() {
    return this.page.getByTestId(WIDGET_WIZARD_TEST_IDS.nextButton);
  }

  get wizardSaveButton() {
    return this.page.getByTestId(WIDGET_WIZARD_TEST_IDS.saveButton);
  }

  get wizardCancelButton() {
    return this.page.getByTestId(WIDGET_WIZARD_TEST_IDS.cancelButton);
  }

  async selectWidgetType(type: keyof typeof WIDGET_WIZARD_TYPE_TEST_IDS) {
    await this.page.getByTestId(WIDGET_WIZARD_TYPE_TEST_IDS[type]).click();
  }

  async selectWidgetWidth(width: keyof typeof WIDGET_WIZARD_WIDTH_TEST_IDS) {
    await this.page.getByTestId(WIDGET_WIZARD_WIDTH_TEST_IDS[width]).click();
  }

  async selectWidgetDensity(density: keyof typeof WIDGET_WIZARD_DENSITY_TEST_IDS) {
    await this.page.getByTestId(WIDGET_WIZARD_DENSITY_TEST_IDS[density]).click();
  }

  async selectWidgetColor(color: keyof typeof WIDGET_WIZARD_APPEARANCE_TEST_IDS) {
    await this.page.getByTestId(WIDGET_WIZARD_APPEARANCE_TEST_IDS[color]).click();
  }

  async fillWidgetTitle(title: string) {
    const titleInput = this.page.getByTestId(WIDGET_CONTENT_FIELDS_TEST_IDS.widgetTitleInput);
    await titleInput.click();
    await titleInput.fill(title);
  }

  async fillFieldTitle(title: string) {
    const fieldTitleInput = this.page.getByTestId(WIDGET_CONTENT_FIELDS_TEST_IDS.fieldTitleInput);
    await fieldTitleInput.click();
    await fieldTitleInput.fill(title);
  }

  async selectDisplayType(typeName: string) {
    await this.page.getByTestId(WIDGET_CONTENT_FIELDS_TEST_IDS.displayTypeDropdown).click();
    await this.page.getByText(typeName, {exact: true}).click();
  }

  async selectValuePath(pathText: string) {
    const selector = this.page.getByTestId(WIDGET_CONTENT_FIELDS_TEST_IDS.valuePathSelector);
    await selector.getByRole('combobox').click();
    // Match the option exactly: several paths share a prefix (e.g. `case:definitionId.key`
    // and `case:definitionId.versionTag`), so a substring match is ambiguous.
    await this.page.getByRole('option', {name: pathText, exact: true}).click();
  }

  /**
   * Creates a Fields widget through the wizard UI.
   * Steps: Type → Width → Density → Appearance → Content → Display Conditions (Save).
   */
  async addFieldsWidget(opts: {
    title: string;
    fieldTitle: string;
    valuePath: string;
    /** Optional display condition, set on the final wizard step before saving (6.94). */
    condition?: {path: string; operatorLabel: string; value: string};
  }) {
    const {title, fieldTitle, valuePath, condition} = opts;

    // Step 1: Select type
    await this.addWidgetButton.click();
    await this.selectWidgetType('tileFields');
    await expect(this.wizardNextButton).toBeEnabled();
    await this.wizardNextButton.click();

    // Step 2: Select width
    await this.selectWidgetWidth('tileMedium');
    await expect(this.wizardNextButton).toBeEnabled();
    await this.wizardNextButton.click();

    // Step 3: Select density
    await this.selectWidgetDensity('tileDefault');
    await expect(this.wizardNextButton).toBeEnabled();
    await this.wizardNextButton.click();

    // Step 4: Select appearance/color
    await this.selectWidgetColor('tileWhite');
    await expect(this.wizardNextButton).toBeEnabled();
    await this.wizardNextButton.click();

    // Step 5: Fill content
    await this.fillWidgetTitle(title);
    await this.fillFieldTitle(fieldTitle);
    await this.selectDisplayType('Text');
    await this.selectValuePath(valuePath);
    await expect(this.wizardNextButton).toBeEnabled();
    await this.wizardNextButton.click();

    // Step 6: Display conditions — optional; with no conditions the widget always shows
    if (condition) {
      await this.addDisplayCondition(condition);
    }
    await expect(this.wizardSaveButton).toBeEnabled();
    await this.wizardSaveButton.click();

    // Wait for the wizard modal to close and the list to refresh
    await this.waitForWizardClosed();
  }

  // ─── 6.94 Display Conditions ───────────────────────────────────────
  //
  // The conditions step renders a `valtimo-carbon-multi-input` named `displayConditions`; each
  // row is a value-path-selector (path) + dropdown (operator) + text input (value).

  get conditionsAddButton() {
    return this.visibleWizard.getByTestId('multiInputAddButton-displayConditions');
  }

  conditionRow(index = 0) {
    return this.visibleWizard.getByTestId(`multiInputValuePathSelectorDropdownValue-${index}`);
  }

  conditionDeleteButton(index = 0) {
    return this.visibleWizard.getByTestId(`multiInputDeleteButton-${index}`);
  }

  get conditionOperatorDropdown() {
    return this.visibleWizard.getByTestId(VALUE_PATH_SELECTOR_DROPDOWN_VALUE_TEST_IDS.dropdown);
  }

  get conditionValueInput() {
    return this.visibleWizard.getByTestId(VALUE_PATH_SELECTOR_DROPDOWN_VALUE_TEST_IDS.valueInput);
  }

  /**
   * The currently open modal.
   *
   * Scoping matters here: the wizard component stays in the DOM when closed, so unscoped
   * `getByTestId` also matches the hidden wizard. Note `cds-modal[open]` never matches anything —
   * Carbon toggles the `is-visible` class instead — so it cannot be used to detect open modals.
   */
  get visibleWizard() {
    return this.page.locator('.cds--modal.is-visible');
  }

  get wizardHeading() {
    return this.visibleWizard.getByTestId(WIDGET_WIZARD_TEST_IDS.heading);
  }

  async waitForWizardClosed() {
    await expect(this.visibleWizard).toHaveCount(0, {timeout: 10_000});
  }

  /**
   * Opens the edit wizard for an existing widget by clicking its row.
   *
   * Clicking a row while the previous wizard is still closing can re-open the *create* wizard
   * instead, so wait for a clean slate first and retry until the edit wizard is actually up.
   */
  async openWidgetEditWizard(widgetTitle: string) {
    const list = new CarbonList(this.page);
    await this.waitForWizardClosed();

    await expect(async () => {
      if ((await this.wizardHeading.count()) > 0) {
        if ((await this.wizardHeading.innerText()).trim() === 'Edit widget') return;
        // A create wizard opened instead — dismiss it and try again.
        await this.wizardCancelButton.click();
        await this.waitForWizardClosed();
      }
      await list.row(widgetTitle).click();
      await expect(this.wizardHeading).toHaveText('Edit widget', {timeout: 5_000});
    }).toPass({timeout: 30_000});
  }

  /**
   * Jumps to the display-conditions step via the wizard's progress indicator.
   *
   * The steps are rendered internally by Carbon's `cds-progress-indicator` from a `steps` input,
   * which offers no hook for a `data-test-id`, so the step is located by its (English) label —
   * global setup pins the UI language to English.
   */
  async goToDisplayConditionsStep() {
    const step = this.visibleWizard.getByRole('button', {name: /Set display conditions/});

    // The progress indicator can swallow a click while the previous step's content is still
    // being torn down, leaving the wizard on the old step. Retry until the step's content is up.
    await expect(async () => {
      await step.click();
      await expect(this.conditionsAddButton).toBeVisible({timeout: 3_000});
    }).toPass({timeout: 30_000});
  }

  /**
   * Fills condition row `index`. The path is entered in manual mode via the shared helper: the
   * selector's dropdown renders its options in an overlay outside the modal and the available
   * paths vary per environment, so typing the path is both simpler and more stable.
   */
  async fillDisplayCondition(
    condition: {path: string; operatorLabel: string; value: string},
    index = 0
  ) {
    const row = this.conditionRow(index);
    await expect(row).toBeVisible();

    await fillValuePathManually(row, condition.path);

    await this.conditionOperatorDropdown.click();
    // Carbon renders dropdown options in an overlay outside the modal, and the modal header can
    // overlap them, so the option is resolved page-wide and clicked with force.
    await this.page
      .getByRole('option', {name: condition.operatorLabel, exact: true})
      .click({force: true});

    await this.conditionValueInput.fill(condition.value);
    await expect(this.conditionValueInput).toHaveValue(condition.value);
  }

  /** Adds a condition row and fills it. */
  async addDisplayCondition(
    condition: {path: string; operatorLabel: string; value: string},
    index = 0
  ) {
    await this.conditionsAddButton.click();
    await this.fillDisplayCondition(condition, index);
  }

  /**
   * Opens the edit wizard for a widget, navigates to the display conditions step,
   * adds a single condition, and saves.
   */
  async setDisplayCondition(
    widgetTitle: string,
    condition: {path: string; operatorLabel: string; value: string}
  ) {
    await this.openWidgetEditWizard(widgetTitle);
    await this.goToDisplayConditionsStep();
    await this.addDisplayCondition(condition);

    await expect(this.wizardSaveButton).toBeEnabled();
    await this.wizardSaveButton.click();
    await expect(this.page.locator('cds-modal[open]')).toHaveCount(0, {timeout: 10_000});
  }

  // ─── 6.94 Assertions ───────────────────────────────────────────────

  async getWidgetConfigViaApi(
    caseDefinitionKey: string,
    versionTag: string,
    tabKey: string
  ): Promise<WidgetConfigResponse> {
    return ApiUtils.apiGet<WidgetConfigResponse>(
      `/api/management/v1/case-definition/${caseDefinitionKey}/version/${versionTag}/widget-tab/${tabKey}`
    );
  }

  /** Asserts the persisted `displayConditions` of a widget, polling until the save lands. */
  async assertWidgetDisplayConditions(
    caseDefinitionKey: string,
    versionTag: string,
    tabKey: string,
    widgetTitle: string,
    expected: WidgetDisplayCondition[]
  ) {
    await expect
      .poll(
        async () => {
          const config = await this.getWidgetConfigViaApi(caseDefinitionKey, versionTag, tabKey);
          return config.widgets.find(w => w.title === widgetTitle)?.displayConditions ?? null;
        },
        {message: `displayConditions of "${widgetTitle}" never matched`}
      )
      .toEqual(expected);
  }

  // ─── Divider Modal ─────────────────────────────────────────────────

  get addDividerButton() {
    return this.page.getByTestId(WIDGET_EDITOR_TEST_IDS.addDividerButton);
  }

  get dividerTitleInput() {
    return this.page.getByTestId(WIDGET_DIVIDER_MODAL_TEST_IDS.titleInput);
  }

  get dividerCreateButton() {
    return this.page.getByTestId(WIDGET_DIVIDER_MODAL_TEST_IDS.createButton);
  }

  get dividerCancelButton() {
    return this.page.getByTestId(WIDGET_DIVIDER_MODAL_TEST_IDS.cancelButton);
  }

  /**
   * Creates a divider (widget separator) through the divider modal.
   */
  async addDivider(title: string) {
    await this.addDividerButton.click();
    await this.dividerTitleInput.fill(title);
    await expect(this.dividerCreateButton).toBeEnabled();
    await this.dividerCreateButton.click();
    // Wait for the modal to close and the list to refresh
    await expect(this.page.locator('cds-modal[open]')).toHaveCount(0, {timeout: 10_000});
  }

  // ─── JSON Editor ───────────────────────────────────────────────────

  async switchToJsonEditor() {
    await this.page.getByRole('tab', {name: 'JSON editor'}).click();
  }

  async switchToVisualEditor() {
    await this.page.getByRole('tab', {name: 'Visual editor'}).click();
    // Wait for the carbon list to load
    const list = new CarbonList(this.page);
    await list.waitForLoaded();
  }

  /**
   * Reads the current widget configuration via API, returns the widgets array.
   */
  async getWidgetsViaApi(
    caseDefinitionKey: string,
    versionTag: string,
    tabKey: string
  ): Promise<Array<Record<string, unknown>>> {
    const config = await ApiUtils.apiGet<{widgets: Array<Record<string, unknown>>}>(
      `/api/management/v1/case-definition/${caseDefinitionKey}/version/${versionTag}/widget-tab/${tabKey}`
    );
    return config.widgets;
  }

  /**
   * Adds a widget via the JSON editor: reads current widgets, appends the new one, saves.
   */
  async addWidgetViaJsonEditor(
    caseDefinitionKey: string,
    versionTag: string,
    tabKey: string,
    widget: Record<string, unknown>
  ) {
    const currentWidgets = await this.getWidgetsViaApi(caseDefinitionKey, versionTag, tabKey);
    const updatedWidgets = [...currentWidgets, widget];

    await this.switchToJsonEditor();
    const jsonEditor = new JsonEditor(this.page);
    await jsonEditor.saveChanges(updatedWidgets);
    await this.switchToVisualEditor();
  }

  /**
   * Removes a widget by key via the JSON editor: reads current widgets, filters out, saves.
   */
  async removeWidgetViaJsonEditor(
    caseDefinitionKey: string,
    versionTag: string,
    tabKey: string,
    widgetKey: string
  ) {
    const currentWidgets = await this.getWidgetsViaApi(caseDefinitionKey, versionTag, tabKey);
    const filteredWidgets = currentWidgets.filter(w => w.key !== widgetKey);

    await this.switchToJsonEditor();
    const jsonEditor = new JsonEditor(this.page);
    await jsonEditor.saveChanges(filteredWidgets);
    await this.switchToVisualEditor();
  }

  // ─── Widget List ──────────────────────────────────────────────────

  get widgetList() {
    return this.page.locator('valtimo-carbon-list');
  }

  async assertWidgetVisible(widgetTitle: string) {
    const list = new CarbonList(this.page);
    await list.waitForLoaded();
    const row = list.row(widgetTitle);
    await row.assertVisible();
  }

  async assertWidgetNotVisible(widgetTitle: string) {
    const list = new CarbonList(this.page);
    const row = list.row(widgetTitle);
    await row.assertNotVisible();
  }

  async assertWidgetTypeTag(widgetTitle: string, expectedType: string) {
    const list = new CarbonList(this.page);
    const row = list.row(widgetTitle);
    const tag = row.tags.first();
    await expect(tag).toHaveText(expectedType);
  }

  async assertWidgetRowContainsText(widgetTitle: string, expectedText: string) {
    const list = new CarbonList(this.page);
    const row = list.row(widgetTitle);
    const cell = row.cell(expectedText).first();
    await expect(cell).toBeVisible();
  }

  /**
   * Assert the text content of a specific column in the widget row.
   * Column indices (with drag-and-drop): 0=drag, 1=title, 2=type, 3=key, 4=width, 5=color, 6=density, 7=highContrast.
   */
  async assertWidgetCellByIndex(widgetTitle: string, columnIndex: number, expectedText: string) {
    const list = new CarbonList(this.page);
    const row = list.row(widgetTitle);
    const cell = row.cellByIndex(columnIndex);
    await expect(cell).toContainText(expectedText);
  }

  // ─── Widget Reorder ────────────────────────────────────────────────

  /**
   * Returns the widget titles in their current display order.
   * Column 1 = title (column 0 is the drag handle).
   */
  async getWidgetTitlesInOrder(): Promise<string[]> {
    const list = new CarbonList(this.page);
    await list.waitForLoaded();
    const rows = list.rows;
    const count = await rows.count();
    const titles: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await rows.nth(i).locator('td').nth(1).innerText();
      titles.push(text.trim());
    }
    return titles;
  }

  async dragWidgetToPosition(sourceTitle: string, targetTitle: string) {
    const list = new CarbonList(this.page);
    const sourceRow = list.row(sourceTitle);
    const targetRow = list.row(targetTitle);
    await list.dragRow(sourceRow, targetRow);
  }

  // ─── Widget Deletion via Overflow Menu ────────────────────────────

  async deleteWidgetViaOverflowMenu(widgetTitle: string) {
    const list = new CarbonList(this.page);
    const row = list.row(widgetTitle);
    await row.clickAction('Delete');
    // Confirm deletion in the confirmation modal
    const confirmModal = this.page.locator('valtimo-confirmation-modal');
    await confirmModal.getByRole('button', {name: 'Delete'}).click();
    // Wait for the list to refresh
    await list.waitForLoaded();
  }

  // ─── API Cleanup ──────────────────────────────────────────────────

  /**
   * Safety-net cleanup: removes widgets matching a title prefix from the widget tab via API.
   */
  async removeTestWidgetsViaApi(
    caseDefinitionKey: string,
    versionTag: string,
    tabKey: string,
    titlePrefix: string
  ) {
    try {
      const config = await ApiUtils.apiGet<{widgets: Array<{title: string; [k: string]: unknown}>}>(
        `/api/management/v1/case-definition/${caseDefinitionKey}/version/${versionTag}/widget-tab/${tabKey}`
      );
      const remaining = config.widgets.filter(w => !w.title.startsWith(titlePrefix));
      if (remaining.length !== config.widgets.length) {
        await ApiUtils.apiPost(
          `/api/management/v1/case-definition/${caseDefinitionKey}/version/${versionTag}/widget-tab/${tabKey}`,
          {caseDefinitionKey, caseDefinitionVersionTag: versionTag, key: tabKey, widgets: remaining}
        );
      }
    } catch {
      // Ignore errors during cleanup
    }
  }
}
