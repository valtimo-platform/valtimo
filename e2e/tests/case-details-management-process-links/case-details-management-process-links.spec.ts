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

import {expect, test} from '@playwright/test';
import {CaseDetailsProcessLinksPage} from './page';

const CASE_KEY = 'bezwaar';
const TEST_PROCESS_KEY = 'e2e-test-process';
const TEST_PROCESS_NAME = 'E2E Test Process';
const START_EVENT_ID = 'StartEvent_1';
const LINKED_FORM_NAME = 'empty-form';
const LINKED_PLUGIN_CONFIG_TITLE = 'Besluiten API';
const LINKED_BUILDING_BLOCK_NAME = 'Subsidie Berekening';
const LINKED_BUILDING_BLOCK_VERSION = '1.0.0';
const LINKED_BB_PLUGIN_LABEL = 'Zaken API';
const LINKED_BB_PLUGIN_CONFIG = 'Zaken API';

test.use({storageState: undefined});

test.describe('Case details - Process links', () => {
  let context;
  let page;
  let request;
  let processLinksPage: CaseDetailsProcessLinksPage;
  let draftVersion: string;

  test.beforeAll(async ({browser, baseURL}) => {
    context = await browser.newContext({baseURL});
    page = await context.newPage();
    request = context.request;

    processLinksPage = new CaseDetailsProcessLinksPage(page, request);

    await page.goto('/');
    draftVersion = await processLinksPage.goToCaseProcesses(CASE_KEY);

    // Clean up test process from previous runs
    await processLinksPage.deleteProcessViaApi(CASE_KEY, draftVersion, TEST_PROCESS_KEY);

    // Upload a fresh BPMN file
    await processLinksPage.uploadTestProcess();
    await processLinksPage.openProcessInBuilder(TEST_PROCESS_NAME);
  });

  test.afterAll(async () => {
    await processLinksPage.deleteProcessViaApi(CASE_KEY, draftVersion, TEST_PROCESS_KEY);
    await context.close();
  });

  test.beforeEach(async () => {
    await processLinksPage.clearInMemoryProcessLinks();
    const modalOpen = await processLinksPage.modal
      .getAttribute('ng-reflect-open')
      .catch(() => null);
    if (modalOpen === 'true') {
      await processLinksPage.cancelModal();
    }
  });

  test.describe('6.12 — Create process link', () => {
    test('Modal opens with type selection — StartEvent offers Form and FormFlow', async () => {
      await processLinksPage.openProcessLinkModalForStartEvent(START_EVENT_ID);

      // StartEvent supports user-facing link types
      await expect(processLinksPage.typeButton('Form')).toBeVisible();
      await expect(processLinksPage.typeButton('FormFlow')).toBeVisible();
    });

    test('Modal opens with type selection — ServiceTask auto-advances to the Plugin configuration step', async () => {
      await processLinksPage.openProcessLinkModalForServiceTask(START_EVENT_ID);

      await expect(processLinksPage.selectPluginConfigurationComponent).toBeVisible();
    });

    test('Cancel on the type-selection step closes the modal without creating a link', async () => {
      await processLinksPage.openProcessLinkModalForStartEvent(START_EVENT_ID);
      await processLinksPage.cancelModal();

      // No link should exist after cancelling
      const hasLink = await page.evaluate((id: string) => {
        const service = (window as any).processManagementEditorService;
        return (service?.processLinksForSelectedDefinition || [])
          .some((l: {activityId: string}) => l.activityId === id);
      }, START_EVENT_ID);
      expect(hasLink).toBe(false);
    });
  });

  test.describe('6.13, 6.35 — Configure Form link type and save', () => {
    test('Can choose Form, pick a form and complete saves the link', async () => {
      await processLinksPage.openProcessLinkModalForStartEvent(START_EVENT_ID);

      await processLinksPage.chooseLinkType('Form');
      await expect(processLinksPage.selectFormComponent).toBeVisible();

      await processLinksPage.selectFormByName(LINKED_FORM_NAME);

      // 6.35 — Complete saves the link
      await processLinksPage.clickComplete();
      await processLinksPage.waitForModalClosed();

      await processLinksPage.assertLinkExists(START_EVENT_ID);
    });
  });

  test.describe('6.14, 6.35 — Configure FormFlow link type and save', () => {
    test('FormFlow step is reachable and its combo box is rendered', async () => {
      await processLinksPage.openProcessLinkModalForStartEvent(START_EVENT_ID);

      await processLinksPage.chooseLinkType('FormFlow');
      await expect(processLinksPage.selectFormFlowComponent).toBeVisible();
      await processLinksPage.cancelModal();
    });
  });

  test.describe('6.15, 6.16 — Configure Plugin link type and action', () => {
    test('Plugin flow: can pick a plugin configuration and an action, advancing to the configure step', async () => {
      await processLinksPage.openProcessLinkModalForServiceTask(START_EVENT_ID);

      // 6.15 — Pick a plugin configuration and advance
      await processLinksPage.selectPluginConfigurationByTitle(LINKED_PLUGIN_CONFIG_TITLE);
      await processLinksPage.clickNext();

      // 6.16 — Pick a plugin action (first available) and advance to the
      await expect(processLinksPage.selectPluginActionComponent).toBeVisible();
      const firstTile = processLinksPage.selectPluginActionComponent
        .locator('cds-selection-tile')
        .first();
      await expect(firstTile).toBeVisible();
      await firstTile.click();
      await processLinksPage.clickNext();
      await expect(processLinksPage.completeButton).toBeVisible();

      await processLinksPage.cancelModal();
    });
  });

  test.describe('6.17, 6.18, 6.19 — Building block link type, selection and descriptions', () => {
    test('6.17 — CallActivity offers the Building block link type', async () => {
      await processLinksPage.openProcessLinkModalForCallActivity(START_EVENT_ID);
      await expect(processLinksPage.typeButton('Building block')).toBeVisible();
    });

    test('6.18 — Can select a building block from the list and advance', async () => {
      await processLinksPage.openProcessLinkModalForCallActivity(START_EVENT_ID);
      await processLinksPage.chooseLinkType('Building block');

      // The selection step renders a list of seeded building blocks
      await expect(processLinksPage.selectBuildingBlockComponent).toBeVisible();
      // Wait for the API to return building block data
      await expect(processLinksPage.buildingBlockRows.first()).toBeVisible({timeout: 10_000});
      const rowCount = await processLinksPage.buildingBlockRows.count();
      expect(rowCount).toBeGreaterThan(0);

      await processLinksPage.selectBuildingBlockByName(LINKED_BUILDING_BLOCK_NAME);
      await expect(processLinksPage.nextButton).toBeEnabled();
    });

    test('6.19 — Building block list shows a name and description column for each row', async () => {
      await processLinksPage.openProcessLinkModalForCallActivity(START_EVENT_ID);
      await processLinksPage.chooseLinkType('Building block');

      // Header shows both Name and Description columns
      await expect(processLinksPage.buildingBlockListHeader).toContainText('Name');
      await expect(processLinksPage.buildingBlockListHeader).toContainText('Description');
      await expect(processLinksPage.buildingBlockRow(LINKED_BUILDING_BLOCK_NAME)).toBeVisible();
    });
  });

  test.describe('6.20, 6.21 — Select building block version and configure plugin mapping', () => {
    const advanceToBBPluginsStep = async () => {
      await processLinksPage.openProcessLinkModalForCallActivity(START_EVENT_ID);
      await processLinksPage.chooseLinkType('Building block');
      await processLinksPage.selectBuildingBlockByName(LINKED_BUILDING_BLOCK_NAME);
      await processLinksPage.clickNext();
      await expect(processLinksPage.configureBBPluginsComponent).toBeVisible();
    };

    test('6.20 — Can pick a building block version from the version combo box', async () => {
      await advanceToBBPluginsStep();

      await expect(processLinksPage.bbVersionComboBox).toBeVisible();
      await processLinksPage.selectBBVersion(LINKED_BUILDING_BLOCK_VERSION);
      await expect(
        processLinksPage.bbPluginRowByLabel(LINKED_BB_PLUGIN_LABEL)
      ).toBeVisible();
    });

    test('6.21 — Can assign a plugin configuration to a required building-block plugin', async () => {
      await advanceToBBPluginsStep();

      // Version must be picked before the plugin list renders
      await processLinksPage.selectBBVersion(LINKED_BUILDING_BLOCK_VERSION);

      await expect(
        processLinksPage.bbPluginRowByLabel(LINKED_BB_PLUGIN_LABEL)
      ).toBeVisible();

      await processLinksPage.selectBBPluginConfiguration(
        LINKED_BB_PLUGIN_LABEL,
        LINKED_BB_PLUGIN_CONFIG
      );

      await expect(processLinksPage.nextButton).toBeEnabled();
    });
  });

  test.describe('6.22, 6.23, 6.24, 6.25, 6.26, 6.27 — Building block input mappings', () => {
    const advanceToBBMappingsStep = async () => {
      await processLinksPage.openProcessLinkModalForCallActivity(START_EVENT_ID);
      await processLinksPage.chooseLinkType('Building block');
      await processLinksPage.selectBuildingBlockByName(LINKED_BUILDING_BLOCK_NAME);
      await processLinksPage.clickNext();
      await processLinksPage.selectBBVersion(LINKED_BUILDING_BLOCK_VERSION);
      await processLinksPage.selectBBPluginConfiguration(
        LINKED_BB_PLUGIN_LABEL,
        LINKED_BB_PLUGIN_CONFIG
      );
      await processLinksPage.clickNext();
      await expect(processLinksPage.configureBBMappingsComponent).toBeVisible();
    };

    test('6.22 — Mappings step renders the Input and Sync sections', async () => {
      await advanceToBBMappingsStep();

      await expect(processLinksPage.bbMappingsInputSection).toBeVisible();
      await expect(processLinksPage.bbMappingsOutputSection).toBeVisible();
    });

    test('6.27 — Required BB input fields are auto-added as non-deletable rows with a required indicator', async () => {
      await advanceToBBMappingsStep();
      await expect(processLinksPage.bbMappingsRequiredIndicators).toHaveCount(2);

      const requiredLabels = processLinksPage.bbMappingsRequiredTargetLabels;
      await expect(requiredLabels).toHaveCount(2);
      await expect(requiredLabels.filter({hasText: 'doc:applicantName'})).toBeVisible();
      await expect(requiredLabels.filter({hasText: 'doc:householdSize'})).toBeVisible();
    });

    test('6.23 — Clicking "Add input" appends a new input-mapping row', async () => {
      await advanceToBBMappingsStep();

      const initialRowCount = await processLinksPage.bbMappingsInputRows.count();

      await processLinksPage.clickAddInputMapping();

      await expect(processLinksPage.bbMappingsInputRows).toHaveCount(initialRowCount + 1);
    });

    test('6.24, 6.26 — A newly-added row exposes the value-path selector with a dropdown/manual toggle', async () => {
      await advanceToBBMappingsStep();
      await processLinksPage.clickAddInputMapping();

      const newRow = processLinksPage.bbMappingsLastInputRow;

      // 6.24 — the source-path combo is rendered by default (dropdown mode)
      await expect(processLinksPage.valuePathSelectorCombo(newRow)).toBeVisible();

      // 6.26 — toggle flips the selector between dropdown and manual modes
      const toggle = processLinksPage.valuePathSelectorToggle(newRow);
      await expect(toggle).toBeVisible();
      const switchControl = toggle.getByRole('switch');
      const wasChecked = await switchControl.isChecked();
      await toggle.locator('.cds--toggle__switch').click();
      await expect(switchControl).toBeChecked({checked: !wasChecked});

      // After toggling to manual, the input field becomes the visible source
      await expect(processLinksPage.valuePathSelectorInput(newRow)).toBeVisible();
    });

    test('6.25 — A newly-added row exposes a target v-select for mapping to a BB field', async () => {
      await advanceToBBMappingsStep();
      await processLinksPage.clickAddInputMapping();

      const newRow = processLinksPage.bbMappingsLastInputRow;

      await expect(processLinksPage.inputTargetSelectWrapper(newRow)).toBeVisible();
      await expect(processLinksPage.inputTargetSelectWrapper(newRow).locator('v-select'))
        .toBeVisible();
    });
  });

  test.describe('6.28, 6.29, 6.30, 6.31 — Building block sync (output) mappings', () => {
    const advanceToBBMappingsStep = async () => {
      await processLinksPage.openProcessLinkModalForCallActivity(START_EVENT_ID);
      await processLinksPage.chooseLinkType('Building block');
      await processLinksPage.selectBuildingBlockByName(LINKED_BUILDING_BLOCK_NAME);
      await processLinksPage.clickNext();
      await processLinksPage.selectBBVersion(LINKED_BUILDING_BLOCK_VERSION);
      await processLinksPage.selectBBPluginConfiguration(
        LINKED_BB_PLUGIN_LABEL,
        LINKED_BB_PLUGIN_CONFIG
      );
      await processLinksPage.clickNext();
      await expect(processLinksPage.configureBBMappingsComponent).toBeVisible();
    };

    test('6.28 — Sync section exposes an "Add sync" button and no rows by default', async () => {
      await advanceToBBMappingsStep();

      await expect(processLinksPage.bbMappingsOutputSection).toBeVisible();
      await expect(processLinksPage.bbMappingsAddOutputButton).toBeVisible();
      await expect(processLinksPage.bbMappingsOutputRows).toHaveCount(0);
    });

    test('6.29 — Clicking "Add sync" appends a new output-mapping row', async () => {
      await advanceToBBMappingsStep();
      const initialCount = await processLinksPage.bbMappingsOutputRows.count();

      await processLinksPage.clickAddOutputMapping();

      await expect(processLinksPage.bbMappingsOutputRows).toHaveCount(initialCount + 1);
    });

    test('6.30, 6.31 — A newly-added sync row exposes a source v-select (BB field) and a target value-path-selector (case field)', async () => {
      await advanceToBBMappingsStep();
      await processLinksPage.clickAddOutputMapping();

      const newRow = processLinksPage.bbMappingsLastOutputRow;

      // 6.30 — source v-select of BB fields
      const sourceWrapper = processLinksPage.outputSourceSelectWrapper(newRow);
      await expect(sourceWrapper).toBeVisible();
      await expect(sourceWrapper.locator('v-select')).toBeVisible();

      // 6.31 — target value-path-selector (case context: dropdown + manual toggle)
      await expect(processLinksPage.valuePathSelectorToggle(newRow)).toBeVisible();
      await expect(processLinksPage.valuePathSelectorCombo(newRow)).toBeVisible();
    });
  });

  test.describe('6.32 — Delete mappings', () => {
    const advanceToBBMappingsStep = async () => {
      await processLinksPage.openProcessLinkModalForCallActivity(START_EVENT_ID);
      await processLinksPage.chooseLinkType('Building block');
      await processLinksPage.selectBuildingBlockByName(LINKED_BUILDING_BLOCK_NAME);
      await processLinksPage.clickNext();
      await processLinksPage.selectBBVersion(LINKED_BUILDING_BLOCK_VERSION);
      await processLinksPage.selectBBPluginConfiguration(
        LINKED_BB_PLUGIN_LABEL,
        LINKED_BB_PLUGIN_CONFIG
      );
      await processLinksPage.clickNext();
      await expect(processLinksPage.configureBBMappingsComponent).toBeVisible();
    };

    test('Can delete a non-required input mapping row', async () => {
      await advanceToBBMappingsStep();
      await processLinksPage.clickAddInputMapping();
      const initialRowCount = await processLinksPage.bbMappingsInputRows.count();

      const newRow = processLinksPage.bbMappingsLastInputRow;
      const deleteBtn = processLinksPage.inputDeleteButton(newRow);
      await expect(deleteBtn).toBeVisible();

      await deleteBtn.click();

      await expect(processLinksPage.bbMappingsInputRows).toHaveCount(initialRowCount - 1);
    });

    test('Can delete a sync (output) mapping row', async () => {
      await advanceToBBMappingsStep();

      await processLinksPage.clickAddOutputMapping();
      await expect(processLinksPage.bbMappingsOutputRows).toHaveCount(1);

      const newRow = processLinksPage.bbMappingsLastOutputRow;
      await processLinksPage.outputDeleteButton(newRow).click();

      await expect(processLinksPage.bbMappingsOutputRows).toHaveCount(0);
    });
  });

  test.describe('6.33 — View dependency warnings', () => {
    test('Dependency warning notification is shown on the plugins step when the BB requires zaak links', async () => {
      await processLinksPage.openProcessLinkModalForCallActivity(START_EVENT_ID);
      await processLinksPage.chooseLinkType('Building block');
      await processLinksPage.selectBuildingBlockByName(LINKED_BUILDING_BLOCK_NAME);
      await processLinksPage.clickNext();

      await expect(processLinksPage.configureBBPluginsComponent).toBeVisible();
      await expect(processLinksPage.bbPluginDependenciesNotification).toBeVisible();
    });
  });

  test.describe('6.34 — Complete building block config', () => {
    test('Filling required input mappings enables Complete and saves the link', async () => {
      await processLinksPage.openProcessLinkModalForCallActivity(START_EVENT_ID);
      await processLinksPage.chooseLinkType('Building block');
      await processLinksPage.selectBuildingBlockByName(LINKED_BUILDING_BLOCK_NAME);
      await processLinksPage.clickNext();
      await processLinksPage.selectBBVersion(LINKED_BUILDING_BLOCK_VERSION);
      await processLinksPage.selectBBPluginConfiguration(
        LINKED_BB_PLUGIN_LABEL,
        LINKED_BB_PLUGIN_CONFIG
      );
      await processLinksPage.clickNext();
      await expect(processLinksPage.configureBBMappingsComponent).toBeVisible();
      await processLinksPage.fillRequiredInputMappings();

      await expect(processLinksPage.completeButton).toBeEnabled();
      await processLinksPage.clickComplete();
      await processLinksPage.waitForModalClosed();
      await processLinksPage.assertLinkExists(START_EVENT_ID);
    });
  });
});
